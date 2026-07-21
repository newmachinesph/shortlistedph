import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { fulfillInterview, fulfillPurchase, markPaymentRefunded } from "@/lib/fulfillment";
import { isCreditProduct } from "@/lib/payments";
import { verifyWebhook } from "@/lib/paypal";

/**
 * Safety net for buyers who close the tab before /capture returns.
 *
 * Always answers 200 once the signature checks out — a non-2xx makes PayPal
 * retry, and retrying a delivery we simply chose not to act on is noise.
 * Genuine processing failures return 500 so the retry is useful.
 */
export async function POST(req: Request) {
  const raw = await req.text();

  if (!(await verifyWebhook(req.headers, raw))) {
    console.error("[paypal] rejected unverified webhook");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event: {
    event_type?: string;
    resource?: {
      id?: string;
      amount?: { value?: string; currency_code?: string };
      supplementary_data?: { related_ids?: { order_id?: string } };
      custom_id?: string;
      invoice_id?: string;
      purchase_units?: { reference_id?: string }[];
    };
  };
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
  }

  const type = event.event_type;
  const captureId = event.resource?.id;

  try {
    if (type === "PAYMENT.CAPTURE.COMPLETED" && captureId) {
      // reference_id was set at order creation as "<employerId>:<productId>".
      const reference =
        event.resource?.purchase_units?.[0]?.reference_id ??
        event.resource?.custom_id ??
        event.resource?.invoice_id ??
        "";
      // Interview payments carry "interview:<id>" and settle a dynamic price.
      if (reference.startsWith("interview:")) {
        const interviewId = reference.slice("interview:".length);
        const iv = await db.interview.findUnique({
          where: { id: interviewId },
          select: { employerId: true, employer: { select: { userId: true } } },
        });
        if (!iv) {
          return NextResponse.json({ received: true, ignored: "unknown interview" });
        }
        const result = await fulfillInterview({
          employerUserId: iv.employer.userId,
          employerId: iv.employerId,
          interviewId,
          providerRef: captureId,
          amount: Number(event.resource?.amount?.value ?? 0),
          currency: event.resource?.amount?.currency_code ?? "USD",
        });
        return NextResponse.json({ received: true, ...result });
      }

      const [employerId, productId] = reference.split(":");

      if (!employerId || !productId || !isCreditProduct(productId)) {
        console.error("[paypal] capture without a usable reference_id", { captureId, reference });
        return NextResponse.json({ received: true, ignored: "unresolvable reference" });
      }

      const employer = await db.employerAccount.findUnique({
        where: { id: employerId },
        select: { userId: true },
      });
      if (!employer) {
        console.error("[paypal] capture for unknown employer", { employerId, captureId });
        return NextResponse.json({ received: true, ignored: "unknown employer" });
      }

      const result = await fulfillPurchase({
        userId: employer.userId,
        provider: "paypal",
        providerRef: captureId,
        productId,
        amount: Number(event.resource?.amount?.value ?? 0),
        currency: event.resource?.amount?.currency_code ?? "USD",
      });
      return NextResponse.json({ received: true, ...result });
    }

    if ((type === "PAYMENT.CAPTURE.REFUNDED" || type === "PAYMENT.CAPTURE.REVERSED") && captureId) {
      await markPaymentRefunded(captureId);
      return NextResponse.json({ received: true, refunded: true });
    }

    return NextResponse.json({ received: true, ignored: type });
  } catch (e) {
    // Real failure — let PayPal retry.
    console.error("[paypal] webhook processing failed", e);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}

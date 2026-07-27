import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { fulfillPurchase, markPaymentRefunded } from "@/lib/fulfillment";
import { isEmployerCreditProduct } from "@/lib/payments";
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
      supplementary_data?: { related_ids?: { order_id?: string; capture_id?: string } };
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

  // reference_id was set at order creation as "<employerId>:<productId>".
  const reference =
    event.resource?.purchase_units?.[0]?.reference_id ??
    event.resource?.custom_id ??
    event.resource?.invoice_id ??
    "";
  const [employerId, productId] = reference.split(":");

  try {
    if (type === "PAYMENT.CAPTURE.COMPLETED" && captureId) {
      if (!employerId || !productId || !isEmployerCreditProduct(productId)) {
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
      // On a REFUNDED delivery resource.id is the REFUND's id, not the
      // capture's — matching Payment.providerRef on it found nothing and the
      // refund was dropped on the floor. The capture is in related_ids; a
      // REVERSED resource IS the capture, so it falls back to resource.id.
      const refundedCapture =
        event.resource?.supplementary_data?.related_ids?.capture_id ?? captureId;

      // Only needed when the capture has not been fulfilled yet — PayPal
      // delivers in no fixed order — and only possible when the event carried
      // a reference we can resolve a payer from.
      const product = productId && isEmployerCreditProduct(productId) ? productId : null;
      const employer =
        employerId && product
          ? await db.employerAccount.findUnique({
              where: { id: employerId },
              select: { userId: true },
            })
          : null;

      const amount = Number(event.resource?.amount?.value ?? 0);

      await markPaymentRefunded(refundedCapture, {
        // resource.amount on a REFUNDED delivery is what this refund returned,
        // and PayPal allows that to be part of the capture. resource.id is the
        // refund's own id, which is what makes it the right idempotency key —
        // one capture can be refunded more than once.
        refund: {
          id: captureId,
          amount: refundedCapture === captureId ? undefined : amount,
        },
        payer:
          employer && product
            ? {
                userId: employer.userId,
                provider: "paypal",
                productId: product,
                amount,
                currency: event.resource?.amount?.currency_code ?? "USD",
              }
            : undefined,
      });
      return NextResponse.json({ received: true, refunded: true });
    }

    return NextResponse.json({ received: true, ignored: type });
  } catch (e) {
    // Real failure — let PayPal retry.
    console.error("[paypal] webhook processing failed", e);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}

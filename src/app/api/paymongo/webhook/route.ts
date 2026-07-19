import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { fulfillPurchase, markPaymentFailed, markPaymentRefunded } from "@/lib/fulfillment";
import { verifySignature } from "@/lib/paymongo";

/**
 * Talent-side ₱60 verification payments (QR Ph).
 *
 * Fulfillment truth is the webhook, never the browser: the payer's app confirms
 * out-of-band, so the tab may never come back.
 */
export async function POST(req: Request) {
  const raw = await req.text();

  if (!verifySignature(req.headers.get("paymongo-signature"), raw)) {
    console.error("[paymongo] rejected unverified webhook");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let event: {
    data?: {
      attributes?: {
        type?: string;
        data?: {
          id?: string;
          attributes?: {
            amount?: number;
            currency?: string;
            metadata?: Record<string, string>;
            payment_intent_id?: string;
          };
        };
      };
    };
  };
  try {
    event = JSON.parse(raw);
  } catch {
    return NextResponse.json({ error: "Bad JSON" }, { status: 400 });
  }

  const type = event.data?.attributes?.type;
  const payload = event.data?.attributes?.data;
  const ref = payload?.id;
  const attrs = payload?.attributes;

  try {
    // qr.paid fires for the direct QR Ph flow; checkout_session.payment.paid
    // is accepted too so switching to a hosted page later needs no changes.
    if ((type === "qr.paid" || type === "payment.paid" || type === "checkout_session.payment.paid") && ref) {
      const userId = attrs?.metadata?.userId;
      if (!userId) {
        console.error("[paymongo] paid event without userId metadata", { ref });
        return NextResponse.json({ received: true, ignored: "no userId" });
      }

      const user = await db.user.findUnique({ where: { id: userId }, select: { id: true } });
      if (!user) {
        console.error("[paymongo] paid event for unknown user", { userId, ref });
        return NextResponse.json({ received: true, ignored: "unknown user" });
      }

      const result = await fulfillPurchase({
        userId,
        provider: "paymongo",
        providerRef: ref,
        productId: "verification",
        // PayMongo reports centavos.
        amount: (attrs?.amount ?? 6000) / 100,
        currency: attrs?.currency ?? "PHP",
      });
      return NextResponse.json({ received: true, ...result });
    }

    if (type === "payment.failed" && ref) {
      await markPaymentFailed(ref);
      return NextResponse.json({ received: true, failed: true });
    }

    if ((type === "payment.refunded" || type === "payment.refund.updated") && ref) {
      await markPaymentRefunded(ref);
      return NextResponse.json({ received: true, refunded: true });
    }

    // qrph.expired / qr.expired need no server state — the UI just regenerates.
    return NextResponse.json({ received: true, ignored: type });
  } catch (e) {
    console.error("[paymongo] webhook processing failed", e);
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}

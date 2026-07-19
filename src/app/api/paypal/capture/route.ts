import { z } from "zod";
import { fail, ok, parseBody } from "@/lib/api";
import { fulfillPurchase } from "@/lib/fulfillment";
import { PRODUCTS, isCreditProduct } from "@/lib/payments";
import { captureOrder } from "@/lib/paypal";
import { HttpError, requireEmployer, requireRole } from "@/lib/session";

// Only the order id is accepted. What was bought is decided by PayPal's own
// record of the order, never by the caller.
const Body = z.object({ orderId: z.string().min(1) });

/**
 * Called when the buyer returns from PayPal. The webhook is the safety net for
 * a user who closes the tab mid-capture; both funnel into the same idempotent
 * fulfillment, so whichever lands first wins and the other no-ops.
 *
 * The product credited is derived from the order's reference_id — which we set
 * server-side at order creation as "<employerId>:<productId>". Trusting a
 * client-supplied productId here would let a buyer pay for one credit and claim
 * the three-pack.
 */
export async function POST(req: Request) {
  try {
    const user = await requireRole("employer");
    const employer = await requireEmployer(user.id);
    const { orderId } = await parseBody(req, Body);

    const capture = await captureOrder(orderId);
    if (!capture.completed || !capture.captureId) {
      throw new HttpError(402, "Payment was not completed");
    }

    const [employerId, productId] = (capture.referenceId ?? "").split(":");

    // The webhook can still fulfil this from PayPal's own delivery, so failing
    // here loses nothing except the instant balance update.
    if (!employerId || !productId || !isCreditProduct(productId)) {
      console.error("[paypal] capture without a usable reference_id", {
        captureId: capture.captureId,
        referenceId: capture.referenceId,
      });
      throw new HttpError(409, "Could not confirm what was purchased — your credits will arrive shortly");
    }
    if (employerId !== employer.id) {
      console.error("[paypal] capture attempted against another employer's order", {
        callerEmployerId: employer.id,
        orderEmployerId: employerId,
      });
      throw new HttpError(403, "That order belongs to another account");
    }

    const product = PRODUCTS[productId];
    const result = await fulfillPurchase({
      userId: user.id,
      provider: "paypal",
      providerRef: capture.captureId,
      productId,
      amount: Number(capture.amount ?? product.amount),
      currency: capture.currency ?? product.currency,
    });

    return ok({ credited: result.granted, alreadyProcessed: result.alreadyProcessed });
  } catch (e) {
    return fail(e);
  }
}

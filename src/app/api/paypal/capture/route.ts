import { z } from "zod";
import { fail, ok, parseBody } from "@/lib/api";
import { fulfillPurchase } from "@/lib/fulfillment";
import { PRODUCTS } from "@/lib/payments";
import { captureOrder } from "@/lib/paypal";
import { HttpError, requireEmployer, requireRole } from "@/lib/session";

const Body = z.object({
  orderId: z.string().min(1),
  productId: z.enum(["single", "three_pack"]),
});

/**
 * Called when the buyer returns from PayPal. The webhook is the safety net for
 * a user who closes the tab mid-capture; both funnel into the same idempotent
 * fulfillment, so whichever lands first wins and the other no-ops.
 */
export async function POST(req: Request) {
  try {
    const user = await requireRole("employer");
    await requireEmployer(user.id);
    const { orderId, productId } = await parseBody(req, Body);

    const capture = await captureOrder(orderId);
    if (!capture.completed || !capture.captureId) {
      throw new HttpError(402, "Payment was not completed");
    }

    // Amount comes from PayPal's capture response, never from the client.
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

import { z } from "zod";
import { fail, ok, parseBody } from "@/lib/api";
import { PRODUCTS, isEmployerCreditProduct, isInterviewCreditProduct } from "@/lib/payments";
import { createOrder } from "@/lib/paypal";
import { requireEmployer, requireRole } from "@/lib/session";

const Body = z.object({
  productId: z.enum(["single", "three_pack", "interview_single", "interview_five"]),
});

export async function POST(req: Request) {
  try {
    const user = await requireRole("employer");
    const employer = await requireEmployer(user.id);
    const { productId } = await parseBody(req, Body);
    if (!isEmployerCreditProduct(productId)) throw new Error("Not a credit product");

    const product = PRODUCTS[productId];
    const order = await createOrder({
      amount: product.amount,
      currency: product.currency,
      description: product.label,
      // Carries the buyer through PayPal so the webhook can resolve them
      // without trusting anything the client sends back.
      referenceId: `${employer.id}:${productId}`,
      // Interview credits are bought from the interviews page — send the buyer
      // back there so its capture-on-return finishes it.
      returnPath: isInterviewCreditProduct(productId) ? "/employer/interviews" : undefined,
    });

    return ok({ orderId: order.id, approveUrl: order.approveUrl });
  } catch (e) {
    return fail(e);
  }
}

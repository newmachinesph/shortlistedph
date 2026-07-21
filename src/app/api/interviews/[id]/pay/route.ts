import { fail, ok } from "@/lib/api";
import { db } from "@/lib/db";
import { createOrder } from "@/lib/paypal";
import { HttpError, requireEmployer, requireRole } from "@/lib/session";

/**
 * Creates the PayPal order for an interview the candidate has already agreed
 * to. The amount comes from the price locked on the interview row at request
 * time — never from the client — and the order carries "interview:<id>" so the
 * capture and webhook resolve it without trusting anything the browser sends.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRole("employer");
    const employer = await requireEmployer(user.id);
    const { id } = await params;

    const interview = await db.interview.findUnique({
      where: { id },
      select: {
        id: true,
        employerId: true,
        status: true,
        priceUsd: true,
        interviewer: { select: { user: { select: { name: true } } } },
      },
    });

    if (!interview || interview.employerId !== employer.id) {
      throw new HttpError(404, "Interview not found");
    }
    // Payment is only valid once the candidate has consented and before it is
    // already paid — any other state means the button should not have shown.
    if (interview.status !== "consented") {
      throw new HttpError(409, "This interview is not awaiting payment");
    }

    const order = await createOrder({
      amount: interview.priceUsd.toFixed(2),
      currency: "USD",
      description: "shortlisted.ph interview",
      referenceId: `interview:${interview.id}`,
    });

    return ok({ orderId: order.id, approveUrl: order.approveUrl });
  } catch (e) {
    return fail(e);
  }
}

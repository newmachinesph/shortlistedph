import { z } from "zod";
import { fail, ok, parseBody } from "@/lib/api";
import { requireUser } from "@/lib/session";
import { PAYOUT_METHODS, requestPayout, savePayoutDetails } from "@/lib/referral";

const Details = z.object({
  method: z.enum(PAYOUT_METHODS),
  email: z.string().trim().email().max(254),
});

/**
 * Where to send the money — a PayPal email. The response confirms the save
 * and nothing else.
 */
export async function PATCH(req: Request) {
  try {
    const user = await requireUser();
    const details = await parseBody(req, Details);
    await savePayoutDetails(user.id, details);
    return ok({ saved: true });
  } catch (e) {
    return fail(e);
  }
}

/**
 * Affiliate asks to be paid. No body: the amount is recomputed server-side
 * from the qualified conversions that no payout covers yet.
 */
export async function POST() {
  try {
    const user = await requireUser();
    const payout = await requestPayout(user.id);
    return ok(
      { id: payout.id, amount: payout.amount, currency: payout.currency, status: payout.status },
      { status: 201 },
    );
  } catch (e) {
    return fail(e);
  }
}

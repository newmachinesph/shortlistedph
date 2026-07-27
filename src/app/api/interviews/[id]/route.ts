import { z } from "zod";
import { fail, ok, parseBody } from "@/lib/api";
import { cancelInterview } from "@/lib/interviews";
import { requireEmployer, requireRole } from "@/lib/session";

const Body = z.object({ action: z.literal("cancel"), reason: z.string().max(500).optional() });

/**
 * Employer cancels an interview.
 *
 * This used to be a second, weaker implementation: it read the status, then
 * wrote "cancelled" UNCONDITIONALLY. A confirm committing in that window left
 * a spent credit and a stamped entitlement attached to a dead interview, with
 * nothing returned and nobody notified. It also refused every state past
 * "consented", which is what made an abandoned paid interview unfixable.
 *
 * cancelInterview owns the rules now — conditional status write, credit and
 * entitlement returned together, all three parties told. Passing employerId
 * keeps the employer's narrower window: they cannot cancel work already
 * delivered.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRole("employer");
    const employer = await requireEmployer(user.id);
    const { id } = await params;
    const { reason } = await parseBody(req, Body);

    return ok(
      await cancelInterview({
        actorId: user.id,
        interviewId: id,
        employerId: employer.id,
        reason,
      }),
    );
  } catch (e) {
    return fail(e);
  }
}

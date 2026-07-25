import { z } from "zod";
import { fail, ok, parseBody } from "@/lib/api";
import { cancelInterview } from "@/lib/interviews";
import { requireAdmin } from "@/lib/session";

const Body = z.object({
  action: z.literal("cancel"),
  reason: z.string().trim().max(300).optional(),
});

/**
 * The operator's only lever on a live interview.
 *
 * A confirmed interview whose interviewer goes dark had no exit: the credit was
 * spent, the employer could not cancel past delivery, and admin could not touch
 * an Interview at all. cancelInterview returns the credit AND frees the
 * entitlement row it was spent on, so the reconciliation invariant survives —
 * which is why this calls it instead of updating the row here.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    const body = await parseBody(req, Body);

    return ok(
      await cancelInterview({ actorId: admin.id, interviewId: id, reason: body.reason }),
    );
  } catch (e) {
    return fail(e);
  }
}

import { z } from "zod";
import { fail, ok, parseBody } from "@/lib/api";
import { approveVerification, rejectVerification } from "@/lib/verification";
import { requireAdmin } from "@/lib/session";

// The note is what the applicant is told, so a rejection cannot be silent.
const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("approve") }),
  z.object({ action: z.literal("reject"), note: z.string().trim().min(1).max(500) }),
]);

/**
 * Adjudicate one identity verification attempt. `id` is the User id — the
 * binding is unique per user, which is also what lib/verification.ts keys on.
 *
 * Approving is the only write of TalentProfile.verifiedTier anywhere; the whole
 * point of routing it through the lib is that paying can never be enough to
 * look verified.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    const body = await parseBody(req, Body);

    return ok(
      body.action === "approve"
        ? await approveVerification({ actorId: admin.id, userId: id })
        : await rejectVerification({ actorId: admin.id, userId: id, note: body.note }),
    );
  } catch (e) {
    return fail(e);
  }
}

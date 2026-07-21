import { fail, ok } from "@/lib/api";
import { confirmInterview } from "@/lib/interviews";
import { requireEmployer, requireRole } from "@/lib/session";

/**
 * Confirm a consented interview by spending one interview credit. Replaces the
 * old per-interview PayPal charge — the money moved earlier, when the employer
 * bought the credit. The spend itself is transactional and race-safe in
 * confirmInterview; this route only authenticates and scopes it to the caller's
 * own employer account.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRole("employer");
    const employer = await requireEmployer(user.id);
    const { id } = await params;

    const result = await confirmInterview({
      actorId: user.id,
      employerId: employer.id,
      interviewId: id,
    });

    return ok(result);
  } catch (e) {
    return fail(e);
  }
}

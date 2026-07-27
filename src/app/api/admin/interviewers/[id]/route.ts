import { z } from "zod";
import { db } from "@/lib/db";
import { fail, ok, parseBody } from "@/lib/api";
import { mail } from "@/lib/email";
import { notify } from "@/lib/notify";
import { HttpError, requireAdmin } from "@/lib/session";

const Body = z.object({ action: z.enum(["approve", "reject", "pause", "activate", "revoke"]) });

/**
 * Both /apply/interviewer and the portal promise "we'll be in touch", and
 * nothing was ever in touch: every one of these decisions was silent, so an
 * approved interviewer had no way to learn they could start and a rejected one
 * waited forever. One notification per decision, keyed to the action.
 */
const NOTIFY_TYPE: Record<z.infer<typeof Body>["action"], string> = {
  approve: "interviewer_approved",
  reject: "interviewer_rejected",
  pause: "interviewer_paused",
  activate: "interviewer_activated",
  revoke: "interviewer_revoked",
};

/**
 * Vetting actions on one Interviewer application/record. `id` is Interviewer.id.
 *
 * Approving grants a CAPABILITY, not a role. It used to also set
 * User.role = "interviewer", which quietly destroyed the person's real
 * account: a talent could no longer consent to interviews of themselves (their
 * own /api/talent routes 403'd) while their profile stayed in the matching
 * pool, and an employer lost every employer route with purchased credits
 * stranded. There was no lever to reverse it.
 *
 * The portal gates on this row alone (src/app/interviewer/layout.tsx +
 * requireActingInterviewer), so the role never needed to move. Revoke is the
 * way back out for an already-approved interviewer.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    const { action } = await parseBody(req, Body);

    const interviewer = await db.interviewer.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        status: true,
        user: { select: { email: true, name: true } },
      },
    });
    if (!interviewer) throw new HttpError(404, "Interviewer not found");

    if (action === "approve") {
      if (interviewer.status !== "pending") {
        throw new HttpError(409, `Application is already ${interviewer.status}`);
      }
      await db.interviewer.update({ where: { id }, data: { status: "active" } });
    } else if (action === "reject") {
      if (interviewer.status !== "pending") {
        throw new HttpError(409, "Only a pending application can be rejected");
      }
      // A rejected application never became an interviewer — remove the row.
      // The user's own account is untouched and they can apply again later.
      await db.interviewer.delete({ where: { id } });
    } else if (action === "pause") {
      if (interviewer.status !== "active") throw new HttpError(409, "Only an active interviewer can be paused");
      await db.interviewer.update({ where: { id }, data: { status: "paused" } });
    } else if (action === "revoke") {
      if (interviewer.status === "pending") throw new HttpError(409, "Reject the application instead");
      // Terminal: the portal admits active|paused only, so this closes it for
      // good while keeping the row (and its interview history) intact.
      await db.interviewer.update({ where: { id }, data: { status: "revoked" } });
    } else {
      if (interviewer.status !== "paused") throw new HttpError(409, "Only a paused interviewer can be reactivated");
      await db.interviewer.update({ where: { id }, data: { status: "active" } });
    }

    await db.auditLog.create({
      data: {
        actorId: admin.id,
        action: `interviewer_${action}`,
        target: id,
        meta: { userId: interviewer.userId },
      },
    });

    // After the decision is committed and audited: notify() swallows its own
    // failures, so a bell that does not light can never undo a vetting call.
    await notify({ userId: interviewer.userId, type: NOTIFY_TYPE[action], payload: {} });

    // Approve and reject also go by email. Those two are the decisions the
    // applicant is actually waiting on, and someone who has been told "we'll be
    // in touch" is by definition not sitting in the portal watching a bell.
    // Best-effort: the decision is already made and audited.
    try {
      if (action === "approve") {
        await mail.interviewerApproved(interviewer.user.email, { name: interviewer.user.name });
      } else if (action === "reject") {
        await mail.interviewerRejected(interviewer.user.email, { name: interviewer.user.name });
      }
    } catch (e) {
      console.error("[admin/interviewers] decision email failed", e);
    }

    return ok({ ok: true });
  } catch (e) {
    return fail(e);
  }
}

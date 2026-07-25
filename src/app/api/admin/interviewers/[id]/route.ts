import { z } from "zod";
import { db } from "@/lib/db";
import { fail, ok, parseBody } from "@/lib/api";
import { HttpError, requireAdmin } from "@/lib/session";

const Body = z.object({ action: z.enum(["approve", "reject", "pause", "activate", "revoke"]) });

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
      select: { id: true, userId: true, status: true },
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

    return ok({ ok: true });
  } catch (e) {
    return fail(e);
  }
}

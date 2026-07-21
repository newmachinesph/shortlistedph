import { z } from "zod";
import { db } from "@/lib/db";
import { fail, ok, parseBody } from "@/lib/api";
import { HttpError, requireAdmin } from "@/lib/session";

const Body = z.object({ action: z.enum(["approve", "reject", "pause", "activate"]) });

/**
 * Vetting actions on one Interviewer application/record. `id` is Interviewer.id.
 *
 * Approve is the load-bearing one: it flips Interviewer.status → "active" AND
 * User.role → "interviewer" in a single transaction. Without the role flip the
 * interviewer portal gate never admits them, so both must move together or
 * neither does.
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
      await db.$transaction([
        db.interviewer.update({ where: { id }, data: { status: "active" } }),
        db.user.update({ where: { id: interviewer.userId }, data: { role: "interviewer" } }),
      ]);
    } else if (action === "reject") {
      if (interviewer.status !== "pending") {
        throw new HttpError(409, "Only a pending application can be rejected");
      }
      // No "rejected" state exists in the schema, and a rejected application
      // never became an interviewer — remove the row. The user keeps their
      // existing role and can apply again later.
      await db.interviewer.delete({ where: { id } });
    } else if (action === "pause") {
      if (interviewer.status !== "active") throw new HttpError(409, "Only an active interviewer can be paused");
      await db.interviewer.update({ where: { id }, data: { status: "paused" } });
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

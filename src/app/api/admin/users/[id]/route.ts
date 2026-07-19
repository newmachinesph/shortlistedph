import { z } from "zod";
import { db } from "@/lib/db";
import { fail, ok, parseBody } from "@/lib/api";
import { HttpError, requireAdmin } from "@/lib/session";

const Body = z.object({ status: z.enum(["active", "suspended", "banned"]) });

/**
 * Suspend, ban, or reactivate an account. requireUser() already rejects any
 * session whose status is not "active", so this is the whole kill switch.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    const { status } = await parseBody(req, Body);

    const target = await db.user.findUnique({ where: { id }, select: { id: true, status: true } });
    if (!target) throw new HttpError(404, "User not found");
    if (target.id === admin.id) throw new HttpError(409, "You cannot change your own status");

    await db.$transaction([
      db.user.update({ where: { id }, data: { status } }),
      db.auditLog.create({
        data: {
          actorId: admin.id,
          action: `admin.user.${status}`,
          target: id,
          meta: { from: target.status, to: status },
        },
      }),
    ]);

    return ok({ id, status });
  } catch (e) {
    return fail(e);
  }
}

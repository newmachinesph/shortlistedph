import { z } from "zod";
import { db } from "@/lib/db";
import { fail, ok, parseBody } from "@/lib/api";
import { applyUserStatus } from "@/lib/admin";
import { HttpError, requireAdmin } from "@/lib/session";

const Body = z.object({
  status: z.enum(["resolved", "dismissed"]),
  resolution: z.string().min(1).max(2000),
  // Closing the report and acting on the person are one decision, so they are
  // one call. "none" is explicit rather than implied by omission.
  action: z.enum(["none", "suspend", "ban"]).default("none"),
});

const STATUS_FOR: Record<"suspend" | "ban", "suspended" | "banned"> = {
  suspend: "suspended",
  ban: "banned",
};

/** Close a report. The note is the record of why — it is required, not optional. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    const { status, resolution, action } = await parseBody(req, Body);

    const report = await db.report.findUnique({
      where: { id },
      select: { id: true, status: true, againstId: true },
    });
    if (!report) throw new HttpError(404, "Report not found");
    if (report.status !== "open") throw new HttpError(409, `Already ${report.status}`);

    // Enforce first: if the ban fails, the report stays open and actionable
    // rather than closed with a note describing something that never happened.
    const enforcement =
      action === "none"
        ? null
        : await applyUserStatus({
            actorId: admin.id,
            userId: report.againstId,
            status: STATUS_FOR[action],
            action: `admin.user.${STATUS_FOR[action]}`,
            meta: { viaReport: id },
          });

    await db.$transaction([
      db.report.update({ where: { id }, data: { status, resolution } }),
      db.auditLog.create({
        data: {
          actorId: admin.id,
          action: `admin.report.${status}`,
          target: id,
          meta: { againstId: report.againstId, resolution, action },
        },
      }),
    ]);

    return ok({ id, status, action, enforcement });
  } catch (e) {
    return fail(e);
  }
}

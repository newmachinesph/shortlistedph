import { z } from "zod";
import { db } from "@/lib/db";
import { fail, ok, parseBody } from "@/lib/api";
import { HttpError, requireAdmin } from "@/lib/session";

const Body = z.object({
  status: z.enum(["resolved", "dismissed"]),
  resolution: z.string().min(1).max(2000),
});

/** Close a report. The note is the record of why — it is required, not optional. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    const { status, resolution } = await parseBody(req, Body);

    const report = await db.report.findUnique({
      where: { id },
      select: { id: true, status: true, againstId: true },
    });
    if (!report) throw new HttpError(404, "Report not found");
    if (report.status !== "open") throw new HttpError(409, `Already ${report.status}`);

    await db.$transaction([
      db.report.update({ where: { id }, data: { status, resolution } }),
      db.auditLog.create({
        data: {
          actorId: admin.id,
          action: `admin.report.${status}`,
          target: id,
          meta: { againstId: report.againstId, resolution },
        },
      }),
    ]);

    return ok({ id, status });
  } catch (e) {
    return fail(e);
  }
}

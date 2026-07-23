import { z } from "zod";
import { db } from "@/lib/db";
import { fail, ok, parseBody } from "@/lib/api";
import { HttpError, requireUser } from "@/lib/session";

const schema = z.object({
  againstId: z.string().min(1).optional(),
  context: z.enum(["connection", "interview", "message", "other"]),
  subject: z.string().trim().min(1).max(200),
  detail: z.string().trim().min(20).max(2000),
});

/** Files a report into the admin queue at /admin/reports. */
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = await parseBody(req, schema);

    // ponytail: naive rate limit — a count query, not a limiter service.
    const openCount = await db.report.count({
      where: { filedById: user.id, status: "open" },
    });
    if (openCount >= 5) {
      throw new HttpError(429, "You already have 5 open reports — our team is reviewing them.");
    }

    if (body.againstId) {
      const target = await db.user.findUnique({
        where: { id: body.againstId },
        select: { id: true },
      });
      if (!target) throw new HttpError(422, "Reported user not found");
    }

    // ponytail: Report.againstId is required by the schema, so an off-platform
    // report is filed against the reporter with a marker line for admins.
    const report = await db.report.create({
      data: {
        filedById: user.id,
        againstId: body.againstId ?? user.id,
        reason: `${body.context}: ${body.subject}`,
        detail: body.againstId
          ? body.detail
          : `[No on-platform counterpart — reported party is outside shortlisted.ph]\n${body.detail}`,
        status: "open",
      },
    });

    return ok({ id: report.id }, { status: 201 });
  } catch (e) {
    return fail(e);
  }
}

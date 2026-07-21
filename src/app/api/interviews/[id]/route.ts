import { z } from "zod";
import { fail, ok, parseBody } from "@/lib/api";
import { db } from "@/lib/db";
import { HttpError, requireEmployer, requireRole } from "@/lib/session";

const Body = z.object({ action: z.literal("cancel") });

/**
 * Employer cancels an interview — allowed only before money changes hands.
 * Once paid, undoing it would need a refund rail the platform does not have,
 * so a paid-or-later interview can't be cancelled here.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRole("employer");
    const employer = await requireEmployer(user.id);
    const { id } = await params;
    await parseBody(req, Body);

    const interview = await db.interview.findUnique({
      where: { id },
      select: { id: true, employerId: true, status: true },
    });
    if (!interview || interview.employerId !== employer.id) {
      throw new HttpError(404, "Interview not found");
    }

    if (interview.status !== "requested" && interview.status !== "consented") {
      throw new HttpError(
        409,
        "This interview can no longer be cancelled — it is already paid or further along",
      );
    }

    await db.interview.update({ where: { id }, data: { status: "cancelled" } });
    await db.auditLog.create({
      data: { actorId: user.id, action: "interview.cancel", target: id },
    });

    return ok({ status: "cancelled" });
  } catch (e) {
    return fail(e);
  }
}

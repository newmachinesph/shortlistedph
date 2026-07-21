import { z } from "zod";
import { db } from "@/lib/db";
import { fail, ok, parseBody } from "@/lib/api";
import { notify } from "@/lib/notify";
import { HttpError, requireRole } from "@/lib/session";

const Body = z.object({ action: z.enum(["consent", "decline"]) });

/**
 * The candidate's consent decision — the one gate that lets the employer be
 * charged. Consent-first: an interview stays "requested" until the person
 * agrees to being interviewed AND recorded, and a decline never takes money.
 *
 * Scoped by talentUserId in the WHERE clause, never a post-fetch check, so a
 * query for someone else's interview returns nothing and 404s without
 * revealing that the row exists. Only valid from "requested".
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await requireRole("talent");
    const { action } = await parseBody(req, Body);

    const interview = await db.interview.findFirst({
      where: { id, talentUserId: user.id },
      select: {
        id: true,
        status: true,
        employer: { select: { userId: true, companyName: true } },
      },
    });
    if (!interview) throw new HttpError(404, "Interview not found");
    if (interview.status !== "requested") {
      throw new HttpError(409, `Already ${interview.status}`);
    }

    const updated = await db.interview.update({
      where: { id: interview.id },
      data: { status: action === "consent" ? "consented" : "declined" },
    });

    await notify({
      userId: interview.employer.userId,
      type: action === "consent" ? "interview_consented" : "interview_declined",
      payload: { company: interview.employer.companyName },
    });

    return ok({ status: updated.status });
  } catch (e) {
    return fail(e);
  }
}

import { z } from "zod";
import { fail, ok, parseBody } from "@/lib/api";
import { db } from "@/lib/db";
import { notify } from "@/lib/notify";
import { HttpError } from "@/lib/session";
import { requireActingInterviewer } from "@/app/interviewer/queries";

/**
 * The interviewer sets or confirms when the recorded call happens. Valid only
 * for an interview that is theirs and is paid or already scheduled — the WHERE
 * clause carries the ownership check, so a foreign or wrong-state id is a 404.
 */
const Body = z.object({
  interviewId: z.string().min(1),
  // datetime-local value, e.g. "2026-08-01T14:30". Parsed and future-checked below.
  scheduledAt: z.string().min(1),
});

export async function POST(req: Request) {
  try {
    const { interviewer } = await requireActingInterviewer();
    const { interviewId, scheduledAt } = await parseBody(req, Body);

    const when = new Date(scheduledAt);
    if (Number.isNaN(when.getTime())) throw new HttpError(422, "Invalid date and time");
    if (when.getTime() < Date.now()) throw new HttpError(422, "Pick a time in the future");

    // Scoped lookup — ownership is the filter, not a check after the fact.
    const interview = await db.interview.findFirst({
      where: { id: interviewId, interviewerId: interviewer.id, status: { in: ["paid", "scheduled"] } },
      select: { id: true, talentUserId: true },
    });
    if (!interview) throw new HttpError(404, "Interview not found");

    // Conditional write, not a bare update: between the read above and here an
    // admin or employer can cancel. An unconditional update resurrected the
    // cancelled interview, which then re-entered the credit-return path and
    // handed back a SECOND credit.
    const { count } = await db.interview.updateMany({
      where: { id: interview.id, status: { in: ["paid", "scheduled"] } },
      data: { scheduledAt: when, status: "scheduled" },
    });
    if (count === 0) throw new HttpError(409, "This interview was cancelled — nothing to schedule");

    await notify({
      userId: interview.talentUserId,
      type: "interview_booked",
      payload: { when: when.toISOString() },
    });

    return ok({ status: "scheduled", scheduledAt: when.toISOString() });
  } catch (e) {
    return fail(e);
  }
}

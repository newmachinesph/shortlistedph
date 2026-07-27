import { z } from "zod";
import { fail, ok, parseBody } from "@/lib/api";
import { db } from "@/lib/db";
import { mail } from "@/lib/email";
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

const LinkBody = z.object({
  interviewId: z.string().min(1),
  meetingUrl: z.string().trim().min(1).max(500),
});

/**
 * The join link is the only thing in the system that lets three strangers meet,
 * so it has to be a link a browser can actually open. Parsed rather than
 * regexed, and https only — a candidate is being asked to click this.
 */
function parseMeetingUrl(raw: string): string {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new HttpError(422, "Paste the full meeting link, starting with https://");
  }
  if (url.protocol !== "https:") throw new HttpError(422, "The meeting link must start with https://");
  if (!url.hostname.includes(".")) throw new HttpError(422, "That link has no real host");
  return url.toString();
}

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
      select: {
        id: true,
        talentUserId: true,
        talent: { select: { email: true, name: true } },
        employer: { select: { userId: true } },
      },
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

    // interview_scheduled, not interview_booked: the booked renderer reads
    // `company`, which this event does not carry, so it rendered "Your
    // interview with An employer is booked" and threw away the time — the only
    // new fact in the event. interview_scheduled was already in the renderer
    // with no writer at all.
    //
    // Both sides, not just the candidate: the employer's page said "we're
    // arranging a time with the interviewer" and had no other way of learning
    // that a time now exists.
    await Promise.all([
      notify({
        userId: interview.talentUserId,
        type: "interview_scheduled",
        payload: { when: when.toISOString() },
      }),
      notify({
        userId: interview.employer.userId,
        type: "interview_scheduled",
        payload: { when: when.toISOString() },
      }),
    ]);

    // The candidate is the one who has to show up at a specific time, and they
    // have no reason to be logged in. Best-effort, post-commit.
    try {
      await mail.interviewScheduled(interview.talent.email, {
        name: interview.talent.name,
        when: when.toLocaleString("en-PH", {
          dateStyle: "full",
          timeStyle: "short",
          timeZone: "Asia/Manila",
        }),
      });
    } catch (e) {
      console.error("[interviewer/schedule] scheduled email failed", e);
    }

    return ok({ status: "scheduled", scheduledAt: when.toISOString() });
  } catch (e) {
    return fail(e);
  }
}

/**
 * The join link for a scheduled call. Separate from the time because it is the
 * one field that decides whether the interview can physically happen — a booked
 * interview with no link is an appointment nobody can attend — and because the
 * interviewer usually creates the meeting after picking the slot.
 */
export async function PATCH(req: Request) {
  try {
    const { interviewer } = await requireActingInterviewer();
    const { interviewId, meetingUrl } = await parseBody(req, LinkBody);
    const url = parseMeetingUrl(meetingUrl);

    const interview = await db.interview.findFirst({
      where: { id: interviewId, interviewerId: interviewer.id, status: { in: ["paid", "scheduled"] } },
      select: { id: true, scheduledAt: true, talentUserId: true, employer: { select: { userId: true } } },
    });
    if (!interview) throw new HttpError(404, "Interview not found");

    // Same conditional-write discipline as the time above: a cancellation
    // landing between the read and the write must not be undone by this.
    const { count } = await db.interview.updateMany({
      where: { id: interview.id, status: { in: ["paid", "scheduled"] } },
      data: { meetingUrl: url },
    });
    if (count === 0) throw new HttpError(409, "This interview was cancelled — nothing to update");

    // Its own type, not a second interview_scheduled: the time and the joinable
    // link are two separate events, and reusing the time's copy would tell both
    // sides their interview had been "scheduled" all over again. The link
    // itself lives on their interviews page, never in a payload.
    const payload: Record<string, string> = interview.scheduledAt
      ? { when: interview.scheduledAt.toISOString() }
      : {};
    await Promise.all([
      notify({ userId: interview.talentUserId, type: "interview_meeting_link", payload }),
      notify({ userId: interview.employer.userId, type: "interview_meeting_link", payload }),
    ]);

    return ok({ meetingUrl: url });
  } catch (e) {
    return fail(e);
  }
}

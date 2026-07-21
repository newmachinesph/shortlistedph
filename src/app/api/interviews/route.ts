import { z } from "zod";
import { fail, ok, parseBody } from "@/lib/api";
import { db } from "@/lib/db";
import { employerPrice, interviewableEntry } from "@/lib/interviews";
import { notify } from "@/lib/notify";
import { HttpError, requireEmployer, requireRole } from "@/lib/session";

// Only ids cross the wire that decide money. The price is never one of them —
// it is derived server-side from the interviewer's own rate, so a tampered body
// can't move what the employer is charged. The optional brief (questions +
// notes) is trimmed and bounded here so nothing unbounded reaches the row.
const MAX_QUESTIONS = 15;
const MAX_QUESTION_LEN = 300;
const MAX_NOTES_LEN = 2000;

const Body = z.object({
  slateEntryId: z.string().min(1),
  interviewerId: z.string().min(1),
  suggestedQuestions: z
    .array(z.string())
    .optional()
    .transform((arr) =>
      (arr ?? [])
        .map((q) => q.trim().slice(0, MAX_QUESTION_LEN))
        .filter((q) => q.length > 0)
        .slice(0, MAX_QUESTIONS),
    ),
  employerNotes: z
    .string()
    .max(MAX_NOTES_LEN)
    .optional()
    .transform((s) => s?.trim() || undefined),
});

/**
 * Employer requests an interview of one candidate on an unlocked shortlist.
 * Consent-first: this only creates the request and asks the candidate — no
 * money moves until they agree and the employer pays.
 */
export async function POST(req: Request) {
  try {
    const user = await requireRole("employer");
    const employer = await requireEmployer(user.id);
    const { slateEntryId, interviewerId, suggestedQuestions, employerNotes } = await parseBody(
      req,
      Body,
    );

    // Unlocked entry that belongs to this employer, or nothing at all.
    const entry = await interviewableEntry(slateEntryId, employer.id);
    if (!entry) throw new HttpError(404, "Candidate not found on any unlocked shortlist of yours");
    const talentUserId = entry.snapshot.profile.userId;

    // Must be bookable right now. The rate is read here, server-side, and
    // locked onto the row — the browser never supplies a price.
    const interviewer = await db.interviewer.findUnique({
      where: { id: interviewerId },
      select: { id: true, status: true, rateUsd: true },
    });
    if (!interviewer || interviewer.status !== "active") {
      throw new HttpError(404, "That interviewer is not available");
    }

    // One live interview per candidate entry. A declined or cancelled one may
    // be retried; anything still in flight blocks a duplicate.
    const existing = await db.interview.findFirst({
      where: { slateEntryId, status: { notIn: ["declined", "cancelled"] } },
      select: { id: true },
    });
    if (existing) throw new HttpError(409, "This candidate already has an interview in progress");

    const interview = await db.interview.create({
      data: {
        slateEntryId,
        employerId: employer.id,
        interviewerId: interviewer.id,
        talentUserId,
        status: "requested",
        // Both amounts frozen now so a later rate change can't move a price the
        // employer has already been shown.
        priceUsd: employerPrice(),
        interviewerPayoutUsd: interviewer.rateUsd,
        // Optional employer brief for the interviewer — bounded above.
        suggestedQuestions,
        employerNotes,
      },
    });

    // The candidate is asked to consent to being interviewed and recorded.
    await notify({
      userId: talentUserId,
      type: "interview_requested",
      payload: { company: employer.companyName, interviewId: interview.id },
    });

    return ok({ interviewId: interview.id, status: interview.status }, { status: 201 });
  } catch (e) {
    return fail(e);
  }
}

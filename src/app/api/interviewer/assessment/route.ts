import { z } from "zod";
import { fail, ok, parseBody } from "@/lib/api";
import { db } from "@/lib/db";
import { notify } from "@/lib/notify";
import { HttpError } from "@/lib/session";
import { RECOMMENDATIONS } from "@/lib/interviews";
import { requireActingInterviewer } from "@/app/interviewer/queries";

/**
 * Files the fixed-template assessment and closes out the interview at
 * "reported". Hard rule: no report without a recording — the interview must be
 * in "recorded" (which only happens once a recordingKey was stored), enforced
 * here on the server. The "recorded" state also makes this idempotent: a second
 * submit finds the interview already "reported" and 404s out.
 */
const score = z.number().int().min(1).max(5);

const Body = z.object({
  interviewId: z.string().min(1),
  recommendation: z.enum(RECOMMENDATIONS),
  overall: score,
  technical: score,
  communication: score,
  englishFluency: score,
  strengths: z.string().trim().min(1).max(4000),
  concerns: z.string().trim().min(1).max(4000),
  notes: z.string().trim().max(4000).optional(),
});

export async function POST(req: Request) {
  try {
    const { interviewer } = await requireActingInterviewer();
    const body = await parseBody(req, Body);

    // Scoped to this interviewer AND to the "recorded" state — a report can't be
    // filed for a foreign interview, nor for one with no recording yet.
    const interview = await db.interview.findFirst({
      where: { id: body.interviewId, interviewerId: interviewer.id, status: "recorded" },
      select: {
        id: true,
        recordingKey: true,
        talentUserId: true,
        employer: { select: { userId: true } },
      },
    });
    if (!interview) {
      throw new HttpError(409, "Upload the recording before filing the assessment");
    }
    // Belt and braces: "recorded" should always carry a key, but never write a
    // report for an interview whose recording somehow isn't there.
    if (!interview.recordingKey) {
      throw new HttpError(409, "Upload the recording before filing the assessment");
    }

    await db.$transaction([
      db.interviewAssessment.create({
        data: {
          interviewId: interview.id,
          recommendation: body.recommendation,
          overall: body.overall,
          technical: body.technical,
          communication: body.communication,
          englishFluency: body.englishFluency,
          strengths: body.strengths,
          concerns: body.concerns,
          notes: body.notes || null,
        },
      }),
      db.interview.update({ where: { id: interview.id }, data: { status: "reported" } }),
    ]);

    // Both parties, not just the buyer. The candidate sat the interview and
    // agreed to be recorded; being the last to know an assessment of them
    // exists — or never knowing — is not a defensible default. Best-effort:
    // the report is filed and the interviewer is owed for it regardless.
    for (const userId of [interview.employer.userId, interview.talentUserId]) {
      try {
        await notify({ userId, type: "interview_reported", payload: {} });
      } catch (e) {
        console.error("[assessment] notification failed", userId, e);
      }
    }

    return ok({ status: "reported" });
  } catch (e) {
    return fail(e);
  }
}

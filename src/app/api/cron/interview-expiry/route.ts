import { timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";
import { fail, ok, requireEnv } from "@/lib/api";
import { HttpError } from "@/lib/session";
import { CLOSED, PAYABLE_TO_INTERVIEWER, cancelInterview } from "@/lib/interviews";

/**
 * Interviews do not wait forever, in any of the three ways they used to.
 *
 * 1. UNANSWERED REQUEST. A "requested" interview sat on the candidate's
 *    decision with no deadline, no reminder and no cleanup — and because the
 *    duplicate guard only ignores declined/cancelled rows, one unanswered
 *    request permanently blocked that slate entry from ever being re-requested.
 *    Nothing was spent at "requested" (a credit is only spent at confirm), so
 *    expiry costs no money and returns none.
 *
 * 2. UNFILED ASSESSMENT. "recorded" was a permanent trap: the call happened,
 *    the employer's credit was spent, and the report — the thing they actually
 *    bought — never arrived. Nobody could cancel it and nothing swept it, so
 *    the credit sat inside a dead row forever. Nothing is taken from the
 *    interviewer by cancelling: PAYABLE_TO_INTERVIEWER is "reported", so a
 *    recorded-only interview was never owed a payout in the first place. If an
 *    operator judges the call worth paying for, that is an ad-hoc payout
 *    decision, not a reason to leave the employer's credit buried.
 *
 * 3. REVOKED INTERVIEWER. The interviewer portal admits active|paused only, so
 *    revoking someone stranded every live assignment they held: no one left in
 *    the system could schedule, record or report it.
 *
 * cancelInterview handles the state change, returning the credit where one was
 * spent, the audit row, and telling all three parties.
 */

const REQUEST_WINDOW_DAYS = 7;

/** How long an interviewer has after the call to file the assessment. */
const REPORT_WINDOW_DAYS = 14;

function providedSecret(req: Request): string {
  const url = new URL(req.url);
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  return bearer || req.headers.get("x-cron-secret") || url.searchParams.get("secret") || "";
}

function secretMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

async function handle(req: Request) {
  try {
    const expected = requireEnv("CRON_SECRET");
    if (!secretMatches(providedSecret(req), expected)) {
      throw new HttpError(401, "Bad cron secret");
    }

    const now = Date.now();
    const requestCutoff = new Date(now - REQUEST_WINDOW_DAYS * 86_400_000);
    const reportCutoff = new Date(now - REPORT_WINDOW_DAYS * 86_400_000);

    const [unanswered, unreported, stranded] = await Promise.all([
      db.interview.findMany({
        where: { status: "requested", createdAt: { lt: requestCutoff } },
        select: { id: true },
      }),
      db.interview.findMany({
        where: {
          status: "recorded",
          // scheduledAt is when the call actually happened. There is no
          // recordedAt column and no route that would write one, so a row that
          // reached "recorded" without a schedule falls back to its own age.
          OR: [
            { scheduledAt: { lt: reportCutoff } },
            { scheduledAt: null, createdAt: { lt: reportCutoff } },
          ],
        },
        select: { id: true },
      }),
      db.interview.findMany({
        // Everything still live: not already closed, and not delivered in full.
        // Read from the same lists interviews.ts enforces, never a second copy.
        where: {
          status: { notIn: [...CLOSED, PAYABLE_TO_INTERVIEWER] },
          interviewer: { status: "revoked" },
        },
        select: { id: true },
      }),
    ]);

    // One row can qualify twice (a recorded interview whose interviewer was
    // also revoked). Keep the first reason and cancel it once.
    const doomed = new Map<string, string>();
    for (const i of unanswered) {
      doomed.set(i.id, `no response within ${REQUEST_WINDOW_DAYS} days`);
    }
    for (const i of unreported) {
      if (!doomed.has(i.id)) doomed.set(i.id, `no assessment filed within ${REPORT_WINDOW_DAYS} days of the call`);
    }
    for (const i of stranded) {
      if (!doomed.has(i.id)) doomed.set(i.id, "the assigned interviewer is no longer active");
    }

    let cancelled = 0;
    for (const [interviewId, reason] of doomed) {
      try {
        await cancelInterview({ actorId: "system:cron", interviewId, reason });
        cancelled++;
      } catch (e) {
        // One bad row must not stop the sweep.
        console.error(`[cron:interview-expiry] could not cancel ${interviewId}`, e);
      }
    }

    console.info(
      `[cron:interview-expiry] cancelled ${cancelled}/${doomed.size} (unanswered ${unanswered.length}, unreported ${unreported.length}, stranded ${stranded.length})`,
    );
    return ok({
      found: doomed.size,
      cancelled,
      unanswered: unanswered.length,
      unreported: unreported.length,
      stranded: stranded.length,
    });
  } catch (e) {
    return fail(e);
  }
}

export const GET = handle;
export const POST = handle;

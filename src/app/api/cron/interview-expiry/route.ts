import { timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";
import { fail, ok, requireEnv } from "@/lib/api";
import { HttpError } from "@/lib/session";
import { cancelInterview } from "@/lib/interviews";

/**
 * Interview requests do not wait forever.
 *
 * A "requested" interview sits on the candidate's decision with no deadline,
 * no reminder and no cleanup — and because the duplicate guard only ignores
 * declined/cancelled rows, one unanswered request permanently blocked that
 * slate entry from ever being re-requested. Consent invitations already expire
 * on a clock; this gives interview requests the same treatment.
 *
 * Nothing was spent at "requested" (a credit is only spent at confirm), so
 * expiry costs no money and returns none. cancelInterview handles the state
 * change, the audit row and telling all three parties.
 */

const REQUEST_WINDOW_DAYS = 7;

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

    const cutoff = new Date(Date.now() - REQUEST_WINDOW_DAYS * 86_400_000);
    const stale = await db.interview.findMany({
      where: { status: "requested", createdAt: { lt: cutoff } },
      select: { id: true },
    });

    let cancelled = 0;
    for (const interview of stale) {
      try {
        await cancelInterview({
          actorId: "system:cron",
          interviewId: interview.id,
          reason: `no response within ${REQUEST_WINDOW_DAYS} days`,
        });
        cancelled++;
      } catch (e) {
        // One bad row must not stop the sweep.
        console.error(`[cron:interview-expiry] could not cancel ${interview.id}`, e);
      }
    }

    console.info(`[cron:interview-expiry] cancelled ${cancelled}/${stale.length} unanswered requests`);
    return ok({ found: stale.length, cancelled });
  } catch (e) {
    return fail(e);
  }
}

export const GET = handle;
export const POST = handle;

import { timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";
import { fail, ok, requireEnv } from "@/lib/api";
import { mail } from "@/lib/email";
import { notify } from "@/lib/notify";
import { HttpError } from "@/lib/session";
import { STALE_DAYS } from "@/lib/availability";

// Skip anyone prompted within this many days — the anti-spam cooldown.
const COOLDOWN_DAYS = 3;
// Cap per run so one invocation can never fan out to the whole table.
const BATCH = 200;

function providedSecret(req: Request): string {
  const url = new URL(req.url);
  // Vercel Cron automatically sends "Authorization: Bearer <CRON_SECRET>" when
  // CRON_SECRET is set on the project, so accept that alongside the manual
  // header/query forms used for local testing.
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  return (
    bearer || req.headers.get("x-cron-secret") || url.searchParams.get("secret") || ""
  );
}

/** Length-checked constant-time compare — timingSafeEqual throws on mismatch. */
function secretMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * The engine behind "we check availability". Finds published talent whose
 * availability is stale or never confirmed and nudges them by email + in-app.
 *
 * Safe to run daily and idempotent enough not to spam: there is no
 * "lastPromptedAt" column, so the anti-spam guard leans on the notification's
 * own recency — anyone sent an availability_check inside COOLDOWN_DAYS is
 * skipped. Confirming clears them out entirely (availabilityConfirmedAt moves
 * forward), so a confirmed candidate is never re-prompted.
 */
async function handle(req: Request) {
  try {
    const expected = requireEnv("CRON_SECRET");
    if (!secretMatches(providedSecret(req), expected)) {
      throw new HttpError(401, "Bad cron secret");
    }

    const now = Date.now();
    const staleBefore = new Date(now - STALE_DAYS * 86_400_000);
    const cooldownAfter = new Date(now - COOLDOWN_DAYS * 86_400_000);

    const due = await db.talentProfile.findMany({
      where: {
        publishedAt: { not: null },
        visibility: true,
        OR: [
          { availabilityConfirmedAt: null },
          { availabilityConfirmedAt: { lt: staleBefore } },
        ],
        user: {
          notifications: {
            none: { type: "availability_check", createdAt: { gt: cooldownAfter } },
          },
        },
      },
      select: { userId: true, user: { select: { email: true, name: true } } },
      take: BATCH,
    });

    let prompted = 0;
    for (const t of due) {
      // Notify first: the notification row is what the next run reads to honour
      // the cooldown, so a failed email can never cost us the spam guard.
      await notify({ userId: t.userId, type: "availability_check", payload: { window: STALE_DAYS } });
      await mail.availabilityPrompt(t.user.email, t.user.name);
      prompted++;
    }

    console.info(
      `[cron:availability-refresh] prompted ${prompted} of ${due.length} due (batch cap ${BATCH})`,
    );
    return ok({ prompted, due: due.length, capped: due.length === BATCH });
  } catch (e) {
    return fail(e);
  }
}

export const GET = handle;
export const POST = handle;

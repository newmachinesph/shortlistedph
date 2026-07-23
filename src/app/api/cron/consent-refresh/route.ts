import { timingSafeEqual } from "node:crypto";
import { db } from "@/lib/db";
import { fail, ok, requireEnv } from "@/lib/api";
import { HttpError } from "@/lib/session";
import { outreachEmailsEnabled } from "@/lib/settings";
import { CONSENT_CAP_MULTIPLIER, sendConsentRequests } from "@/lib/consent";
import { SLATE_SIZE, newConsentToken, rankQualifiedForJd } from "@/lib/matching";

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
 * The hourly heartbeat of consent-first matching.
 *
 * 1. EXPIRE — pending consents whose 48h window (counted from sentAt; unsent
 *    consents have no expiresAt and can never lapse) ran out flip to expired,
 *    and the candidate goes dormant: ONE unanswered request excludes them from
 *    matching until they next log in. Runs regardless of the kill switch —
 *    anyone here was genuinely emailed.
 *
 * 2. BACKFILL — approved slates still short of SLATE_SIZE confirmed-or-waiting
 *    candidates get topped up: first by sending consents that were created but
 *    never emailed (kill switch was off, or a send failed), then by re-running
 *    the ranking and inviting the next qualified candidates. The ranking is
 *    recomputed, never persisted — no queue table. Hard stop once a JD has
 *    burned SLATE_SIZE * 3 consents: pool exhausted, log and move on.
 *    Skipped entirely while the outreach kill switch is off.
 */
async function handle(req: Request) {
  try {
    const expected = requireEnv("CRON_SECRET");
    if (!secretMatches(providedSecret(req), expected)) {
      throw new HttpError(401, "Bad cron secret");
    }

    const now = new Date();

    // ── 1. Expire + one-strike dormancy ─────────────────────────────────
    const lapsed = await db.matchConsent.findMany({
      where: { status: "pending", sentAt: { not: null }, expiresAt: { lt: now } },
      select: { id: true, profileId: true },
    });
    if (lapsed.length > 0) {
      await db.$transaction([
        db.matchConsent.updateMany({
          where: { id: { in: lapsed.map((c) => c.id) } },
          data: { status: "expired" },
        }),
        db.talentProfile.updateMany({
          where: { id: { in: lapsed.map((c) => c.profileId) }, dormantAt: null },
          data: { dormantAt: now },
        }),
      ]);
    }

    // ── 2. Backfill ─────────────────────────────────────────────────────
    let sent = 0;
    let created = 0;
    const exhausted: string[] = [];
    const outreachOn = await outreachEmailsEnabled();

    if (outreachOn) {
      const activeSlates = await db.slate.findMany({
        where: { status: { in: ["preview", "unlocked"] }, jd: { status: "slate_ready" } },
        select: { jdId: true },
      });
      const jdIds = [...new Set(activeSlates.map((s) => s.jdId))];

      for (const jdId of jdIds) {
        const consents = await db.matchConsent.findMany({
          where: { jdId },
          select: { status: true, sentAt: true, profileId: true },
        });
        // Accepted, plus pending ones a candidate is actively deciding on.
        const active = consents.filter(
          (c) => c.status === "accepted" || (c.status === "pending" && c.sentAt),
        ).length;
        let needed = SLATE_SIZE - active;
        if (needed <= 0) continue;

        // 2a. Send created-but-unsent consents before inviting anyone new.
        const resend = await sendConsentRequests(jdId, needed);
        sent += resend.sent;
        needed -= resend.sent;
        if (needed <= 0) continue;

        // 2b. Invite the next qualified candidates, capped.
        const room = SLATE_SIZE * CONSENT_CAP_MULTIPLIER - consents.length;
        if (room <= 0) {
          exhausted.push(jdId);
          console.info(`[cron:consent-refresh] jd ${jdId} hit the consent cap — pool exhausted`);
          continue;
        }
        const jd = await db.jobDescription.findUnique({ where: { id: jdId } });
        if (!jd) continue;
        const { eligible } = await rankQualifiedForJd(jd);
        const already = new Set(consents.map((c) => c.profileId));
        const next = eligible
          .filter((r) => !already.has(r.c.id))
          .slice(0, Math.min(needed, room));
        if (next.length === 0) {
          exhausted.push(jdId);
          console.info(`[cron:consent-refresh] jd ${jdId} has no qualified candidates left — pool exhausted`);
          continue;
        }
        await db.matchConsent.createMany({
          data: next.map((r) => ({ jdId, profileId: r.c.id, token: newConsentToken() })),
          skipDuplicates: true,
        });
        created += next.length;
        const fresh = await sendConsentRequests(jdId, next.length);
        sent += fresh.sent;
      }
    }

    console.info(
      `[cron:consent-refresh] expired ${lapsed.length}, sent ${sent}, created ${created}, exhausted ${exhausted.length}, outreach ${outreachOn ? "on" : "off"}`,
    );
    return ok({ expired: lapsed.length, sent, created, exhausted, outreachOn });
  } catch (e) {
    return fail(e);
  }
}

export const GET = handle;
export const POST = handle;

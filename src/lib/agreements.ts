import "server-only";
import { db } from "./db";
import { refreshProfileEmbeddings } from "./profile-embedding";
import { normalizeSkill } from "./scoring";
import { HttpError } from "./session";

/**
 * Agreements + the monthly outcome loop.
 *
 * An Agreement is born as a draft the moment a talent consents to a
 * connection, seeded with the JD's terms. Signatures are timestamps — the
 * model has no status column, so "active" is always derived: both signed.
 * Each month both parties confirm the period; a doubly-confirmed period is
 * the mutual outcome that flips Engagement.outcome and Skill.confirmed, the
 * trust signals matching consumes.
 */

/** Terms frozen into the Agreement when the talent consents — sourced from the JD. */
export type AgreementTerms = {
  title: string;
  budgetMin: number | null;
  budgetMax: number | null;
  hoursPerWeek: number | null;
  overlap: string | null;
};

/** Stored terms are Json — read defensively, never assume the shape. */
export function readTerms(raw: unknown): AgreementTerms {
  const o = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const num = (v: unknown) => (typeof v === "number" ? v : null);
  return {
    title: typeof o.title === "string" ? o.title : "",
    budgetMin: num(o.budgetMin),
    budgetMax: num(o.budgetMax),
    hoursPerWeek: num(o.hoursPerWeek),
    overlap: typeof o.overlap === "string" ? o.overlap : null,
  };
}

/** "2026-07" — the confirmation period for a moment on the platform clock (Asia/Manila). */
export function currentPeriod(now: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat("en", {
    timeZone: "Asia/Manila",
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);
  const get = (t: Intl.DateTimeFormatPartTypes) => parts.find((p) => p.type === t)?.value ?? "";
  return `${get("year")}-${get("month")}`;
}

/** "2026-07" → "July 2026". */
export function periodLabel(period: string): string {
  const [y, m] = period.split("-").map(Number);
  if (!y || !m) return period;
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-PH", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export type AgreementSide = "talent" | "employer";

/**
 * Loads an agreement and answers "which side of it is this user?".
 * A non-party gets the same 404 as a missing id — existence is not revealed.
 */
export async function agreementForUser(id: string, userId: string) {
  const agreement = await db.agreement.findUnique({
    where: { id },
    include: {
      connection: {
        select: {
          slateEntry: {
            select: {
              snapshot: {
                select: {
                  profileId: true,
                  frozenJson: true,
                  profile: { select: { userId: true } },
                  jd: {
                    select: {
                      title: true,
                      employer: { select: { userId: true, companyName: true } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });
  if (!agreement) throw new HttpError(404, "Agreement not found");

  const snap = agreement.connection.slateEntry.snapshot;
  const side: AgreementSide | null =
    snap.profile.userId === userId
      ? "talent"
      : snap.jd.employer.userId === userId
        ? "employer"
        : null;
  if (!side) throw new HttpError(404, "Agreement not found");

  return { agreement, snap, side };
}

type OutcomeSnapshot = {
  profileId: string;
  frozenJson: unknown;
  jd: { title: string; employer: { companyName: string } };
};

/**
 * Both parties confirmed a period — write the trust signals matching consumes.
 *
 * The schema has no agreement→engagement relation, so the link is derived
 * through the snapshot the agreement descends from: the talent's live profile,
 * the JD title as the role, the employer's company name as the company. That
 * Engagement is found-or-created and flipped to "confirmed", and the Skill
 * rows whose names were frozen into the winning slate entry are confirmed.
 * Every write is idempotent — re-running for a later period is a no-op apart
 * from keeping the engagement confirmed.
 */
export async function applyConfirmedOutcome(snap: OutcomeSnapshot, period: string): Promise<void> {
  const role = snap.jd.title;
  const company = snap.jd.employer.companyName;

  // frozenJson shape is FrozenProfile (lib/slate.ts) — still read defensively.
  const names: string[] = [];
  const frozen = snap.frozenJson as { skills?: unknown } | null;
  if (frozen && Array.isArray(frozen.skills)) {
    for (const s of frozen.skills) {
      if (s && typeof s === "object" && typeof (s as { name?: unknown }).name === "string") {
        names.push((s as { name: string }).name);
      }
    }
  }

  await db.$transaction(async (tx) => {
    // Serialize concurrent confirms for THIS profile so a double-click / retry
    // that completes the pair twice can't race findFirst→create into two
    // duplicate Engagement rows (which would inflate the experience score).
    await tx.$executeRaw`SELECT id FROM "TalentProfile" WHERE id = ${snap.profileId} FOR UPDATE`;

    const engagement = await tx.engagement.findFirst({
      where: { profileId: snap.profileId, role, company },
    });
    if (!engagement) {
      await tx.engagement.create({
        data: {
          profileId: snap.profileId,
          role,
          company,
          span: `${period.slice(0, 4)}–present`,
          outcome: "confirmed",
        },
      });
    } else if (engagement.outcome !== "confirmed") {
      await tx.engagement.update({ where: { id: engagement.id }, data: { outcome: "confirmed" } });
    }

    if (names.length) {
      // Matched on normalizedName, like every other skill comparison in the
      // engine: the snapshot froze the display name, and a talent who re-cases
      // or re-punctuates a skill afterwards must not lose the confirmation.
      await tx.skill.updateMany({
        where: {
          profileId: snap.profileId,
          normalizedName: { in: names.map(normalizeSkill) },
          confirmed: false,
        },
        data: { confirmed: true },
      });
    }
  });

  // Confirming a period is also the platform learning this person is actually
  // working. Capacity follows from that, and until now it did not: they stayed
  // "fully free" and kept collecting invitations they had to decline.
  // syncCommittedHours re-derives and re-embeds on its own when the number
  // moves, so it runs before the embed below decides whether it still needs to.
  let hoursChanged = false;
  try {
    const before = await db.talentProfile.findUnique({
      where: { id: snap.profileId },
      select: { committedHours: true },
    });
    const after = await syncCommittedHours(snap.profileId);
    hoursChanged = before?.committedHours !== after;
  } catch (e) {
    console.error("[agreements] committed-hours sync after confirmed outcome failed", snap.profileId, e);
  }

  // Both writes above change text the profile embeds ("Confirmed skills:", the
  // engagement line), so the platform's core trust signal has to reach the
  // vector now — not whenever the talent next saves something unrelated.
  // Best-effort: a confirmation is DB truth, an embedding is derived and
  // rebuildable, so an OpenAI hiccup must not undo the confirmation.
  //
  // Skipped when the hours sync already re-embedded — that is four API calls,
  // and running them twice for one confirmation buys nothing.
  if (hoursChanged) return;
  try {
    await refreshProfileEmbeddings(snap.profileId);
  } catch (e) {
    console.error("[agreements] re-embed after confirmed outcome failed", snap.profileId, e);
  }
}

/** The period before `currentPeriod()` — "2026-01" rolls back to "2025-12". */
export function previousPeriod(now: Date = new Date()): string {
  const [year, month] = currentPeriod(now).split("-").map(Number);
  return month === 1 ? `${year - 1}-12` : `${year}-${String(month - 1).padStart(2, "0")}`;
}

/** Nobody can commit more than a week holds. Matches the profile form's own cap. */
const MAX_COMMITTED_HOURS = 80;

/**
 * Recompute how much of a talent's week is already spoken for, from the work
 * they are actually confirmed to be doing.
 *
 * A confirmed hire changed nothing about capacity: someone working 40h/week for
 * one employer still scored as fully free, kept being ranked for full-time
 * roles, and kept receiving invitations they had to decline — which rotation
 * now charges them for. `committedHours` already feeds scoreOverlap, the facet
 * text and the Stage 0 hours filter; nothing had ever written it except the
 * talent by hand.
 *
 * DERIVED, never incremented. The monthly OutcomeConfirmation is the only
 * liveness signal this platform has — there is no "engagement ended" event — so
 * hours are summed over agreements confirmed for the current or previous
 * period. That makes this idempotent by construction, and self-correcting: when
 * an engagement quietly ends the confirmations stop, and within a month the
 * hours fall away on their own instead of stranding someone at full capacity
 * forever. Previous period counts too, or every talent would drop to zero on
 * the 1st and climb back as the month's confirmations landed.
 *
 * Returns the value now stored.
 */
export async function syncCommittedHours(profileId: string, now: Date = new Date()): Promise<number> {
  const live = await db.agreement.findMany({
    where: {
      connection: { slateEntry: { snapshot: { profileId } } },
      outcomes: {
        some: {
          period: { in: [currentPeriod(now), previousPeriod(now)] },
          talentConfirmedAt: { not: null },
          employerConfirmedAt: { not: null },
        },
      },
    },
    select: { terms: true },
  });

  const profile = await db.talentProfile.findUnique({
    where: { id: profileId },
    select: { committedHours: true, selfCommittedHours: true, publishedAt: true },
  });
  if (!profile) return 0;

  // Self-reported hours are ADDED, not replaced. Someone can be working
  // somewhere this platform will never hear about, and deriving the total from
  // confirmed agreements alone would silently delete that.
  const hours = Math.min(
    MAX_COMMITTED_HOURS,
    profile.selfCommittedHours +
      live.reduce((total, a) => total + (readTerms(a.terms).hoursPerWeek ?? 0), 0),
  );

  if (profile.committedHours === hours) return hours;

  // lastEditedAt is deliberately NOT touched: it is the anti-tailoring clock,
  // measuring when the CANDIDATE last changed their own story. This is the
  // platform recording a fact about them.
  await db.talentProfile.update({ where: { id: profileId }, data: { committedHours: hours } });

  // Committed hours appear in the preferences facet text, so a published
  // profile's vectors have to follow. Best-effort — the number is the truth,
  // the embedding is derived from it.
  if (profile.publishedAt) {
    try {
      await refreshProfileEmbeddings(profileId);
    } catch (e) {
      console.error("[agreements] re-embed after committed-hours change failed", profileId, e);
    }
  }

  return hours;
}

/** Cap per sweep, so one cron invocation can never fan out to the whole table. */
const HOURS_SWEEP_BATCH = 500;

/**
 * Re-derive committed hours for everyone the number could have moved for.
 *
 * The upward direction has an event to hang off — a period being confirmed.
 * The downward one does not: an engagement ends by the confirmations simply
 * stopping, and nothing fires when something fails to happen. Without a sweep,
 * a talent whose contract quietly ended would sit at full capacity forever,
 * ranked as unavailable for work they are free to take.
 *
 * Scoped to profiles that either carry committed hours now or have an agreement
 * that could add some — the rest have nothing to recompute.
 */
export async function syncAllCommittedHours(now: Date = new Date()): Promise<number> {
  const candidates = await db.talentProfile.findMany({
    where: {
      OR: [
        { committedHours: { gt: 0 } },
        { snapshots: { some: { entries: { some: { connection: { agreement: { isNot: null } } } } } } },
      ],
    },
    select: { id: true },
    take: HOURS_SWEEP_BATCH,
  });

  let changed = 0;
  for (const p of candidates) {
    try {
      const before = await db.talentProfile.findUnique({
        where: { id: p.id },
        select: { committedHours: true },
      });
      const after = await syncCommittedHours(p.id, now);
      if (before?.committedHours !== after) changed++;
    } catch (e) {
      // One bad profile must not stop the sweep for everyone else.
      console.error("[agreements] committed-hours sweep failed for", p.id, e);
    }
  }
  return changed;
}

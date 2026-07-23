import "server-only";
import { db } from "./db";
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

  const engagement = await db.engagement.findFirst({
    where: { profileId: snap.profileId, role, company },
  });
  if (!engagement) {
    await db.engagement.create({
      data: {
        profileId: snap.profileId,
        role,
        company,
        span: `${period.slice(0, 4)}–present`,
        outcome: "confirmed",
      },
    });
  } else if (engagement.outcome !== "confirmed") {
    await db.engagement.update({ where: { id: engagement.id }, data: { outcome: "confirmed" } });
  }

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
  if (names.length) {
    await db.skill.updateMany({
      where: { profileId: snap.profileId, name: { in: names }, confirmed: false },
      data: { confirmed: true },
    });
  }
}

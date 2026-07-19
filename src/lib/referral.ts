import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { db } from "./db";
import { mail } from "./email";
import { HttpError } from "./session";

/**
 * The whole reward rule, in one place.
 *
 * A referred employer's first cleared purchase pays the referrer 20% of it,
 * with no cap.
 *
 * The reward is held in the SAME currency the purchase cleared in — PayPal
 * settles USD, PayMongo settles PHP, and there is no FX rate anywhere in this
 * codebase. Converting here would mean inventing one, so earnings are reported
 * per currency and the operator picks the real rate at payout time.
 */
export const REFERRAL_REWARD = {
  rate: 0.2,
  /** Payouts are always PHP — settlement is manual. */
  payoutCurrency: "PHP" as const,
  /** Applies to the PHP-converted total the operator computes at payout time. */
  minPayout: 500,
} as const;

/** Cookie set by /r/[code], read back when the referred user finishes signup. */
export const REF_COOKIE = "slph_ref";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 90; // 90 days

const CODE_RE = /^[a-z0-9][a-z0-9-]{2,31}$/;

/**
 * Codes live at shortlisted.ph/r/<code>, so anything that could be confused
 * for a real route or an official account is off limits.
 */
const RESERVED = new Set([
  "admin", "api", "login", "register", "talent", "employer", "pricing",
  "terms", "privacy", "r", "www", "help", "support", "about", "new",
  "null", "undefined",
]);

function slugify(name: string): string {
  return name
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);
}

/** Short, unambiguous suffix for collisions. */
function suffix(): string {
  return randomBytes(3).toString("hex");
}

export function validateCode(raw: string): string {
  const code = raw.trim().toLowerCase();
  if (!CODE_RE.test(code)) {
    throw new HttpError(
      422,
      "Use 3–32 characters: lowercase letters, numbers and dashes, starting with a letter or number",
    );
  }
  if (RESERVED.has(code)) throw new HttpError(409, `"${code}" is reserved`);
  return code;
}

export async function getOrCreateReferral(userId: string, name: string) {
  const existing = await db.referral.findUnique({ where: { userId } });
  if (existing) return existing;

  const base = slugify(name);
  // A name can slugify to nothing (all non-ASCII) or to something too short.
  const seed = base.length >= 3 && !RESERVED.has(base) ? base : `ref-${suffix()}`;

  // ponytail: retry loop rather than a pre-check — the unique index is the
  // only thing that can actually settle a race between two signups.
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = attempt === 0 ? seed : `${seed.slice(0, 24)}-${suffix()}`;
    try {
      return await db.referral.create({ data: { userId, code } });
    } catch {
      // Another request may have created this user's referral in the meantime.
      const raced = await db.referral.findUnique({ where: { userId } });
      if (raced) return raced;
    }
  }
  throw new HttpError(500, "Could not allocate a referral code");
}

export async function setCode(userId: string, raw: string) {
  const code = validateCode(raw);
  const owner = await db.referral.findUnique({ where: { code }, select: { userId: true } });
  if (owner && owner.userId !== userId) throw new HttpError(409, `"${code}" is already taken`);

  return db.referral.update({ where: { userId }, data: { code } });
}

/**
 * Hashed with the app secret as salt: enough to spot one IP clicking its own
 * link a hundred times, useless to anyone who steals the table. The raw
 * address is never written anywhere.
 */
function hashIp(ip: string): string {
  const salt = process.env.BETTER_AUTH_SECRET ?? "";
  return createHash("sha256").update(`${ip}:${salt}`).digest("hex").slice(0, 32);
}

export async function recordClick(
  rawCode: string,
  { source, ip, userAgent }: { source?: string; ip?: string; userAgent?: string },
) {
  const code = rawCode.trim().toLowerCase();
  if (!CODE_RE.test(code)) return null;

  const referral = await db.referral.findUnique({ where: { code } });
  if (!referral) return null;

  await db.referralClick.create({
    data: {
      referralId: referral.id,
      source: source?.slice(0, 64),
      ipHash: ip ? hashIp(ip) : undefined,
      userAgent: userAgent?.slice(0, 255),
    },
  });
  return referral;
}

/**
 * Records that `userId` arrived through `code`.
 *
 * Deliberately silent on every failure path — attribution is a side effect of
 * signup, and a bad or self-referred code must never block someone creating
 * an account. Idempotent: the unique index on ReferralConversion.userId means
 * the first referrer keeps the credit no matter how many links are clicked
 * afterwards.
 */
export async function claimAttribution(userId: string, rawCode: string, source?: string) {
  const code = rawCode.trim().toLowerCase();
  if (!CODE_RE.test(code)) return null;

  const referral = await db.referral.findUnique({
    where: { code },
    include: { user: { select: { email: true, name: true } } },
  });
  if (!referral) return null;
  if (referral.userId === userId) return null; // no self-referral

  try {
    const conversion = await db.referralConversion.create({
      data: { referralId: referral.id, userId, source: source?.slice(0, 64) },
    });
    const referred = await db.user.findUnique({ where: { id: userId }, select: { name: true } });
    await mail.referralConverted(referral.user.email, {
      name: referral.user.name,
      referredName: referred?.name ?? "Someone",
      code: referral.code,
    });
    return conversion;
  } catch {
    // Unique violation on userId: already attributed. First referrer wins.
    return null;
  }
}

/**
 * Reads the attribution cookie and claims it. Safe to call on every signed-in
 * read — it is a no-op once the conversion exists.
 */
export async function claimAttributionFromCookie(userId: string) {
  const raw = (await cookies()).get(REF_COOKIE)?.value;
  if (!raw) return null;
  const [code, source] = raw.split("|");
  if (!code) return null;
  return claimAttribution(userId, code, source || undefined);
}

export function refCookieValue(code: string, source?: string) {
  return {
    name: REF_COOKIE,
    value: source ? `${code}|${source}` : code,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  };
}

/**
 * Flips a signed_up conversion to qualified once the referred user pays.
 * Idempotent — a replayed webhook must not double the reward.
 *
 * Takes the payment's own currency and stores the reward in it. Employer
 * purchases clear through PayPal in USD, so rejecting non-PHP here would make
 * the primary referral case unreachable — and because the caller runs this
 * post-commit inside a try/catch, it would fail silently and no affiliate
 * would ever be credited. No conversion happens here by design.
 */
export async function qualifyConversion(
  userId: string,
  { paymentId, amount, currency }: { paymentId: string; amount: number; currency?: string },
) {
  const conversion = await db.referralConversion.findUnique({ where: { userId } });
  if (!conversion || conversion.status !== "signed_up") return null;

  return db.referralConversion.update({
    where: { userId },
    data: {
      status: "qualified",
      rewardAmount: Math.round(amount * REFERRAL_REWARD.rate * 100) / 100,
      currency: currency ?? REFERRAL_REWARD.payoutCurrency,
      paymentId,
      qualifiedAt: new Date(),
    },
  });
}

export type AffiliateStats = Awaited<ReturnType<typeof getAffiliateStats>>;

/** Gross qualified earnings per currency. Never summed across currencies. */
export type EarnedByCurrency = { currency: string; amount: number }[];

const EMPTY_STATS = {
  code: null,
  clicks: 0,
  signups: 0,
  qualified: 0,
  earned: [] as EarnedByCurrency,
  paidPhp: 0,
  unpaidPhp: 0 as number | null,
  activity: [] as {
    id: string;
    name: string;
    status: string;
    source: string | null;
    reward: number | null;
    currency: string | null;
    createdAt: Date;
  }[],
  payouts: [] as Awaited<ReturnType<typeof db.referralPayout.findMany>>,
};

export async function getAffiliateStats(userId: string) {
  const referral = await db.referral.findUnique({ where: { userId } });
  if (!referral) return EMPTY_STATS;

  const [clicks, signups, byCurrency, activity, payouts] = await Promise.all([
    db.referralClick.count({ where: { referralId: referral.id } }),
    db.referralConversion.count({ where: { referralId: referral.id, NOT: { status: "void" } } }),
    // Aggregated in the database — the activity list below is capped at 25, so
    // summing money off that slice would under-report anyone popular.
    db.referralConversion.groupBy({
      by: ["currency"],
      where: { referralId: referral.id, status: "qualified" },
      _sum: { rewardAmount: true },
      _count: { _all: true },
    }),
    db.referralConversion.findMany({
      where: { referralId: referral.id },
      orderBy: { createdAt: "desc" },
      take: 25,
      include: { user: { select: { name: true } } },
    }),
    db.referralPayout.findMany({ where: { userId }, orderBy: { createdAt: "desc" } }),
  ]);

  const earned: EarnedByCurrency = byCurrency
    .map((g) => ({
      currency: g.currency ?? REFERRAL_REWARD.payoutCurrency,
      amount: g._sum.rewardAmount ?? 0,
    }))
    .filter((e) => e.amount > 0)
    .sort((a, b) => a.currency.localeCompare(b.currency));

  const paidPhp = payouts
    .filter((p) => p.status === "paid")
    .reduce((sum, p) => sum + p.amount, 0);

  // Payouts are PHP and settle earnings in every currency, so once a non-PHP
  // reward exists there is no rate here that could turn this into one honest
  // number. null means "the operator works it out at payout time" — better
  // than a confidently wrong balance.
  const phpEarned = earned.find((e) => e.currency === REFERRAL_REWARD.payoutCurrency)?.amount ?? 0;
  const unpaidPhp =
    earned.every((e) => e.currency === REFERRAL_REWARD.payoutCurrency)
      ? Math.round((phpEarned - paidPhp) * 100) / 100
      : null;

  return {
    code: referral.code,
    clicks,
    signups,
    qualified: byCurrency.reduce((n, g) => n + g._count._all, 0),
    earned,
    paidPhp,
    unpaidPhp,
    activity: activity.map((c) => ({
      id: c.id,
      name: c.user.name,
      status: c.status,
      source: c.source,
      reward: c.rewardAmount,
      currency: c.currency,
      createdAt: c.createdAt,
    })),
    payouts,
  };
}

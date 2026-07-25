import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { isUniqueViolation } from "./api";
import { db } from "./db";
import { mail } from "./email";
import { notify } from "./notify";
import { PRODUCTS, type ProductId } from "./payments";
import { REFERRAL_REWARD, commissionFor } from "./referral-reward";
import { HttpError } from "./session";

// The commission rule itself is pure and lives in referral-reward.ts (with its
// test); everything importing it from here keeps working.
export { REFERRAL_REWARD };

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
 *
 * `done` is false only when something transient stopped the write, so the
 * caller knows to keep the cookie for the next request. Every other outcome —
 * claimed, already attributed, self-referred, unknown code — is final and can
 * never change on a retry.
 */
export async function claimAttribution(userId: string, rawCode: string, source?: string) {
  const code = rawCode.trim().toLowerCase();
  if (!CODE_RE.test(code)) return { done: true, conversion: null };

  const referral = await db.referral.findUnique({
    where: { code },
    include: { user: { select: { email: true, name: true } } },
  });
  if (!referral) return { done: true, conversion: null };
  if (referral.userId === userId) return { done: true, conversion: null }; // no self-referral

  try {
    const conversion = await db.referralConversion.create({
      data: { referralId: referral.id, userId, source: source?.slice(0, 64) },
    });
    const referred = await db.user.findUnique({ where: { id: userId }, select: { name: true } });
    await notify({
      userId: referral.userId,
      type: "referral_signup",
      payload: { name: referred?.name ?? "Someone" },
    });
    await mail.referralConverted(referral.user.email, {
      name: referral.user.name,
      referredName: referred?.name ?? "Someone",
      code: referral.code,
    });
    return { done: true, conversion };
  } catch (e) {
    // Unique violation on userId: already attributed. First referrer wins, and
    // there is nothing left for the cookie to do. Anything else is transient —
    // the retry hits the unique index and settles then.
    return { done: isUniqueViolation(e), conversion: null };
  }
}

/**
 * Reads the attribution cookie and claims it. Safe to call on every signed-in
 * read — it is a no-op once the conversion exists.
 *
 * The cookie is dropped as soon as the claim is settled: attribution happens
 * once per account, so keeping it meant 90 days of re-reading a decision that
 * cannot change on any later request.
 */
export async function claimAttributionFromCookie(userId: string) {
  const store = await cookies();
  const raw = store.get(REF_COOKIE)?.value;
  if (!raw) return null;
  const [code, source] = raw.split("|");
  const { done, conversion } = await claimAttribution(userId, code ?? "", source || undefined);
  if (done) {
    try {
      store.delete(REF_COOKIE);
    } catch {
      // Cookies are read-only during a Server Component render, and /referrals
      // calls this from one. The next API request clears it instead.
    }
  }
  return conversion;
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
 * Records the recurring commission for a referred COMPANY's qualifying
 * purchase — EVERY shortlist-credit purchase earns the flat reward, for the
 * lifetime of the referred company, not just the first. Idempotent: the
 * unique index on ReferralCommission.paymentId means a replayed webhook can
 * never pay twice.
 *
 * Two gates, because getting either wrong spends money that does not exist:
 *
 * 1. Only `kind: "credits"` products earn (commissionFor). Interview credits
 *    never earn; the talent verification fee is billed at cost and we keep
 *    none of it, so paying commission on it would come straight out of
 *    nothing. A referred jobseeker earns the affiliate zero.
 * 2. The payer must actually hold an EmployerAccount. Belt and braces: if a
 *    future non-credits product is ever sold to talent, or a credits product
 *    to a non-employer, this stops commissions starting silently.
 *
 * The first commission also flips the conversion to `qualified` — that status
 * is attribution history ("this referral produced a paying company"), not the
 * money. A voided conversion accrues nothing. A referral that never buys
 * stays at `signed_up`, not `void` — a real signup that simply does not earn.
 */
export async function recordCommission(
  userId: string,
  { paymentId, productId }: { paymentId: string; productId: ProductId },
) {
  const reward = commissionFor(PRODUCTS[productId].kind);
  if (!reward) return null;

  const conversion = await db.referralConversion.findUnique({
    where: { userId },
    include: { referral: { select: { userId: true } } },
  });
  if (!conversion || conversion.status === "void") return null;

  const employer = await db.employerAccount.findUnique({
    where: { userId },
    select: { id: true },
  });
  if (!employer) return null;

  let commission;
  try {
    commission = await db.$transaction(async (tx) => {
      const row = await tx.referralCommission.create({
        data: {
          referralId: conversion.referralId,
          conversionId: conversion.id,
          paymentId,
          amount: reward.amount,
          currency: reward.currency,
        },
      });
      if (conversion.status === "signed_up") {
        // ReferralConversion.rewardAmount/currency/paymentId/payoutId are
        // attribution-era history from when the conversion itself held the
        // money. The commission rows are the money now and no aggregate reads
        // those columns, so nothing writes them either — one place claims to
        // hold the reward, not two.
        await tx.referralConversion.update({
          where: { id: conversion.id },
          data: { status: "qualified", qualifiedAt: new Date() },
        });
      }
      return row;
    });
  } catch (e) {
    // Unique violation on paymentId: this payment already earned. Replay-safe.
    if (isUniqueViolation(e)) return null;
    throw e;
  }

  // The recurring pitch is that earnings keep arriving; accruing in silence
  // meant an affiliate only ever found out by opening the page.
  await notify({
    userId: conversion.referral.userId,
    type: "referral_commission",
    payload: { amount: reward.amount, currency: reward.currency },
  });

  return commission;
}

// ─── Payouts ──────────────────────────────────────────────────────────────

/**
 * Every read of commission money filters on this. A voided commission — the
 * purchase was refunded, or the conversion was voided — keeps its row so the
 * history is never silently rewritten, and counts towards nothing: not owed,
 * not earned, not payable. Missing it in one aggregate pays out money that was
 * already clawed back, so the filter is named once and spread everywhere
 * rather than retyped.
 */
export const EARNED = { voidedAt: null } as const;

/** Written by fulfilment's refund path; a refund is never un-voidable. */
export const REFUNDED_REASON = "payment refunded";
/** Written by the admin void action, which IS reversible. */
export const VOIDED_REASON = "conversion voided";

export const PAYOUT_METHODS = ["paypal"] as const;
export type PayoutMethod = (typeof PAYOUT_METHODS)[number];

/**
 * The stored method is a plain column that predates this list (it held
 * gcash|bank), so a row can carry a value we no longer pay to. Anything not on
 * the list is treated as no method at all — the affiliate is asked for details
 * again rather than a payout being requested against a destination nobody
 * settles.
 */
export function isPayoutMethod(m: string | null): m is PayoutMethod {
  return PAYOUT_METHODS.includes(m as PayoutMethod);
}

/**
 * A requested payout is stored in the currency the rewards were EARNED in —
 * USD, because REFERRAL_REWARD.amount is a flat $9 and nothing here has an
 * FX rate to turn that into pesos honestly. ReferralPayout.currency defaults
 * to PHP for older rows; requests written by this code always set it
 * explicitly. The operator converts at the rate on the day they transfer, and
 * both the affiliate UI and the admin UI say so rather than implying the
 * number is what lands in the bank.
 */
export type OwedBalance = { currency: string; amount: number };

/** Two decimal places, so 9.99 * 3 does not become 29.970000000000002. */
function round2(n: number) {
  return Math.round(n * 100) / 100;
}

/**
 * Commissions not yet attached to a payout, grouped by currency. This is the
 * single definition of "owed" — the affiliate page and the request-payout
 * route both read it, so the button and the number agree.
 */
export async function getOwed(referralId: string): Promise<OwedBalance[]> {
  const rows = await db.referralCommission.groupBy({
    by: ["currency"],
    where: { referralId, payoutId: null, ...EARNED },
    _sum: { amount: true },
  });
  return rows
    .map((r) => ({
      currency: r.currency,
      amount: round2(Number(r._sum.amount ?? 0)),
    }))
    .filter((r) => r.amount > 0)
    .sort((a, b) => a.currency.localeCompare(b.currency));
}

export function hasPayoutDetails(r: {
  payoutMethod: string | null;
  payoutAccountNumber: string | null;
}) {
  return isPayoutMethod(r.payoutMethod) && Boolean(r.payoutAccountNumber);
}

export async function savePayoutDetails(
  userId: string,
  d: { method: PayoutMethod; email: string },
) {
  await getOrCreateReferral(userId, "");
  await db.referral.update({
    where: { userId },
    data: {
      payoutMethod: d.method,
      // Same detail column the bank number used to live in — for PayPal the
      // "account number" is the email. No schema change.
      payoutAccountNumber: d.email.trim(),
      payoutAccountName: null,
    },
  });
}

/**
 * Creates the pending ReferralPayout an affiliate is asking for and links the
 * commissions it covers, so the balance cannot be requested twice.
 *
 * The amount is recomputed here from the commissions themselves — the client
 * sends nothing but the intent to be paid.
 *
 * The stored payout method is re-checked here rather than trusted: it is a
 * free-text column from the gcash|bank era, and copying a legacy value forward
 * produces a pending payout pointing at a destination nobody settles.
 */
export async function requestPayout(userId: string) {
  const referral = await db.referral.findUnique({ where: { userId } });
  if (!referral) throw new HttpError(404, "No referral link yet");
  const method = referral.payoutMethod;
  if (!isPayoutMethod(method) || !referral.payoutAccountNumber) {
    throw new HttpError(422, "Add your payout details before requesting a payout");
  }

  return db.$transaction(async (tx) => {
    const pending = await tx.referralPayout.findFirst({ where: { userId, status: "pending" } });
    if (pending) throw new HttpError(409, "You already have a payout request waiting");

    const unpaid = await tx.referralCommission.findMany({
      where: { referralId: referral.id, payoutId: null, ...EARNED },
      select: { id: true, amount: true, currency: true },
    });
    if (unpaid.length === 0) throw new HttpError(409, "Nothing is owed right now");

    // A ReferralPayout holds exactly one currency, so a balance spanning two is
    // two payouts — not an error, and not a rate to invent. Refusing dead-ended
    // the affiliate with nothing but "contact support"; paying one currency per
    // request needs no admin lever and no FX. Reward currency first so the
    // normal case is unchanged, and the rest is requestable once this settles.
    // ponytail: chosen over an admin per-currency settlement screen because
    // every commission is written at REFERRAL_REWARD.currency anyway — a second
    // currency only exists in rows predating that rule.
    const currency =
      unpaid.find((c) => c.currency === REFERRAL_REWARD.currency)?.currency ?? unpaid[0].currency;
    const covered = unpaid.filter((c) => c.currency === currency);
    const amount = round2(covered.reduce((sum, c) => sum + Number(c.amount), 0));

    // Denominated in the reward currency, so it can only be compared against a
    // balance in that same currency. Legacy rows in anything else have no
    // comparable threshold and are payable in full.
    if (currency === REFERRAL_REWARD.currency && amount < REFERRAL_REWARD.minPayout) {
      throw new HttpError(
        409,
        `The minimum payout is ${currency} ${REFERRAL_REWARD.minPayout.toFixed(2)} — you have ${currency} ${amount.toFixed(2)}`,
      );
    }

    const payout = await tx.referralPayout.create({
      data: { userId, amount, currency, method },
    });

    // The payoutId: null guard is what makes a double-click safe: the second
    // request links zero rows and takes its payout row back out.
    // ponytail: relies on the transaction plus this guard rather than a lock.
    const linked = await tx.referralCommission.updateMany({
      where: { id: { in: covered.map((c) => c.id) }, payoutId: null },
      data: { payoutId: payout.id },
    });
    if (linked.count !== covered.length) {
      throw new HttpError(409, "That balance was just claimed by another request");
    }

    return payout;
  });
}

export type AffiliateStats = Awaited<ReturnType<typeof getAffiliateStats>>;

/** Gross qualified earnings per currency. Never summed across currencies. */
export type EarnedByCurrency = { currency: string; amount: number }[];

const EMPTY_STATS = {
  code: null,
  clicks: 0,
  companies: 0,
  otherSignups: 0,
  qualified: 0,
  earned: [] as EarnedByCurrency,
  paid: [] as EarnedByCurrency,
  owed: [] as OwedBalance[],
  hasPayoutDetails: false,
  payoutMethod: null as string | null,
  payoutEmail: null as string | null,
  hasPendingRequest: false,
  activity: [] as {
    id: string;
    name: string;
    isCompany: boolean;
    status: string;
    source: string | null;
    reward: number | null;
    currency: string | null;
    purchases: number;
    createdAt: Date;
  }[],
  payouts: [] as (Awaited<ReturnType<typeof db.referralPayout.findMany>>[number] & {
    amount: number;
  })[],
};

export async function getAffiliateStats(userId: string) {
  const referral = await db.referral.findUnique({ where: { userId } });
  if (!referral) return EMPTY_STATS;

  const live = { referralId: referral.id, NOT: { status: "void" } };
  const [clicks, companies, otherSignups, byCurrency, activity, payoutsRaw, owed] = await Promise.all([
    db.referralClick.count({ where: { referralId: referral.id } }),
    // Only companies can ever earn, so the two are counted apart. A single
    // "signups" number next to zero earnings reads as broken tracking.
    db.referralConversion.count({ where: { ...live, user: { employer: { isNot: null } } } }),
    db.referralConversion.count({ where: { ...live, user: { employer: { is: null } } } }),
    // Aggregated in the database — the activity list below is capped at 25, so
    // summing money off that slice would under-report anyone popular.
    db.referralCommission.groupBy({
      by: ["currency"],
      where: { referralId: referral.id, ...EARNED },
      _sum: { amount: true },
      _count: { _all: true },
    }),
    db.referralConversion.findMany({
      where: { referralId: referral.id },
      orderBy: { createdAt: "desc" },
      take: 25,
      include: {
        user: { select: { name: true, employer: { select: { companyName: true } } } },
        // The recurring earnings from this referred company, newest first —
        // summed below rather than trusted from any single row.
        commissions: { where: EARNED, select: { amount: true, currency: true } },
      },
    }),
    db.referralPayout.findMany({ where: { userId }, orderBy: { createdAt: "desc" } }),
    getOwed(referral.id),
  ]);

  const payouts = payoutsRaw.map((p) => ({ ...p, amount: Number(p.amount) }));

  const earned: EarnedByCurrency = byCurrency
    .map((g) => ({
      currency: g.currency,
      amount: Number(g._sum.amount ?? 0),
    }))
    .filter((e) => e.amount > 0)
    .sort((a, b) => a.currency.localeCompare(b.currency));

  // Settled payouts, grouped by the currency each was requested in. Still
  // never summed across currencies — the grouping is the whole point.
  const paidBy = new Map<string, number>();
  for (const p of payouts.filter((p) => p.status === "paid")) {
    paidBy.set(p.currency, (paidBy.get(p.currency) ?? 0) + Number(p.amount));
  }
  const paid: EarnedByCurrency = [...paidBy.entries()]
    .map(([currency, amount]) => ({ currency, amount: round2(amount) }))
    .sort((a, b) => a.currency.localeCompare(b.currency));

  return {
    code: referral.code,
    clicks,
    companies,
    otherSignups,
    qualified: byCurrency.reduce((n, g) => n + g._count._all, 0),
    earned,
    paid,
    // Unpaid is a real number again: qualified conversions with no payout
    // attached, rather than earned-minus-paid across incompatible currencies.
    owed,
    hasPayoutDetails: hasPayoutDetails(referral),
    // A legacy gcash|bank value reads as no method at all, so the UI reopens
    // the form instead of labelling a bank number "PayPal".
    payoutMethod: isPayoutMethod(referral.payoutMethod) ? referral.payoutMethod : null,
    // The PayPal email, shown back in full — it is the affiliate's own address.
    payoutEmail: referral.payoutAccountNumber,
    hasPendingRequest: payouts.some((p) => p.status === "pending"),
    activity: activity.map((c) => {
      // Lifetime earnings from this one referred company. Single-currency by
      // construction; if a second currency ever appears the row shows the
      // first and the totals above stay authoritative.
      const total = c.commissions.reduce((sum, m) => sum + Number(m.amount), 0);
      return {
        id: c.id,
        // Show the company, not the person who signed up for it.
        name: c.user.employer?.companyName ?? c.user.name,
        isCompany: c.user.employer !== null,
        status: c.status,
        source: c.source,
        reward: total > 0 ? round2(total) : null,
        currency: c.commissions[0]?.currency ?? null,
        purchases: c.commissions.length,
        createdAt: c.createdAt,
      };
    }),
    payouts,
  };
}

// ─── Self-referral signals (operator hints, never a verdict) ──────────────

export type RiskFlag = { code: string; label: string; detail: string };

/**
 * Free providers where two accounts sharing a domain means nothing. A
 * corporate domain shared between affiliate and referred company does mean
 * something, so those still flag.
 */
const FREE_EMAIL_DOMAINS = new Set([
  "gmail.com", "googlemail.com", "yahoo.com", "ymail.com", "outlook.com",
  "hotmail.com", "live.com", "msn.com", "icloud.com", "me.com",
  "proton.me", "protonmail.com", "aol.com", "gmx.com", "zoho.com",
]);

/**
 * Collapses the aliases one person uses to run two accounts:
 * lowercase, drop everything from "+" in the local part, and strip dots.
 *
 * a.n.dres+work@gmail.com and andres@gmail.com both become andres@gmail.com.
 * Dot-stripping is a Gmail rule that not every provider shares, so this
 * deliberately over-matches — it produces a hint for a human, never a block.
 */
export function normaliseEmail(email: string): string {
  const [localRaw = "", domain = ""] = email.trim().toLowerCase().split("@");
  return `${localRaw.split("+")[0].replace(/\./g, "")}@${domain}`;
}

const MINUTE = 60_000;

/**
 * Same-person hints for every qualified conversion, keyed by affiliate userId.
 *
 * Affiliates register a second account rather than being granted a role, so
 * self-referral costs nothing but a spare email. Manual payout approval is the
 * only control, which means the operator has to be shown where to look.
 *
 * These are hints. An empty list means nothing was cheap to detect, NOT that
 * the payout was verified — the UI must say so.
 *
 * ponytail: loads every qualified conversion in one pass, same as the admin
 * page already does. Fine at current volume; page it when the table is slow.
 */
export async function getSelfReferralSignals(): Promise<Map<string, RiskFlag[]>> {
  const conversions = await db.referralConversion.findMany({
    where: { status: "qualified" },
    select: {
      referralId: true,
      createdAt: true,
      qualifiedAt: true,
      user: { select: { id: true, email: true } },
      referral: { select: { userId: true, user: { select: { email: true } } } },
    },
  });
  if (conversions.length === 0) return new Map();

  const userIds = [
    ...new Set(conversions.flatMap((c) => [c.user.id, c.referral.userId])),
  ];
  // Clicks feed only the instant-signup flag, which fires when the last click
  // landed within two minutes of the conversion — so anything outside the
  // conversions' lead window is noise. The bound keeps bot/marketing click
  // volume (which scales much faster than conversions) out of this query.
  const convTimes = conversions.map((c) => c.createdAt.getTime());
  const clickWindow = {
    gte: new Date(Math.min(...convTimes) - 2 * MINUTE),
    lte: new Date(Math.max(...convTimes)),
  };
  const [sessions, clicks] = await Promise.all([
    db.session.findMany({
      where: { userId: { in: userIds }, NOT: { ipAddress: null } },
      select: { userId: true, ipAddress: true },
    }),
    db.referralClick.findMany({
      where: {
        referralId: { in: [...new Set(conversions.map((c) => c.referralId))] },
        createdAt: clickWindow,
      },
      select: { referralId: true, ipHash: true, createdAt: true },
    }),
  ]);

  const ipsByUser = new Map<string, Set<string>>();
  for (const s of sessions) {
    if (!s.ipAddress) continue;
    const set = ipsByUser.get(s.userId) ?? new Set<string>();
    set.add(s.ipAddress);
    ipsByUser.set(s.userId, set);
  }

  const out = new Map<string, RiskFlag[]>();

  for (const c of conversions) {
    const flags: RiskFlag[] = [];
    const affiliateEmail = c.referral.user.email;
    const referredEmail = c.user.email;

    if (normaliseEmail(affiliateEmail) === normaliseEmail(referredEmail)) {
      flags.push({
        code: "same_email",
        label: "same email",
        detail:
          "Both accounts normalise to one address once dots and +aliases are removed. Almost certainly one person.",
      });
    } else {
      const domain = referredEmail.split("@")[1]?.toLowerCase() ?? "";
      if (
        domain &&
        domain === affiliateEmail.split("@")[1]?.toLowerCase() &&
        !FREE_EMAIL_DOMAINS.has(domain)
      ) {
        flags.push({
          code: "same_domain",
          label: "same domain",
          detail: `Both accounts use @${domain}. Could be genuine colleagues — confirm they are different people.`,
        });
      }
    }

    // Session IPs are stored raw, so affiliate and referred user can be
    // compared directly. This is the signal that matters: a click sharing an
    // ipHash with the REFERRED user is expected by construction — that is just
    // the referred person clicking the link they were sent.
    const affiliateIps = ipsByUser.get(c.referral.userId);
    const referredIps = ipsByUser.get(c.user.id);
    if (affiliateIps && referredIps && [...referredIps].some((ip) => affiliateIps.has(ip))) {
      flags.push({
        code: "shared_ip",
        label: "shared IP",
        detail:
          "Affiliate and referred account have signed in from the same address. Common on one office network, expected if it is one person on one machine.",
      });
    }

    // Clicks are not tied to a user, so the best available link to signup is
    // the most recent click on this referral before the conversion existed.
    const priorClicks = clicks
      .filter((k) => k.referralId === c.referralId && k.createdAt <= c.createdAt)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const lastClick = priorClicks[0];
    if (lastClick && c.createdAt.getTime() - lastClick.createdAt.getTime() < 2 * MINUTE) {
      flags.push({
        code: "instant_signup",
        label: "instant signup",
        detail:
          "Signed up within two minutes of the link being clicked — no time spent reading the site.",
      });
    }

    if (c.qualifiedAt && c.qualifiedAt.getTime() - c.createdAt.getTime() < 60 * MINUTE) {
      flags.push({
        code: "instant_purchase",
        label: "bought within the hour",
        detail:
          "Registered and paid inside an hour. Real buyers usually post a job description first.",
      });
    }

    if (flags.length === 0) continue;
    const existing = out.get(c.referral.userId) ?? [];
    // One row per affiliate, so the same flag from two conversions collapses.
    for (const f of flags) {
      if (!existing.some((e) => e.code === f.code)) existing.push(f);
    }
    out.set(c.referral.userId, existing);
  }

  return out;
}

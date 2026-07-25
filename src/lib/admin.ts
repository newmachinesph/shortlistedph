import "server-only";
import { redirect } from "next/navigation";
import { db } from "./db";
import { mail } from "./email";
import { sendConsentRequests } from "./consent";
import { buildSlate } from "./matching";
import { notify } from "./notify";
import { presignDownload } from "./r2";
import { HttpError, requireAdmin, type SessionUser } from "./session";

/**
 * Back-office read models. Server components call these directly.
 *
 * Money note: Payment rows are written by fulfillment.ts with status "paid",
 * and the two providers settle in different currencies (PayPal USD, PayMongo
 * PHP). We never add them together — revenue is grouped by currency and
 * rendered as separate figures.
 */

const PAID = "paid";

/**
 * The page-level gate for the back office.
 *
 * The (panel) layout guards every page under it, but only four pages re-guarded
 * by hand and five relied on the layout alone — so "is this page protected?"
 * had two different answers depending on which file you opened. One call, same
 * behaviour everywhere, and a page moved out of the group keeps its gate.
 */
export async function requireAdminPage(): Promise<SessionUser> {
  try {
    return await requireAdmin();
  } catch (e) {
    if (e instanceof HttpError && e.status === 401) redirect("/admin/login");
    redirect("/");
  }
}

/** A slate only counts as delivered once its JD reached the employer. */
const DELIVERED_JD_STATUSES = ["slate_ready", "closed"];

/** JD statuses an operator can act on from the slates page. */
// no_matches included: after tuning must-haves or thresholds an operator can
// re-run the match without asking the employer to repost.
export const STUCK_JD_STATUSES = ["matching", "rematching", "failed", "no_matches"];

/** "5h ago", "Jul 17". Rendered on the server, so no hydration drift. */
export function timeAgo(date: Date): string {
  const mins = Math.floor((Date.now() - date.getTime()) / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  if (mins < 24 * 60) return `${Math.floor(mins / 60)}h ago`;
  if (mins < 48 * 60) return "yesterday";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

/** Amounts are stored per-provider currency — never summed across them. */
export function money(amount: number, currency: string): string {
  const symbol = currency === "USD" ? "$" : currency === "PHP" ? "₱" : "";
  return `${symbol}${amount.toLocaleString("en-US", { maximumFractionDigits: 2 })}${symbol ? "" : ` ${currency}`}`;
}

export type RevenueLine = { currency: string; total: number };

export type AdminOverview = {
  talentTotal: number;
  talentPublished: number;
  employers: number;
  slatesDelivered: number;
  slatesUnlocked: number;
  revenue: RevenueLine[];
  openReports: number;
  slatesAwaitingUnlock: number;
  jdsMatching: number;
  jdsNoMatches: number;
  pendingInterviewerPayouts: number;
  pendingReferralPayouts: number;
  recentAudit: { id: string; action: string; target: string | null; createdAt: Date }[];
  recentSignups: { id: string; name: string; email: string; role: string; createdAt: Date }[];
  recentPayments: {
    id: string;
    amount: number;
    currency: string;
    purpose: string;
    createdAt: Date;
    user: { name: string };
  }[];
  recentConnections: {
    id: string;
    state: string;
    createdAt: Date;
    slateEntry: { snapshot: { jd: { title: string; employer: { companyName: string } } } };
  }[];
};

/** One round trip for the whole dashboard. */
export async function getAdminOverview(): Promise<AdminOverview> {
  const [
    talentTotal,
    talentPublished,
    employers,
    slatesDelivered,
    slatesUnlocked,
    revenueRows,
    openReports,
    slatesAwaitingUnlock,
    jdsMatching,
    jdsNoMatches,
    pendingInterviewerPayouts,
    pendingReferralPayouts,
    recentAudit,
    recentSignups,
    recentPayments,
    recentConnections,
  ] = await Promise.all([
    db.talentProfile.count(),
    db.talentProfile.count({ where: { publishedAt: { not: null } } }),
    db.employerAccount.count(),
    // "Delivered" means the shortlist actually reached the employer. A slate
    // whose JD was since re-matched, marked failed, or never finished is not
    // delivered — counting those inflated the figure the label promised.
    db.slate.count({ where: { jd: { status: { in: DELIVERED_JD_STATUSES } } } }),
    db.slate.count({ where: { status: "unlocked" } }),
    db.payment.groupBy({ by: ["currency"], where: { status: PAID }, _sum: { amount: true } }),
    db.report.count({ where: { status: "open" } }),
    db.slate.count({ where: { status: "preview" } }),
    db.jobDescription.count({ where: { status: { in: ["matching", "rematching"] } } }),
    db.jobDescription.count({ where: { status: "no_matches" } }),
    db.interviewerPayout.count({ where: { status: "pending" } }),
    db.referralPayout.count({ where: { status: "pending" } }),
    db.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: 12,
      select: { id: true, action: true, target: true, createdAt: true },
    }),
    db.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    }),
    db.payment.findMany({
      where: { status: PAID },
      orderBy: { createdAt: "desc" },
      take: 6,
      select: {
        id: true,
        amount: true,
        currency: true,
        purpose: true,
        createdAt: true,
        user: { select: { name: true } },
      },
    }),
    db.connection.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      select: {
        id: true,
        state: true,
        createdAt: true,
        slateEntry: {
          select: {
            snapshot: {
              select: { jd: { select: { title: true, employer: { select: { companyName: true } } } } },
            },
          },
        },
      },
    }),
  ]);

  return {
    talentTotal,
    talentPublished,
    employers,
    slatesDelivered,
    slatesUnlocked,
    revenue: revenueRows
      .map((r) => ({ currency: r.currency, total: Number(r._sum.amount ?? 0) }))
      .sort((a, b) => b.total - a.total),
    openReports,
    slatesAwaitingUnlock,
    jdsMatching,
    jdsNoMatches,
    pendingInterviewerPayouts,
    pendingReferralPayouts,
    recentAudit,
    recentSignups,
    recentPayments: recentPayments.map((p) => ({ ...p, amount: Number(p.amount) })),
    recentConnections,
  };
}

// ─── Enforcement ─────────────────────────────────────────────────────────

export type UserStatus = "active" | "suspended" | "banned";

/** States where the other side is still waiting on this person. */
const LIVE_CONNECTION_STATES = ["requested", "consented"];

export type EnforcementResult = {
  id: string;
  status: UserStatus;
  from: string;
  sessionsRevoked: number;
  unpublished: boolean;
  counterpartiesNotified: number;
};

/**
 * The one implementation of "make an account inactive".
 *
 * Setting User.status alone was cosmetic: requireUser() rejects the next
 * request, but the live session row still existed, the talent profile stayed
 * in the matching pool, and whoever was mid-conversation with them heard
 * nothing. All four facts move together here, in one transaction, so a report
 * resolution and a direct ban cannot drift apart.
 *
 * Reactivating deliberately does NOT republish a profile. Publishing is the
 * talent's act of consent to be shown to employers; an operator restoring
 * access is not the same as the person choosing to be visible again.
 */
export async function applyUserStatus(args: {
  actorId: string;
  userId: string;
  status: UserStatus;
  action: string;
  meta?: Record<string, string | number>;
}): Promise<EnforcementResult> {
  const target = await db.user.findUnique({
    where: { id: args.userId },
    select: { id: true, status: true, talentProfile: { select: { id: true, publishedAt: true } } },
  });
  if (!target) throw new HttpError(404, "User not found");
  if (target.id === args.actorId) throw new HttpError(409, "You cannot change your own status");

  const inactive = args.status !== "active";
  const willUnpublish = inactive && target.talentProfile?.publishedAt != null;

  // Read before the write: once the profile is unpublished and sessions are
  // gone, the people owed a heads-up are harder to find.
  const live = inactive ? await liveCounterparties(args.userId) : [];

  const sessionsRevoked = await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id: target.id }, data: { status: args.status } });

    // Kick them out now. Without this the account stays usable for the life
    // of the existing session cookie.
    const { count } = inactive
      ? await tx.session.deleteMany({ where: { userId: target.id } })
      : { count: 0 };

    if (willUnpublish) {
      await tx.talentProfile.update({
        where: { id: target.talentProfile!.id },
        data: { publishedAt: null },
      });
    }

    await tx.auditLog.create({
      data: {
        actorId: args.actorId,
        action: args.action,
        target: target.id,
        meta: {
          ...args.meta,
          from: target.status,
          to: args.status,
          sessionsRevoked: count,
          unpublished: willUnpublish,
        },
      },
    });

    return count;
  });

  // Post-commit. notify() swallows its own failures — a bell icon that did not
  // light up must not undo a ban that did.
  for (const c of live) {
    await notify({
      userId: c.counterpartyUserId,
      type: "counterparty_unavailable",
      payload: { connectionId: c.connectionId, jobTitle: c.jobTitle },
    });
  }

  return {
    id: target.id,
    status: args.status,
    from: target.status,
    sessionsRevoked,
    unpublished: willUnpublish,
    counterpartiesNotified: live.length,
  };
}

/** Whoever is on the other end of this user's still-open connections. */
async function liveCounterparties(userId: string) {
  const rows = await db.connection.findMany({
    where: {
      state: { in: LIVE_CONNECTION_STATES },
      OR: [
        { slateEntry: { snapshot: { profile: { userId } } } },
        { slateEntry: { slate: { jd: { employer: { userId } } } } },
      ],
    },
    select: {
      id: true,
      slateEntry: {
        select: {
          snapshot: {
            select: {
              profile: { select: { userId: true } },
              jd: { select: { title: true, employer: { select: { userId: true } } } },
            },
          },
        },
      },
    },
  });

  return rows.map((r) => {
    const snap = r.slateEntry.snapshot;
    const talentUserId = snap.profile.userId;
    return {
      connectionId: r.id,
      jobTitle: snap.jd.title,
      counterpartyUserId: talentUserId === userId ? snap.jd.employer.userId : talentUserId,
    };
  });
}

/**
 * Operator takedown of published profile content. Only ever unpublishes:
 * republishing is the talent's call, made from their own dashboard.
 */
export async function unpublishProfile(args: { actorId: string; userId: string }) {
  const profile = await db.talentProfile.findUnique({
    where: { userId: args.userId },
    select: { id: true, publishedAt: true },
  });
  if (!profile) throw new HttpError(404, "This account has no talent profile");
  if (!profile.publishedAt) throw new HttpError(409, "Profile is already unpublished");

  await db.$transaction([
    db.talentProfile.update({ where: { id: profile.id }, data: { publishedAt: null } }),
    db.auditLog.create({
      data: {
        actorId: args.actorId,
        action: "admin.profile.unpublish",
        target: args.userId,
        meta: { profileId: profile.id, publishedAt: profile.publishedAt.toISOString() },
      },
    }),
  ]);

  return { id: args.userId, unpublished: true };
}

export const TALENT_LEVERS = ["dormancy", "flags", "rate_lock"] as const;
export type TalentLever = (typeof TALENT_LEVERS)[number];

const NOTHING_TO_CLEAR: Record<TalentLever, string> = {
  dormancy: "This profile is not dormant",
  flags: "This profile has no flags",
  rate_lock: "This profile has no rate lock",
};

/**
 * Clear one of the three talent states nothing else can reach.
 *
 * Dormancy is set when a consent request expires unanswered and clears only on
 * a visit to the talent workspace — which the migrated, password-less pool
 * cannot do, so one missed email excluded them from matching forever. `flags`
 * marks a resume that tried to instruct the extractor: a human has to review it
 * and then say so. `rateLockedUntil` holds a typo'd rate on a live profile for
 * 30 days. All three are one-way today; this is the way back.
 */
export async function clearTalentLever(args: {
  actorId: string;
  userId: string;
  lever: TalentLever;
}) {
  const profile = await db.talentProfile.findUnique({
    where: { userId: args.userId },
    select: { id: true, dormantAt: true, flags: true, rateLockedUntil: true },
  });
  if (!profile) throw new HttpError(404, "This account has no talent profile");

  // What is being erased, recorded in the audit meta — an operator asking
  // "what was cleared here?" later has no other copy of it.
  const cleared =
    args.lever === "dormancy"
      ? (profile.dormantAt?.toISOString() ?? null)
      : args.lever === "flags"
        ? (profile.flags.join(", ") || null)
        : (profile.rateLockedUntil?.toISOString() ?? null);
  if (!cleared) throw new HttpError(409, NOTHING_TO_CLEAR[args.lever]);

  const data =
    args.lever === "dormancy"
      ? { dormantAt: null }
      : args.lever === "flags"
        ? { flags: [] }
        : { rateLockedUntil: null };

  await db.$transaction([
    db.talentProfile.update({ where: { id: profile.id }, data }),
    db.auditLog.create({
      data: {
        actorId: args.actorId,
        action: `admin.talent.${args.lever}.clear`,
        target: args.userId,
        meta: { profileId: profile.id, cleared },
      },
    }),
  ]);

  return { id: args.userId, lever: args.lever, cleared };
}

/**
 * Grant, deduct, or set an employer's credits by hand — comps, refunds,
 * corrections, or a support gesture. `kind` picks which balance: "shortlist"
 * (unlock a slate) or "interview" (book one interview each). Every change is
 * audited with the before/after balance and a reason, and a positive grant lays
 * down matching Entitlement rows (source "admin_grant") so the ledger stays
 * consistent with how a real purchase records them.
 *
 * Either `set` (absolute) or `delta` (relative) — not both. Balance never goes
 * below zero.
 */
export async function adjustEmployerCredits(args: {
  actorId: string;
  userId: string;
  kind: "shortlist" | "interview";
  set?: number;
  delta?: number;
  reason: string;
}) {
  if ((args.set == null) === (args.delta == null)) {
    throw new HttpError(400, "Pass exactly one of set or delta");
  }

  const isInterview = args.kind === "interview";

  const { employer, before, after } = await db.$transaction(async (tx) => {
    const employer = await tx.employerAccount.findUnique({
      where: { userId: args.userId },
      select: { id: true, credits: true, interviewCredits: true, companyName: true },
    });
    if (!employer) throw new HttpError(404, "This account is not an employer");

    const before = isInterview ? employer.interviewCredits : employer.credits;
    const after = Math.max(0, args.set != null ? args.set : before + args.delta!);
    const granted = after - before;

    // Conditional on the balance just read: if a concurrent purchase or spend
    // moved it between read and write, this matches 0 rows and the admin
    // retries against fresh numbers instead of silently clobbering that write.
    const updated = await tx.employerAccount.updateMany({
      where: {
        id: employer.id,
        ...(isInterview ? { interviewCredits: before } : { credits: before }),
      },
      data: isInterview ? { interviewCredits: after } : { credits: after },
    });
    if (updated.count === 0) {
      throw new HttpError(409, "Balance changed while adjusting — reload and retry");
    }
    if (granted > 0) {
      await tx.entitlement.createMany({
        data: Array.from({ length: granted }, () => ({
          employerId: employer.id,
          kind: isInterview ? "interview_credit" : "credit",
          source: "admin_grant",
        })),
      });
    }
    await tx.auditLog.create({
      data: {
        actorId: args.actorId,
        action: isInterview ? "admin.interview_credits.adjust" : "admin.credits.adjust",
        target: args.userId,
        meta: { employerId: employer.id, kind: args.kind, before, after, reason: args.reason },
      },
    });
    return { employer, before, after };
  });

  return { id: args.userId, company: employer.companyName, kind: args.kind, before, after };
}

// ─── Credit reconciliation ───────────────────────────────────────────────

export const CREDIT_KINDS = ["credit", "interview_credit"] as const;
export type CreditKind = (typeof CREDIT_KINDS)[number];

export type CreditLine = {
  key: string;
  employerId: string;
  userId: string;
  company: string;
  kind: CreditKind;
  /** The counter the app spends against. */
  balance: number;
  sold: number;
  granted: number;
  spent: number;
  revoked: number;
  /** Unspent and unrevoked entitlements — what the balance is supposed to be. */
  available: number;
  drift: number;
};

/**
 * Sold vs granted vs spent vs revoked, per employer and in total.
 *
 * The invariant: count(unspent, unrevoked) entitlements of a kind equals that
 * employer's balance column. Nothing enforced it and nothing surfaced it, so a
 * spend that decremented the counter without marking a row (or an admin
 * deduction that orphaned one) drifted silently and forever. `drift` is the
 * whole point of this view — non-zero means the two ledgers disagree.
 */
export async function getCreditReconciliation() {
  // ponytail: reduced in JS over every entitlement — one credit is one row, so
  // this stays small for a long while. Move to SQL aggregates if it doesn't.
  const [employers, entitlements] = await Promise.all([
    db.employerAccount.findMany({
      select: { id: true, userId: true, companyName: true, credits: true, interviewCredits: true },
    }),
    db.entitlement.findMany({
      select: {
        employerId: true,
        kind: true,
        source: true,
        spentOnSlateId: true,
        spentOnInterviewId: true,
        revokedAt: true,
      },
    }),
  ]);

  const lines = new Map<string, CreditLine>();
  for (const e of employers) {
    for (const kind of CREDIT_KINDS) {
      const key = `${e.id}:${kind}`;
      lines.set(key, {
        key,
        employerId: e.id,
        userId: e.userId,
        company: e.companyName,
        kind,
        balance: kind === "interview_credit" ? e.interviewCredits : e.credits,
        sold: 0,
        granted: 0,
        spent: 0,
        revoked: 0,
        available: 0,
        drift: 0,
      });
    }
  }

  for (const row of entitlements) {
    const line = lines.get(`${row.employerId}:${row.kind}`);
    // An entitlement whose employer is gone has no balance to reconcile against.
    if (!line) continue;
    if (row.source === "admin_grant") line.granted += 1;
    else line.sold += 1;
    if (row.revokedAt) line.revoked += 1;
    else if (row.spentOnSlateId || row.spentOnInterviewId) line.spent += 1;
    else line.available += 1;
  }

  const rows = [...lines.values()]
    .map((l) => ({ ...l, drift: l.available - l.balance }))
    // An employer who never had a credit of this kind is noise on the page.
    .filter((l) => l.balance !== 0 || l.sold + l.granted > 0)
    .sort((a, b) => Math.abs(b.drift) - Math.abs(a.drift) || a.company.localeCompare(b.company));

  const blank = { balance: 0, sold: 0, granted: 0, spent: 0, revoked: 0, available: 0 };
  const totals = Object.fromEntries(
    CREDIT_KINDS.map((kind) => {
      const of = rows.filter((r) => r.kind === kind);
      return [
        kind,
        of.reduce(
          (sum, r) => ({
            balance: sum.balance + r.balance,
            sold: sum.sold + r.sold,
            granted: sum.granted + r.granted,
            spent: sum.spent + r.spent,
            revoked: sum.revoked + r.revoked,
            available: sum.available + r.available,
          }),
          blank,
        ),
      ];
    }),
  ) as Record<CreditKind, typeof blank>;

  return { rows, totals, drifting: rows.filter((r) => r.drift !== 0).length };
}

// ─── Stuck-JD recovery ───────────────────────────────────────────────────

/**
 * Re-run matching for a JD that never came back.
 *
 * The claim is the lock: flipping "matching" → "rematching" in one conditional
 * UPDATE means a second operator (or a double-click) loses the race and gets a
 * 409 instead of a second slate. buildSlate sets the terminal status itself, so
 * "rematching" only persists while a run is genuinely in flight.
 *
 * ponytail: status-as-lock, released by restoring "matching" if buildSlate
 * throws. A run killed mid-flight (deploy, timeout) leaves the JD on
 * "rematching" — the operator's other lever, mark-failed, accepts that state.
 * Swap for a queue with a lease when matching moves off the request path.
 */
export async function rematchJd(args: { actorId: string; jdId: string }) {
  // Claimable from "matching" (wedged run) and "no_matches" (re-run after the
  // operator tunes must-haves/thresholds). "failed" stays terminal by design.
  const claimed = await db.jobDescription.updateMany({
    where: { id: args.jdId, status: { in: ["matching", "no_matches"] } },
    data: { status: "rematching" },
  });
  if (claimed.count !== 1) {
    const jd = await db.jobDescription.findUnique({
      where: { id: args.jdId },
      select: { status: true },
    });
    if (!jd) throw new HttpError(404, "Job description not found");
    throw new HttpError(409, `Cannot re-run matching for a job description that is "${jd.status}"`);
  }

  await db.auditLog.create({
    data: { actorId: args.actorId, action: "admin.jd.rematch", target: args.jdId },
  });

  try {
    return await buildSlate(args.jdId);
  } catch (e) {
    // Hand the lock back so the JD stays retryable rather than wedged again.
    await db.jobDescription.updateMany({
      where: { id: args.jdId, status: "rematching" },
      data: { status: "matching" },
    });
    throw e;
  }
}

/** Give up on a JD nobody can rescue. Terminal, and says so to the employer. */
export async function failJd(args: { actorId: string; jdId: string; note?: string }) {
  const { count } = await db.jobDescription.updateMany({
    where: { id: args.jdId, status: { in: ["matching", "rematching"] } },
    data: { status: "failed" },
  });
  if (count !== 1) throw new HttpError(409, "Only a job description still matching can be marked failed");

  await db.auditLog.create({
    data: {
      actorId: args.actorId,
      action: "admin.jd.fail",
      target: args.jdId,
      meta: args.note ? { note: args.note } : undefined,
    },
  });

  return { id: args.jdId, status: "failed" };
}

/**
 * Releases a slate to its employer. buildSlate creates every slate as
 * "pending_review"; the employer sees nothing and hears nothing until an
 * operator approves it here — and no CANDIDATE is emailed either. Approval is
 * the moment the consent requests go out (sendConsentRequests stamps sentAt +
 * the 48h expiresAt per email). Both employer and candidate mail ride the
 * outreach kill switch; suppressed consents stay unsent and unexpirable, and
 * the consent-refresh cron retries them once outreach is back on.
 */
export async function approveSlate(args: { actorId: string; slateId: string }) {
  // Conditional flip is the lock: a double-click or second operator matches
  // 0 rows and gets a 409 instead of a duplicate notify/email.
  const { count } = await db.slate.updateMany({
    where: { id: args.slateId, status: "pending_review" },
    data: { status: "preview" },
  });
  if (count !== 1) {
    const slate = await db.slate.findUnique({ where: { id: args.slateId }, select: { status: true } });
    if (!slate) throw new HttpError(404, "Slate not found");
    throw new HttpError(409, `Only a slate awaiting review can be approved — this one is "${slate.status}"`);
  }

  await db.auditLog.create({
    data: { actorId: args.actorId, action: "admin.slate.approve", target: args.slateId },
  });

  // Post-approval delivery, best-effort: a bounced email must not undo an
  // approval that already happened.
  try {
    const slate = await db.slate.findUnique({
      where: { id: args.slateId },
      select: {
        jd: {
          select: {
            id: true,
            title: true,
            _count: { select: { matchConsents: true } },
            employer: { select: { companyName: true, user: { select: { id: true, email: true } } } },
          },
        },
      },
    });
    const employer = slate?.jd.employer;
    if (slate && employer) {
      // In-app row and email are separate deliveries of the same fact. The
      // email can bounce; the bell has to be right either way. Count = matches
      // being confirmed, not entries — the slate is empty until candidates say yes.
      await notify({
        userId: employer.user.id,
        type: "slate_delivered",
        payload: {
          company: employer.companyName,
          jobTitle: slate.jd.title,
          count: slate.jd._count.matchConsents,
          jdId: slate.jd.id,
        },
      });

      await mail.slateDelivered(employer.user.email, {
        company: employer.companyName,
        jobTitle: slate.jd.title,
        count: slate.jd._count.matchConsents,
        jdId: slate.jd.id,
      });

      // Candidate outreach starts only now, after an operator vouched for the
      // slate. Each send stamps its own sentAt + 48h expiry inside.
      const { sent } = await sendConsentRequests(slate.jd.id);
      console.info(`[admin] slate ${args.slateId} approved — ${sent} consent request(s) sent`);
    }
  } catch (e) {
    console.error("[admin] slate-approved delivery failed", e);
  }

  return { id: args.slateId, status: "preview" };
}

export const USERS_PAGE_SIZE = 25;

export const USER_ROLES = ["talent", "employer", "interviewer", "admin"] as const;
export const USER_STATUSES = ["active", "suspended", "banned"] as const;

/** Profiles a resume-injection flag routed to a human. */
const FLAGGED = { talentProfile: { flags: { isEmpty: false } } } as const;

export async function listUsers(opts: {
  q?: string;
  role?: string;
  status?: string;
  flagged?: boolean;
  page?: number;
}) {
  const page = Math.max(1, opts.page ?? 1);
  const q = opts.q?.trim();
  // Unknown values from the URL fall back to "no filter" rather than a 500.
  const role = (USER_ROLES as readonly string[]).includes(opts.role ?? "") ? opts.role : undefined;
  const status = (USER_STATUSES as readonly string[]).includes(opts.status ?? "")
    ? opts.status
    : undefined;

  // Search and status apply to every role tab; role picks the tab. The tab
  // counts share the first two, so each tab shows how many rows it holds under
  // the current search — not a site-wide total that stops matching the list.
  const base = {
    ...(q
      ? {
          OR: [
            { email: { contains: q, mode: "insensitive" as const } },
            { name: { contains: q, mode: "insensitive" as const } },
          ],
        }
      : {}),
    ...(status ? { status } : {}),
  };
  const where = {
    ...base,
    ...(role ? { role } : {}),
    ...(opts.flagged ? FLAGGED : {}),
  };

  const [total, users, roleGroups, flaggedCount] = await Promise.all([
    db.user.count({ where }),
    db.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * USERS_PAGE_SIZE,
      take: USERS_PAGE_SIZE,
      select: {
        id: true,
        name: true,
        email: true,
        image: true,
        role: true,
        status: true,
        createdAt: true,
        talentProfile: {
          select: {
            headline: true,
            city: true,
            publishedAt: true,
            verifiedTier: true,
            rateUsd: true,
            flags: true,
            dormantAt: true,
            rateLockedUntil: true,
          },
        },
        employer: { select: { companyName: true, location: true, credits: true, interviewCredits: true } },
        interviewer: { select: { status: true, rateUsd: true } },
      },
    }),
    db.user.groupBy({ by: ["role"], where: base, _count: true }),
    db.user.count({ where: { ...base, ...FLAGGED } }),
  ]);

  const roleCounts: Record<string, number> = {};
  for (const g of roleGroups) roleCounts[g.role] = g._count;

  return {
    users,
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / USERS_PAGE_SIZE)),
    roleCounts,
    flaggedCount,
    role,
    status,
    flagged: opts.flagged === true,
  };
}

/**
 * Evidence lives in R2 under opaque object keys. Rendering the key is not
 * evidence — the operator has to be able to open the file before deciding.
 * URLs are signed per request and expire, so nothing durable leaks into
 * browser history or a screenshot of the page.
 */
const EVIDENCE_TTL_SECONDS = 600;

export type Evidence = { key: string; url: string | null };

async function signEvidence(keys: string[]): Promise<Evidence[]> {
  return Promise.all(
    keys.map(async (key) => {
      try {
        return { key, url: await presignDownload(key, EVIDENCE_TTL_SECONDS) };
      } catch (e) {
        // R2 unconfigured or the key is gone: show the key, not a 500. The
        // rest of the report is still adjudicable.
        console.error("[admin] could not sign evidence", key, e);
        return { key, url: null };
      }
    }),
  );
}

export async function listReports(status?: string) {
  const reports = await db.report.findMany({
    where: status ? { status } : {},
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 100,
    include: {
      filedBy: { select: { id: true, name: true, email: true, role: true } },
      against: { select: { id: true, name: true, email: true, role: true, status: true } },
    },
  });

  return Promise.all(
    reports.map(async (r) => ({ ...r, evidence: await signEvidence(r.evidenceKeys) })),
  );
}

/**
 * JDs that never made it out of matching. publish/route.ts runs buildSlate
 * inline, so a request that dies mid-run leaves the JD wedged with no lever —
 * these are the rows the operator needs a lever for.
 */
export async function listStuckJds() {
  return db.jobDescription.findMany({
    where: { status: { in: STUCK_JD_STATUSES } },
    orderBy: { publishedAt: "desc" },
    take: 50,
    select: {
      id: true,
      title: true,
      status: true,
      publishedAt: true,
      createdAt: true,
      employer: { select: { companyName: true } },
    },
  });
}

/**
 * One slate with everything an operator needs to approve it with eyes open:
 * the JD it answers, and every entry UNMASKED. Admin review is exempt from
 * the employer paywall by design — names resolve the same way getSlateForJd
 * does for unlocked slates (snapshot.profileId → user.name).
 */
export async function getSlateForReview(slateId: string) {
  const slate = await db.slate.findUnique({
    where: { id: slateId },
    select: {
      id: true,
      status: true,
      deliveredAt: true,
      unlockedAt: true,
      jd: {
        select: {
          id: true,
          title: true,
          status: true,
          mustHaves: true,
          niceToHaves: true,
          budgetMin: true,
          budgetMax: true,
          hoursPerWeek: true,
          overlap: true,
          publicTitle: true,
          roleFamily: true,
          industry: true,
          clientRegion: true,
          listedAt: true,
          employer: { select: { companyName: true } },
        },
      },
      entries: {
        orderBy: { rank: "asc" },
        select: {
          id: true,
          rank: true,
          score: true,
          dims: true,
          reasons: true,
          snapshot: { select: { frozenJson: true, profileId: true } },
        },
      },
    },
  });
  if (!slate) return null;

  const [profiles, consents, eliminations] = await Promise.all([
    db.talentProfile.findMany({
      where: { id: { in: slate.entries.map((e) => e.snapshot.profileId) } },
      select: { id: true, user: { select: { name: true, image: true } } },
    }),
    // Proposed candidates = the consent rows, in invitation order. Score lives
    // on the entry a consent becomes when accepted — here rank order is enough.
    db.matchConsent.findMany({
      where: { jdId: slate.jd.id },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        status: true,
        sentAt: true,
        respondedAt: true,
        expiresAt: true,
        profile: { select: { user: { select: { name: true, image: true } } } },
      },
    }),
    // Stage 0 is where a thin slate usually comes from: the pool was cut before
    // ranking ever ran. Written per JD by the engine and, until now, read by
    // nobody — an operator staring at an empty slate had no way to see why.
    db.matchElimination.groupBy({
      by: ["reason"],
      where: { jdId: slate.jd.id },
      _count: true,
    }),
  ]);
  const byProfile = new Map(profiles.map((p) => [p.id, p.user]));

  return {
    ...slate,
    eliminations: eliminations
      .map((e) => ({ reason: e.reason, count: e._count }))
      .sort((a, b) => b.count - a.count),
    entries: slate.entries.map((e) => ({
      ...e,
      name: byProfile.get(e.snapshot.profileId)?.name ?? "Unknown",
      image: byProfile.get(e.snapshot.profileId)?.image ?? null,
    })),
    consents: consents.map((c) => ({
      id: c.id,
      // "pending" splits on whether the email actually went out yet.
      status: c.status === "pending" ? (c.sentAt ? "sent" : "pending") : c.status,
      sentAt: c.sentAt,
      respondedAt: c.respondedAt,
      expiresAt: c.expiresAt,
      name: c.profile.user.name,
      image: c.profile.user.image,
    })),
  };
}

/**
 * The openings board, both sides of it.
 *
 * The "list publicly" form only ever rendered inside slate review, so a JD with
 * no slate could never be listed and a live listing could never be audited or
 * pulled. Listed rows come first because auditing what is public is the reason
 * to open this page; `listable` is every other published brief.
 */
export async function listOpenings() {
  const jds = await db.jobDescription.findMany({
    where: { publishedAt: { not: null } },
    orderBy: [{ listedAt: "desc" }, { publishedAt: "desc" }],
    take: 100,
    select: {
      id: true,
      title: true,
      status: true,
      publicTitle: true,
      roleFamily: true,
      industry: true,
      clientRegion: true,
      listedAt: true,
      publishedAt: true,
      employer: { select: { companyName: true } },
      slates: { orderBy: { deliveredAt: "desc" }, take: 1, select: { id: true } },
    },
  });

  return {
    listed: jds.filter((jd) => jd.listedAt != null),
    listable: jds.filter((jd) => jd.listedAt == null),
  };
}

export async function listSlates(status?: "pending_review" | "preview" | "unlocked") {
  return db.slate.findMany({
    where: status ? { status } : {},
    orderBy: { deliveredAt: "desc" },
    take: 100,
    select: {
      id: true,
      status: true,
      deliveredAt: true,
      unlockedAt: true,
      _count: { select: { entries: true } },
      jd: {
        select: { id: true, title: true, status: true, employer: { select: { companyName: true } } },
      },
    },
  });
}

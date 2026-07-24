import "server-only";
import { db } from "./db";
import { mail } from "./email";
import { sendConsentRequests } from "./consent";
import { buildSlate } from "./matching";
import { notify } from "./notify";
import { presignDownload } from "./r2";
import { HttpError } from "./session";

/**
 * Back-office read models. Server components call these directly.
 *
 * Money note: Payment rows are written by fulfillment.ts with status "paid",
 * and the two providers settle in different currencies (PayPal USD, PayMongo
 * PHP). We never add them together — revenue is grouped by currency and
 * rendered as separate figures.
 */

const PAID = "paid";

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

export async function listUsers(opts: { q?: string; role?: string; status?: string; page?: number }) {
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
  const where = role ? { ...base, role } : base;

  const [total, users, roleGroups] = await Promise.all([
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
          },
        },
        employer: { select: { companyName: true, location: true, credits: true, interviewCredits: true } },
        interviewer: { select: { status: true, rateUsd: true } },
      },
    }),
    db.user.groupBy({ by: ["role"], where: base, _count: true }),
  ]);

  const roleCounts: Record<string, number> = {};
  for (const g of roleGroups) roleCounts[g.role] = g._count;

  return {
    users,
    total,
    page,
    pageCount: Math.max(1, Math.ceil(total / USERS_PAGE_SIZE)),
    roleCounts,
    role,
    status,
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

  const [profiles, consents] = await Promise.all([
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
  ]);
  const byProfile = new Map(profiles.map((p) => [p.id, p.user]));

  return {
    ...slate,
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

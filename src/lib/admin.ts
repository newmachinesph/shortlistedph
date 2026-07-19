import "server-only";
import { db } from "./db";

/**
 * Back-office read models. Server components call these directly.
 *
 * Money note: Payment rows are written by fulfillment.ts with status "paid",
 * and the two providers settle in different currencies (PayPal USD, PayMongo
 * PHP). We never add them together — revenue is grouped by currency and
 * rendered as separate figures.
 */

const PAID = "paid";

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
    recentAudit,
    recentSignups,
    recentPayments,
    recentConnections,
  ] = await Promise.all([
    db.talentProfile.count(),
    db.talentProfile.count({ where: { publishedAt: { not: null } } }),
    db.employerAccount.count(),
    db.slate.count(),
    db.slate.count({ where: { status: "unlocked" } }),
    db.payment.groupBy({ by: ["currency"], where: { status: PAID }, _sum: { amount: true } }),
    db.report.count({ where: { status: "open" } }),
    db.slate.count({ where: { status: "preview" } }),
    db.jobDescription.count({ where: { status: "matching" } }),
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
      .map((r) => ({ currency: r.currency, total: r._sum.amount ?? 0 }))
      .sort((a, b) => b.total - a.total),
    openReports,
    slatesAwaitingUnlock,
    jdsMatching,
    recentAudit,
    recentSignups,
    recentPayments,
    recentConnections,
  };
}

export const USERS_PAGE_SIZE = 25;

export async function listUsers(opts: { q?: string; page?: number }) {
  const page = Math.max(1, opts.page ?? 1);
  const q = opts.q?.trim();
  const where = q
    ? {
        OR: [
          { email: { contains: q, mode: "insensitive" as const } },
          { name: { contains: q, mode: "insensitive" as const } },
        ],
      }
    : {};

  const [total, users] = await Promise.all([
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
        role: true,
        status: true,
        createdAt: true,
        talentProfile: { select: { headline: true, city: true, publishedAt: true, verifiedTier: true } },
        employer: { select: { companyName: true, location: true, credits: true } },
      },
    }),
  ]);

  return { users, total, page, pageCount: Math.max(1, Math.ceil(total / USERS_PAGE_SIZE)) };
}

export async function listReports(status?: string) {
  return db.report.findMany({
    where: status ? { status } : {},
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 100,
    include: {
      filedBy: { select: { id: true, name: true, email: true, role: true } },
      against: { select: { id: true, name: true, email: true, role: true, status: true } },
    },
  });
}

export async function listSlates() {
  return db.slate.findMany({
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

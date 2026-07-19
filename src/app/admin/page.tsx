import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { NOINDEX } from "@/lib/site";
import { getAdminOverview, money, timeAgo } from "@/lib/admin";

export const metadata: Metadata = { title: "Admin", ...NOINDEX };

export default async function AdminOverview() {
  const o = await getAdminOverview();

  const revenueLabel =
    o.revenue.length === 0
      ? "—"
      : o.revenue.map((r) => money(r.total, r.currency)).join(" · ");

  const kpis: [string, string][] = [
    ["Talent profiles", `${o.talentPublished} / ${o.talentTotal}`],
    ["Employers", String(o.employers)],
    ["Slates delivered", `${o.slatesUnlocked} / ${o.slatesDelivered}`],
    ["Revenue (paid)", revenueLabel],
  ];

  const pending: { label: string; href: string; urgent: boolean }[] = [];
  if (o.openReports > 0) {
    pending.push({
      label: `${o.openReports} open report${o.openReports === 1 ? "" : "s"} need review`,
      href: "/admin/reports",
      urgent: true,
    });
  }
  if (o.jdsMatching > 0) {
    pending.push({
      label: `${o.jdsMatching} job description${o.jdsMatching === 1 ? "" : "s"} still matching`,
      href: "/admin/slates",
      urgent: true,
    });
  }
  if (o.slatesAwaitingUnlock > 0) {
    pending.push({
      label: `${o.slatesAwaitingUnlock} slate${o.slatesAwaitingUnlock === 1 ? "" : "s"} delivered but not unlocked`,
      href: "/admin/slates",
      urgent: false,
    });
  }
  if (o.recentSignups.length > 0) {
    pending.push({
      label: `Newest signup: ${o.recentSignups[0].name} (${o.recentSignups[0].role})`,
      href: "/admin/users",
      urgent: false,
    });
  }

  const activity: { when: Date; what: string }[] = [
    ...o.recentPayments.map((p) => ({
      when: p.createdAt,
      what: `${p.user.name} paid ${money(p.amount, p.currency)} for ${p.purpose.replace(/_/g, " ")}.`,
    })),
    ...o.recentConnections.map((c) => ({
      when: c.createdAt,
      what: `Connection ${c.state} — ${c.slateEntry.snapshot.jd.employer.companyName}, ${c.slateEntry.snapshot.jd.title}.`,
    })),
    ...o.recentAudit.map((a) => ({
      when: a.createdAt,
      what: a.target ? `${a.action} · ${a.target}` : a.action,
    })),
  ]
    .sort((a, b) => b.when.getTime() - a.when.getTime())
    .slice(0, 12);

  return (
    <>
      <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">Overview</h1>
      <p className="mt-1 text-sm text-ink-soft">Team of one. This page is your whole morning routine.</p>

      <dl className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kpis.map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-line bg-white p-5">
            <dt className="text-xs text-ink-faint">{label}</dt>
            <dd className="font-display mt-1.5 break-words text-2xl font-semibold text-ink">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-2 text-xs text-ink-faint">
        Talent shows published / total. Slates show unlocked / delivered. Revenue is totalled per
        currency — PayPal settles USD, PayMongo settles PHP, and the two are never added together.
      </p>

      <h2 className="mt-10 mb-3 text-sm font-medium uppercase tracking-wider text-ink-faint">
        Needs you
      </h2>
      <div className="overflow-hidden rounded-2xl border border-line bg-white">
        {pending.length === 0 ? (
          <p className="px-6 py-8 text-center text-sm text-ink-soft">
            Nothing waiting on you. Queue is clear.
          </p>
        ) : (
          pending.map((p, i) => (
            <Link
              key={p.label}
              href={p.href}
              className={`flex min-h-14 items-center justify-between gap-3 px-4 py-4 text-sm hover:bg-paper sm:px-6 ${
                i < pending.length - 1 ? "border-b border-line" : ""
              }`}
            >
              <span className="flex min-w-0 items-center gap-2.5">
                <span
                  className={`h-2 w-2 shrink-0 rounded-full ${p.urgent ? "bg-ember" : "bg-line"}`}
                />
                <span className={`min-w-0 break-words ${p.urgent ? "font-medium text-ink" : "text-ink-soft"}`}>
                  {p.label}
                </span>
              </span>
              <ArrowRight className="h-4 w-4 shrink-0 text-ink-faint" />
            </Link>
          ))
        )}
      </div>

      <h2 className="mt-10 mb-3 text-sm font-medium uppercase tracking-wider text-ink-faint">
        Recent activity
      </h2>
      <div className="rounded-2xl border border-line bg-white p-4 sm:p-6">
        {activity.length === 0 ? (
          <p className="py-2 text-center text-sm text-ink-soft">No activity recorded yet.</p>
        ) : (
          <ul className="space-y-3">
            {activity.map((a, i) => (
              <li key={`${a.when.getTime()}-${i}`} className="text-sm leading-relaxed">
                <span className="text-xs text-ink-faint">{timeAgo(a.when)}</span>
                <p className="mt-0.5 break-words text-ink-soft">{a.what}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

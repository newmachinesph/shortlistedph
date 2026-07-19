import Link from "next/link";
import { ArrowRight } from "lucide-react";

const kpis = [
  ["Talent profiles", "512"],
  ["Employers", "47"],
  ["Slates delivered", "31"],
  ["Revenue (Jul)", "$1,519"],
];

const pending = [
  { label: "2 open reports need review", href: "/admin/reports", urgent: true },
  { label: "1 slate below consent threshold — re-slate due", href: "/admin/slates", urgent: true },
  { label: "3 new talent signups today (auto-approved)", href: "/admin/users", urgent: false },
];

const activity: [string, string][] = [
  ["2h ago", "Harbor Dental Group unlocked the Medical VA slate ($49)."],
  ["5h ago", "Report filed: talent claims an 'employer' asked for a training fee off-platform."],
  ["Yesterday", "Slate delivered for Senior React engineer — 3 of 512 met threshold."],
  ["Yesterday", "Kristine Bautista and Harbor Dental Group e-signed an agreement."],
  ["Jul 17", "Report filed: employer flags a resume claim that failed reference check."],
];

export default function AdminOverview() {
  return (
    <>
      <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">Overview</h1>
      <p className="mt-1 text-sm text-ink-soft">Team of one. This page is your whole morning routine.</p>

      <dl className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {kpis.map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-line bg-white p-5">
            <dt className="text-xs text-ink-faint">{label}</dt>
            <dd className="font-display mt-1.5 text-2xl font-semibold text-ink">{value}</dd>
          </div>
        ))}
      </dl>

      <h2 className="mt-10 mb-3 text-sm font-medium uppercase tracking-wider text-ink-faint">
        Needs you
      </h2>
      <div className="overflow-hidden rounded-2xl border border-line bg-white">
        {pending.map((p, i) => (
          <Link
            key={p.label}
            href={p.href}
            className={`flex items-center justify-between gap-3 px-6 py-4 text-sm hover:bg-paper ${
              i < pending.length - 1 ? "border-b border-line" : ""
            }`}
          >
            <span className="flex items-center gap-2.5">
              <span className={`h-2 w-2 rounded-full ${p.urgent ? "bg-ember" : "bg-line"}`} />
              <span className={p.urgent ? "font-medium text-ink" : "text-ink-soft"}>{p.label}</span>
            </span>
            <ArrowRight className="h-4 w-4 text-ink-faint" />
          </Link>
        ))}
      </div>

      <h2 className="mt-10 mb-3 text-sm font-medium uppercase tracking-wider text-ink-faint">
        Recent activity
      </h2>
      <div className="rounded-2xl border border-line bg-white p-6">
        <ul className="space-y-3">
          {activity.map(([when, what]) => (
            <li key={what} className="text-sm leading-relaxed">
              <span className="text-xs text-ink-faint">{when}</span>
              <p className="mt-0.5 text-ink-soft">{what}</p>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

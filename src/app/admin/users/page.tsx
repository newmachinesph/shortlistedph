import type { Metadata } from "next";
import { NOINDEX } from "@/lib/site";

export const metadata: Metadata = { title: "Admin · Users", ...NOINDEX };

import { candidates, initials } from "@/data/candidates";

const employers = [
  { name: "Harbor Dental Group", sub: "Austin, TX · 2 confirmed hires", status: "active" },
  { name: "Ledgerline", sub: "US SaaS · 1 unlocked slate", status: "active" },
  { name: "Glowfolk", sub: "Melbourne · matching in progress", status: "active" },
  { name: "BrightStaff Solutions", sub: "No hires · domain 12 days old · open report", status: "flagged" },
];

const statusChip: Record<string, string> = {
  active: "bg-brand-soft text-brand",
  flagged: "bg-ember-soft text-ember",
  banned: "bg-line text-ink-soft",
};

export default function AdminUsers() {
  const talent = candidates.slice(0, 6);
  return (
    <>
      <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">Users</h1>
      <p className="mt-1 text-sm text-ink-soft">512 talent · 47 employers. Showing recent.</p>

      <h2 className="mt-8 mb-3 text-sm font-medium uppercase tracking-wider text-ink-faint">Employers</h2>
      <div className="overflow-hidden rounded-2xl border border-line bg-white">
        {employers.map((e, i) => (
          <div
            key={e.name}
            className={`flex flex-wrap items-center gap-4 px-6 py-4 ${i < employers.length - 1 ? "border-b border-line" : ""}`}
          >
            <span className="font-display flex h-10 w-10 items-center justify-center rounded-xl bg-brand-soft text-sm font-semibold text-brand">
              {initials(e.name)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink">{e.name}</p>
              <p className="truncate text-xs text-ink-faint">{e.sub}</p>
            </div>
            <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${statusChip[e.status]}`}>
              {e.status}
            </span>
            <button className="rounded-xl px-3 py-1.5 text-xs font-medium text-ink-soft ring-1 ring-inset ring-line transition-colors hover:bg-paper">
              {e.status === "flagged" ? "Review" : "View"}
            </button>
          </div>
        ))}
      </div>

      <h2 className="mt-8 mb-3 text-sm font-medium uppercase tracking-wider text-ink-faint">Talent (recent)</h2>
      <div className="overflow-hidden rounded-2xl border border-line bg-white">
        {talent.map((c, i) => (
          <div
            key={c.id}
            className={`flex flex-wrap items-center gap-4 px-6 py-4 ${i < talent.length - 1 ? "border-b border-line" : ""}`}
          >
            <span className="font-display flex h-10 w-10 items-center justify-center rounded-xl bg-brand-soft text-sm font-semibold text-brand">
              {initials(c.name)}
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-ink">{c.name}</p>
              <p className="truncate text-xs text-ink-faint">
                {c.headline} · ${c.rateUsd}/hr · stable {c.profileStableDays}d
              </p>
            </div>
            {c.idVerified && (
              <span className="rounded-full bg-brand-soft px-2.5 py-1 text-[11px] font-medium text-brand">
                ID verified
              </span>
            )}
            <button className="rounded-xl px-3 py-1.5 text-xs font-medium text-ink-soft ring-1 ring-inset ring-line transition-colors hover:bg-paper">
              View
            </button>
          </div>
        ))}
      </div>
    </>
  );
}

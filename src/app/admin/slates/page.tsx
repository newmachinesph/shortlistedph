import Link from "next/link";
import { RefreshCw, ScanSearch } from "lucide-react";
import { briefs, slates } from "@/data/briefs";

export default function AdminSlates() {
  return (
    <>
      <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">Slates</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Matching queue and re-slate obligations across all job descriptions.
      </p>

      <div className="mt-7 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-ember-soft px-6 py-5">
        <div className="flex items-start gap-3">
          <RefreshCw className="mt-0.5 h-5 w-5 shrink-0 text-ember" />
          <p className="max-w-lg text-sm leading-relaxed text-ink">
            <span className="font-medium">Re-slate due:</span> Medical VA slate
            has 2 of 5 consents after one decline — below the 3-consent
            guarantee. Rebuild with next-ranked candidates.
          </p>
        </div>
        <button className="rounded-xl bg-ember px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90">
          Rebuild slate
        </button>
      </div>

      <h2 className="mt-8 mb-3 text-sm font-medium uppercase tracking-wider text-ink-faint">
        All job descriptions
      </h2>
      <div className="overflow-hidden rounded-2xl border border-line bg-white">
        {briefs.map((b, i) => {
          const slate = slates[b.id];
          return (
            <div
              key={b.id}
              className={`flex flex-wrap items-center gap-4 px-6 py-4 ${i < briefs.length - 1 ? "border-b border-line" : ""}`}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">{b.title}</p>
                <p className="truncate text-xs text-ink-faint">
                  {b.company} · ${b.budgetMin}–{b.budgetMax}/hr · posted {b.postedAgo}
                </p>
              </div>
              {b.status === "slate_ready" && (
                <span className="rounded-full bg-brand-soft px-2.5 py-1 text-[11px] font-medium text-brand">
                  slate of {slate?.length ?? 0} · {b.unlocked ? "unlocked" : "preview"}
                </span>
              )}
              {b.status === "matching" && (
                <span className="inline-flex items-center gap-1 rounded-full bg-ember-soft px-2.5 py-1 text-[11px] font-medium text-ember">
                  <ScanSearch className="h-3 w-3" /> matching · {b.candidatesScanned} scanned
                </span>
              )}
              {b.status === "draft" && (
                <span className="rounded-full border border-line px-2.5 py-1 text-[11px] text-ink-soft">
                  draft
                </span>
              )}
              <Link
                href={`/employer/briefs/${b.id}`}
                className="rounded-xl px-3 py-1.5 text-xs font-medium text-ink-soft ring-1 ring-inset ring-line transition-colors hover:bg-paper"
              >
                Open
              </Link>
            </div>
          );
        })}
      </div>
    </>
  );
}

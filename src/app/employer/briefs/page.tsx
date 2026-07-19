import Link from "next/link";
import { ArrowRight, Pencil, Plus, ScanSearch } from "lucide-react";
import { briefs, slates } from "@/data/briefs";

const statusChip: Record<string, { label: string; cls: string }> = {
  slate_ready: { label: "Slate ready", cls: "bg-brand-soft text-brand" },
  matching: { label: "Matching…", cls: "bg-ember-soft text-ember" },
  draft: { label: "Draft", cls: "bg-line text-ink-soft" },
};

export default function EmployerBriefsPage() {
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">
            Job descriptions
          </h1>
          <p className="mt-1 text-sm text-ink-soft">
            Every brief you post stays hidden from candidates until a match is made.
          </p>
        </div>
        <Link
          href="/employer/briefs/new"
          className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-dark"
        >
          <Plus className="h-4 w-4" /> New job description
        </Link>
      </div>

      <div className="mt-7 space-y-4">
        {briefs.map((b) => {
          const chip = statusChip[b.status];
          const slate = slates[b.id];
          return (
            <div key={b.id} className="rounded-2xl border border-line bg-white p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2.5">
                    <h3 className="font-medium text-ink">{b.title}</h3>
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${chip.cls}`}>
                      {chip.label}
                    </span>
                    {b.status === "slate_ready" && !b.unlocked && (
                      <span className="rounded-full bg-ember-soft px-2 py-0.5 text-[11px] font-medium text-ember">
                        Free preview — unlock $49
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-ink-soft">
                    ${b.budgetMin}–{b.budgetMax}/hr · {b.hoursPerWeek}h/wk · overlap {b.overlap} · posted {b.postedAgo}
                  </p>
                  <p className="mt-1 text-xs text-ink-faint">
                    Hidden from candidates · {b.candidatesScanned} profiles scanned
                  </p>
                </div>
                {b.status === "slate_ready" && slate ? (
                  <Link
                    href={`/employer/briefs/${b.id}`}
                    className="inline-flex items-center gap-1.5 rounded-xl bg-brand-soft px-4 py-2 text-sm font-medium text-brand transition-colors hover:bg-brand hover:text-white"
                  >
                    <span>
                      {b.unlocked ? "View shortlist" : "View preview"} ({slate.length})
                    </span>
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                ) : b.status === "draft" ? (
                  <Link
                    href="/employer/briefs/new"
                    className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium text-brand ring-1 ring-inset ring-brand/30 transition-colors hover:bg-brand-soft"
                  >
                    <Pencil className="h-4 w-4" /> Continue editing
                  </Link>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-xl bg-ember-soft px-4 py-2 text-sm text-ember">
                    <ScanSearch className="h-4 w-4" /> Slate ETA ~18h
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}

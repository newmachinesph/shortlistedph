import Link from "next/link";
import { ArrowRight, Plus, ScanSearch } from "lucide-react";
import { employerOrOnboard, listJds, requirePageUser } from "@/lib/queries";

const statusChip: Record<string, { label: string; cls: string }> = {
  slate_ready: { label: "Slate ready", cls: "bg-brand-soft text-brand" },
  matching: { label: "Matching…", cls: "bg-ember-soft text-ember" },
  no_matches: { label: "No qualified matches", cls: "bg-ember-soft text-ember" },
  draft: { label: "Draft", cls: "bg-line text-ink-soft" },
  closed: { label: "Closed", cls: "bg-line text-ink-soft" },
};

export default async function JobDescriptionsPage() {
  const user = await requirePageUser("employer");
  const employer = await employerOrOnboard(user.id);
  const jds = await listJds(employer.id);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">
            Job descriptions
          </h1>
          <p className="mt-1 text-sm text-ink-soft">
            Every one is hidden from candidates — they exist only to drive matching.
          </p>
        </div>
        <Link
          href="/employer/briefs/new"
          className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-dark"
        >
          <Plus className="h-4 w-4" /> New job description
        </Link>
      </div>

      {jds.length === 0 ? (
        <div className="mt-7 rounded-2xl border border-line bg-white p-10 text-center">
          <ScanSearch className="mx-auto h-8 w-8 text-ink-faint" strokeWidth={1.5} />
          <h2 className="font-display mt-4 text-lg font-semibold text-ink">Nothing here yet</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-ink-soft">
            Write what you need and we&rsquo;ll rank the market against it. Previewing your slate
            costs nothing.
          </p>
        </div>
      ) : (
        <div className="mt-7 space-y-4">
          {jds.map((jd) => {
            const chip = statusChip[jd.status] ?? statusChip.draft;
            const slate = jd.slates[0];
            const locked = slate && slate.status !== "unlocked";
            return (
              <div key={jd.id} className="rounded-2xl border border-line bg-white p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="flex flex-wrap items-center gap-2.5">
                      <h3 className="font-medium text-ink">{jd.title}</h3>
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${chip.cls}`}>
                        {chip.label}
                      </span>
                      {locked && (
                        <span className="rounded-full bg-ember-soft px-2 py-0.5 text-[11px] font-medium text-ember">
                          Free preview — unlock $49
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm text-ink-soft">
                      {jd.budgetMin != null && jd.budgetMax != null
                        ? `$${jd.budgetMin}–${jd.budgetMax}/hr · `
                        : ""}
                      {jd.hoursPerWeek ? `${jd.hoursPerWeek}h/wk · ` : ""}
                      {jd.mustHaves.length} must-haves
                    </p>
                  </div>
                  {slate ? (
                    <Link
                      href={`/employer/briefs/${jd.id}`}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-brand-soft px-4 py-2 text-sm font-medium text-brand transition-colors hover:bg-brand hover:text-white"
                    >
                      {locked ? "View preview" : "View shortlist"} ({slate._count.entries}){" "}
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  ) : (
                    <Link
                      href="/employer/briefs/new"
                      className="rounded-xl px-4 py-2 text-sm font-medium text-brand ring-1 ring-inset ring-brand/30 transition-colors hover:bg-brand-soft"
                    >
                      Continue editing
                    </Link>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

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

export default async function EmployerDashboard() {
  const user = await requirePageUser("employer");
  const employer = await employerOrOnboard(user.id);
  const jds = await listJds(employer.id);

  const slatesReady = jds.filter((j) => j.status === "slate_ready").length;
  const shortlisted = jds.reduce((n, j) => n + (j.slates[0]?._count.entries ?? 0), 0);

  const kpis: [string, string][] = [
    ["Job descriptions", String(jds.length)],
    ["Slates ready", String(slatesReady)],
    ["Candidates shortlisted", String(shortlisted)],
    ["Shortlist credits", String(employer.credits)],
  ];

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">
            {employer.companyName}
          </h1>
          <p className="mt-1 text-sm text-ink-soft">
            Write what you need. We rank the market and hand you a shortlist.
          </p>
        </div>
        <Link
          href="/employer/briefs/new"
          className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-dark"
        >
          <Plus className="h-4 w-4" /> New job description
        </Link>
      </div>

      <dl className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {kpis.map(([label, value]) => (
          <div key={label} className="rounded-2xl border border-line bg-white p-5">
            <dt className="text-xs text-ink-faint">{label}</dt>
            <dd className="font-display mt-1.5 text-2xl font-semibold text-ink">{value}</dd>
          </div>
        ))}
      </dl>

      <h2 className="mt-10 mb-4 text-sm font-medium uppercase tracking-wider text-ink-faint">
        Your job descriptions
      </h2>

      {jds.length === 0 ? (
        <div className="rounded-2xl border border-line bg-white p-10 text-center">
          <ScanSearch className="mx-auto h-8 w-8 text-ink-faint" strokeWidth={1.5} />
          <h3 className="font-display mt-4 text-lg font-semibold text-ink">Nothing posted yet</h3>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-ink-soft">
            Describe who you need. It stays hidden from candidates — you get a ranked shortlist
            back, free to preview.
          </p>
          <Link
            href="/employer/briefs/new"
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-dark"
          >
            <Plus className="h-4 w-4" /> Write your first one
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
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
                      {jd.overlap ? `overlap ${jd.overlap}` : "no overlap requirement"}
                    </p>
                    <p className="mt-1 text-xs text-ink-faint">Hidden from candidates</p>
                  </div>
                  {slate ? (
                    <Link
                      href={`/employer/briefs/${jd.id}`}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-brand-soft px-4 py-2 text-sm font-medium text-brand transition-colors hover:bg-brand hover:text-white"
                    >
                      {locked ? "View preview" : "View shortlist"} ({slate._count.entries}){" "}
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  ) : jd.status === "draft" ? (
                    <Link
                      href="/employer/briefs/new"
                      className="rounded-xl px-4 py-2 text-sm font-medium text-brand ring-1 ring-inset ring-brand/30 transition-colors hover:bg-brand-soft"
                    >
                      Continue editing
                    </Link>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 rounded-xl bg-ember-soft px-4 py-2 text-sm text-ember">
                      <ScanSearch className="h-4 w-4" /> Matching…
                    </span>
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

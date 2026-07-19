import { Building2, Check, Clock, EyeOff } from "lucide-react";
import { listTalentConnections, requirePageUser, talentOrOnboard } from "@/lib/queries";
import { rateBand } from "@/lib/format";
import { ConnectionDecision } from "./decision";

export default async function TalentConnectionsPage() {
  const user = await requirePageUser("talent");
  await talentOrOnboard(user.id);
  const connections = await listTalentConnections(user.id);

  const pending = connections.filter((c) => c.state === "requested");
  const settled = connections.filter((c) => c.state !== "requested");

  return (
    <>
      <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">Connections</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Employers who shortlisted you and want to talk. You see the full job description before
        deciding, and nothing about you is shared until you accept.
      </p>

      {connections.length === 0 && (
        <div className="mt-7 rounded-2xl border border-line bg-white p-6 text-center sm:p-10">
          <EyeOff className="mx-auto h-8 w-8 text-ink-faint" strokeWidth={1.5} />
          <h2 className="font-display mt-4 text-lg font-semibold text-ink">No requests yet</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-ink-soft">
            You&rsquo;re invisible until you land on a shortlist. When an employer wants to talk,
            it appears here — there is nothing to apply to in the meantime.
          </p>
        </div>
      )}

      {pending.map((c) => {
        const jd = c.slateEntry.snapshot.jd;
        const band = rateBand(jd.budgetMin, jd.budgetMax);
        return (
          <div key={c.id} className="mt-7 rounded-2xl border border-line bg-white p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-soft">
                  <Building2 className="h-5 w-5 text-brand" />
                </span>
                <div>
                  <h2 className="font-medium text-ink">{jd.employer.companyName}</h2>
                  <p className="text-sm text-ink-soft">
                    {jd.employer.blurb ?? jd.employer.location ?? "Employer"}
                  </p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-ember-soft px-2.5 py-1 text-[11px] font-medium text-ember">
                <Clock className="h-3 w-3" /> Awaiting your consent
              </span>
            </div>

            <div className="mt-5 rounded-xl bg-paper p-5">
              <p className="flex items-center gap-1.5 text-xs text-ink-faint">
                <EyeOff className="h-3.5 w-3.5" />
                <span>Their job description — revealed to you because you were shortlisted</span>
              </p>
              <h3 className="mt-2 font-medium text-ink">{jd.title}</h3>
              <p className="mt-1 text-sm leading-relaxed text-ink-soft">
                {[band, jd.hoursPerWeek ? `${jd.hoursPerWeek}h/week` : null, jd.overlap]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
              {jd.mustHaves.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {jd.mustHaves.map((m) => (
                    <span
                      key={m}
                      className="rounded-full bg-brand-soft px-2.5 py-1 text-xs font-medium text-brand"
                    >
                      {m}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <ConnectionDecision connectionId={c.id} />
          </div>
        );
      })}

      {settled.length > 0 && (
        <>
          <h2 className="mt-9 mb-3 text-sm font-medium uppercase tracking-wider text-ink-faint">
            Past connections
          </h2>
          <div className="space-y-4">
            {settled.map((c) => {
              const jd = c.slateEntry.snapshot.jd;
              return (
                <div key={c.id} className="rounded-2xl border border-line bg-white p-6">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-paper">
                        <Building2 className="h-5 w-5 text-ink-faint" />
                      </span>
                      <div>
                        <h3 className="font-medium text-ink">{jd.employer.companyName}</h3>
                        <p className="text-sm text-ink-soft">{jd.title}</p>
                      </div>
                    </div>
                    {c.state === "consented" ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2.5 py-1 text-[11px] font-medium text-brand">
                        <Check className="h-3 w-3" /> Connected
                      </span>
                    ) : (
                      <span className="rounded-full border border-line px-2.5 py-1 text-[11px] text-ink-faint">
                        Declined
                      </span>
                    )}
                  </div>
                  {c.state === "consented" && (
                    <p className="mt-4 rounded-xl bg-brand-soft px-4 py-3 text-sm text-brand">
                      Your contact details were shared with {jd.employer.companyName}. Expect a
                      message about scheduling.
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}

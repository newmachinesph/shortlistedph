import Link from "next/link";
import { notFound } from "next/navigation";
import { BadgeCheck, Camera, Check, Lock } from "lucide-react";
import { candidateById, initials } from "@/data/candidates";

const availabilityLabel = {
  open: "Open to full-time",
  partial: "Partially committed",
  booked: "Fully booked",
};

export default async function CandidateDossier({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const c = candidateById(id);
  if (!c) notFound();

  return (
    <>
      <Link href="/employer/briefs/medical-va-dental" className="text-sm text-ink-faint hover:text-brand">
        ← Back to shortlist
      </Link>

      <div className="mt-3 flex items-center gap-2 rounded-2xl bg-ember-soft px-5 py-3.5 text-sm text-ember">
        <Camera className="h-4 w-4 shrink-0" />
        Snapshot view — this profile is shown as it existed when your job was
        posted. It was last edited {c.profileStableDays} days before that.
      </div>

      <div className="mt-5 rounded-2xl border border-line bg-white p-7">
        <div className="flex flex-wrap items-start gap-5">
          <span className="font-display flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-soft text-xl font-semibold text-brand">
            {initials(c.name)}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">{c.name}</h1>
              {c.idVerified && (
                <span className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2.5 py-1 text-xs font-medium text-brand">
                  <BadgeCheck className="h-3.5 w-3.5" /> ID verified
                </span>
              )}
            </div>
            <p className="mt-1 text-ink-soft">{c.headline}</p>
            <p className="mt-1 text-sm text-ink-faint">
              {c.city} · {c.years} yrs experience · {availabilityLabel[c.availability]}
              {c.committedHours > 0 && ` (${c.committedHours}h/wk committed)`}
            </p>
          </div>
          <div className="rounded-2xl bg-brand-soft px-5 py-4 text-right">
            <p className="font-display text-2xl font-semibold text-brand">${c.rateUsd}/hr</p>
            <p className="mt-0.5 text-xs text-ink-soft">standing rate · unchanged {c.rateStableMonths} months</p>
          </div>
        </div>
        <p className="mt-5 max-w-2xl leading-relaxed text-ink-soft">{c.summary}</p>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <section className="rounded-2xl border border-line bg-white p-6">
          <h2 className="text-sm font-medium uppercase tracking-wider text-ink-faint">Skills</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {c.skills.map((s) => (
              <span
                key={s.name}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm ${
                  s.confirmed
                    ? "bg-brand-soft font-medium text-brand"
                    : "border border-line text-ink-soft"
                }`}
              >
                {s.confirmed && <Check className="h-3.5 w-3.5" />}
                {s.name}
              </span>
            ))}
          </div>
          <p className="mt-4 text-xs leading-relaxed text-ink-faint">
            <Check className="mr-1 inline h-3 w-3 text-brand" />
            = confirmed by a past engagement outcome. Unmarked skills are
            self-reported.
          </p>
        </section>

        <section className="rounded-2xl border border-line bg-white p-6">
          <h2 className="text-sm font-medium uppercase tracking-wider text-ink-faint">Engagement history</h2>
          <ul className="mt-4 space-y-4">
            {c.history.map((h) => (
              <li key={h.role + h.span} className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium text-ink">{h.role}</p>
                  <p className="text-sm text-ink-soft">{h.company} · {h.span}</p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ${
                    h.outcome === "confirmed"
                      ? "bg-brand-soft text-brand"
                      : "border border-line text-ink-faint"
                  }`}
                >
                  {h.outcome === "confirmed" ? "Outcome confirmed" : "Self-reported"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <div className="mt-5 flex items-start gap-3 rounded-2xl border border-line bg-white p-6">
        <Lock className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
        <p className="text-sm leading-relaxed text-ink-soft">
          <span className="font-medium text-ink">Documents stay with the candidate.</span>{" "}
          Verification on shortlisted.ph is optional and IDs, NBI clearance, and
          certificates are never stored or forwarded by us — candidates present
          them to you directly once you hire.
        </p>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-4">
        <button className="rounded-2xl bg-brand px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-brand/25 transition-colors hover:bg-brand-dark">
          Request connection
        </button>
        <p className="text-xs text-ink-faint">
          {c.name.split(" ")[0]} must consent before contact details are shared.
        </p>
      </div>
    </>
  );
}

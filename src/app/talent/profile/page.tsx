import { BadgeCheck, Camera, Check, Globe, Lock } from "lucide-react";
import { candidateById, initials } from "@/data/candidates";

export default function TalentProfilePage() {
  const c = candidateById("kristine-bautista")!;

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">
            Your standing profile
          </h1>
          <p className="mt-1 text-sm text-ink-soft">
            This is the one profile every brief is matched against. There is
            nothing to tailor — keep it true instead.
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-3 py-1.5 text-xs font-medium text-brand">
          <Globe className="h-3.5 w-3.5" /> Visible to matching
        </span>
      </div>

      <div className="mt-6 rounded-2xl border border-line bg-white p-7">
        <div className="flex flex-wrap items-start gap-5">
          <span className="font-display flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-soft text-xl font-semibold text-brand">
            {initials(c.name)}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display text-xl font-semibold text-ink">{c.name}</h2>
              <span className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2.5 py-1 text-xs font-medium text-brand">
                <BadgeCheck className="h-3.5 w-3.5" /> ID verified
              </span>
            </div>
            <p className="mt-1 text-ink-soft">{c.headline}</p>
            <p className="mt-1 text-sm text-ink-faint">{c.city} · {c.years} yrs · open to full-time</p>
          </div>
          <button className="rounded-xl px-4 py-2 text-sm font-medium text-brand ring-1 ring-inset ring-brand/30 transition-colors hover:bg-brand-soft">
            Edit
          </button>
        </div>
        <p className="mt-5 max-w-2xl leading-relaxed text-ink-soft">{c.summary}</p>
        <p className="mt-4 flex items-center gap-1.5 text-xs text-ink-faint">
          <Camera className="h-3.5 w-3.5" />
          <span>Stable for {c.profileStableDays} days — stability strengthens your ranking.</span>
        </p>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <section className="rounded-2xl border border-line bg-white p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium uppercase tracking-wider text-ink-faint">Standing rate</h2>
            <button className="text-sm font-medium text-brand hover:underline">Change</button>
          </div>
          <p className="font-display mt-3 text-3xl font-semibold text-ink">${c.rateUsd}/hr</p>
          <p className="mt-1 text-sm text-ink-soft">Unchanged for {c.rateStableMonths} months</p>
          <p className="mt-4 rounded-xl bg-paper p-3.5 text-xs leading-relaxed text-ink-faint">
            One rate for every employer. Changes lock for 30 days and your rate
            history is visible to employers who shortlist you.
          </p>
        </section>

        <section className="rounded-2xl border border-line bg-white p-6">
          <h2 className="text-sm font-medium uppercase tracking-wider text-ink-faint">Verification</h2>
          <ul className="mt-4 space-y-3 text-sm">
            <li className="flex items-center gap-2.5 text-ink">
              <Check className="h-4 w-4 text-brand" /> Identity verified (optional — you chose to)
            </li>
            <li className="flex items-center gap-2.5 text-ink-faint">
              <span className="h-4 w-4 rounded-full border border-line" /> NBI clearance — on hand, shown at hire
            </li>
          </ul>
          <p className="mt-4 flex items-start gap-2 rounded-xl bg-paper p-3.5 text-xs leading-relaxed text-ink-faint">
            <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Your documents never live on shortlisted.ph. When you&rsquo;re hired,
            you present them directly to your employer — your choice, your copies.
          </p>
        </section>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <section className="rounded-2xl border border-line bg-white p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium uppercase tracking-wider text-ink-faint">Skills</h2>
            <button className="text-sm font-medium text-brand hover:underline">Edit</button>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {c.skills.map((s) => (
              <span
                key={s.name}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm ${
                  s.confirmed ? "bg-brand-soft font-medium text-brand" : "border border-line text-ink-soft"
                }`}
              >
                {s.confirmed && <Check className="h-3.5 w-3.5" />}
                {s.name}
              </span>
            ))}
          </div>
          <p className="mt-4 text-xs leading-relaxed text-ink-faint">
            Checked skills were confirmed by a past engagement outcome. Both
            parties confirming how an engagement ended is what turns a claim
            into proof.
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
    </>
  );
}

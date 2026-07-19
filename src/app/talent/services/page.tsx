import { BarChart3, Briefcase, Clock, Lock, TrendingUp, Wrench } from "lucide-react";
import { candidateById } from "@/data/candidates";

export default function TalentServicesPage() {
  const c = candidateById("kristine-bautista")!;

  return (
    <>
      <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">
        Your rate card
      </h1>
      <p className="mt-1 text-sm text-ink-soft">
        What every hidden job description is matched against — one rate, no negotiation theater.
      </p>

      <div className="mt-7 grid gap-5 lg:grid-cols-2">
        <section className="rounded-2xl border border-line bg-white p-6">
          <div className="flex items-start justify-between gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-soft">
              <Briefcase className="h-5 w-5 text-brand" />
            </span>
            <span className="rounded-full bg-brand-soft px-2.5 py-1 text-xs font-medium text-brand">
              standing rate · unchanged {c.rateStableMonths} months
            </span>
          </div>
          <h2 className="mt-4 font-medium text-ink">Medical VA — US dental practices</h2>
          <p className="font-display mt-2 text-3xl font-semibold text-ink">${c.rateUsd}/hr</p>
          <p className="mt-1 text-sm text-ink-soft">Full-time preferred</p>
        </section>

        <section className="rounded-2xl border border-line bg-white p-6">
          <div className="flex items-start justify-between gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-paper">
              <Wrench className="h-5 w-5 text-ink-faint" />
            </span>
            <span className="rounded-full border border-line px-2.5 py-1 text-xs text-ink-soft">
              project-based
            </span>
          </div>
          <h2 className="mt-4 font-medium text-ink">Insurance verification cleanup</h2>
          <p className="font-display mt-2 text-3xl font-semibold text-ink">$150</p>
          <p className="mt-1 text-sm text-ink-soft">Fixed price per project</p>
        </section>
      </div>

      <section className="mt-5 rounded-2xl border border-line bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-ink-faint">
            <BarChart3 className="h-4 w-4" /> Market position
          </h2>
          <span className="rounded-full bg-brand-soft px-2.5 py-1 text-xs font-medium text-brand">
            Priced to match
          </span>
        </div>
        <p className="mt-4 text-sm leading-relaxed text-ink-soft">
          <span className="font-medium text-ink">${c.rateUsd}/hr</span> sits in
          the <span className="font-medium text-ink">64th percentile</span> of
          Medical VA profiles with similar verified experience.
        </p>
        <div className="relative mt-4 h-2 rounded-full bg-line">
          <div className="absolute inset-y-0 left-0 w-[64%] rounded-full bg-brand" />
          <div className="absolute left-[64%] top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-brand shadow-sm" />
          <div className="absolute inset-y-0 left-[90%] w-px bg-ember" />
        </div>
        <div className="mt-1.5 flex justify-between text-[10px] text-ink-faint">
          <span>0th</span>
          <span className="text-ember">90th — matching drops sharply</span>
          <span>100th</span>
        </div>
        <p className="mt-4 rounded-xl bg-paper p-3.5 text-xs leading-relaxed text-ink-faint">
          The engine matches rate against <span className="font-medium text-ink-soft">verified</span> experience,
          not ambition. Profiles priced above the 90th percentile for their
          verified level get shortlisted about 4× less. Raise your rate by
          verifying more — not by asking for more.
        </p>
      </section>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <section className="rounded-2xl border border-line bg-white p-6">
          <h2 className="flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-ink-faint">
            <TrendingUp className="h-4 w-4" /> Rate history
          </h2>
          <ul className="mt-4 space-y-4">
            <li className="flex items-center justify-between gap-3">
              <span className="text-sm text-ink-soft">$8.50/hr</span>
              <span className="text-xs text-ink-faint">until Dec 14, 2025</span>
            </li>
            <li className="flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-ink">$9.00/hr</span>
              <span className="text-xs text-ink-faint">since Dec 14, 2025</span>
            </li>
          </ul>
          <p className="mt-4 text-xs leading-relaxed text-ink-faint">
            Visible to employers who shortlist you.
          </p>
        </section>

        <section className="rounded-2xl border border-line bg-white p-6">
          <h2 className="flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-ink-faint">
            <Clock className="h-4 w-4" /> Availability
          </h2>
          <p className="mt-4 font-medium text-ink">Open to full-time</p>
          <p className="mt-1 text-sm text-ink-soft">{c.committedHours}h/week committed</p>
          <p className="mt-4 rounded-xl bg-paper p-3.5 text-xs leading-relaxed text-ink-faint">
            Committed hours update automatically when agreements start.
          </p>
        </section>
      </div>

      <div className="mt-5 flex items-start gap-2.5 rounded-2xl border border-line bg-white p-5 text-xs leading-relaxed text-ink-faint">
        <Lock className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>Rate changes lock for 30 days once submitted — plan ahead before adjusting.</span>
      </div>
    </>
  );
}

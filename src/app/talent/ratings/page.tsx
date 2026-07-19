import { Star } from "lucide-react";

const categories: [string, number][] = [
  ["Communication", 5.0],
  ["Delivery", 4.9],
  ["Reliability", 4.8],
];

export default function TalentRatingsPage() {
  return (
    <>
      <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">Ratings</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Reviews only unlock after both sides confirm an outcome — double-blind, so nobody rates first to game the other.
      </p>

      <section className="mt-7 rounded-2xl border border-line bg-white p-6">
        <h2 className="text-sm font-medium uppercase tracking-wider text-ink-faint">
          How employers rate you
        </h2>
        <div className="mt-4 flex items-end gap-3">
          <p className="font-display text-4xl font-semibold text-ink">4.9</p>
          <p className="pb-1 text-sm text-ink-soft">from 3 employers</p>
        </div>
        <div className="mt-5 space-y-3">
          {categories.map(([label, score]) => (
            <div key={label}>
              <div className="flex items-center justify-between text-xs text-ink-soft">
                <span>{label}</span>
                <span className="font-medium text-ink">{score.toFixed(1)}</span>
              </div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-line">
                <div
                  className="h-full rounded-full bg-brand"
                  style={{ width: `${(score / 5) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      <h2 className="mt-9 mb-3 text-sm font-medium uppercase tracking-wider text-ink-faint">
        Received
      </h2>
      <section className="rounded-2xl border border-line bg-white p-6">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="font-medium text-ink">US medspa chain</h3>
            <p className="text-xs text-ink-faint">May 2026</p>
          </div>
          <div className="flex items-center gap-0.5 text-brand">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star key={i} className="h-4 w-4 fill-current" />
            ))}
          </div>
        </div>
        <p className="mt-3 leading-relaxed text-ink-soft">
          &ldquo;Kristine ran our front desk like it was her own practice —
          patients never noticed she wasn&rsquo;t in the building. Reschedules,
          recalls, insurance calls, all handled without us checking in.&rdquo;
        </p>
        <p className="mt-3 text-xs text-ink-faint">
          Reviews reveal only after both sides rate — neither can see the other&rsquo;s first.
        </p>
      </section>

      <section className="mt-5 rounded-2xl border border-line bg-white p-6">
        <h2 className="font-medium text-ink">Rate Harbor Dental Group after your first month</h2>
        <p className="mt-1 text-sm text-ink-soft">
          Your rating unlocks once the first outcome confirmation lands, Sep 1, 2026.
        </p>
        <button className="mt-4 rounded-xl px-4 py-2 text-sm font-medium text-brand ring-1 ring-inset ring-brand/30 transition-colors hover:bg-brand-soft">
          Rate Harbor Dental Group
        </button>
        <p className="mt-3 text-xs text-ink-faint">
          Your rating is hidden until they rate you too.
        </p>
      </section>
    </>
  );
}

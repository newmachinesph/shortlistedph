import { Star } from "lucide-react";

const categories = [
  { label: "Payment punctuality", score: 5.0 },
  { label: "Communication", score: 4.7 },
  { label: "Scope respect", score: 4.6 },
];

export default function EmployerRatingsPage() {
  return (
    <>
      <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">Ratings</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Ratings unlock once an agreement closes. They&rsquo;re double-blind — visible to both sides only after both have rated, or automatically after 14 days.
      </p>

      <div className="mt-7 rounded-2xl border border-line bg-white p-6">
        <h2 className="text-sm font-medium uppercase tracking-wider text-ink-faint">How talent rates you</h2>
        <div className="mt-4 flex items-end gap-3">
          <span className="font-display text-4xl font-semibold text-ink">4.8</span>
          <span className="mb-1 flex items-center gap-1 text-sm text-ink-soft">
            <Star className="h-4 w-4 fill-brand text-brand" /> across 1 confirmed engagement
          </span>
        </div>
        <div className="mt-6 space-y-4">
          {categories.map((c) => (
            <div key={c.label}>
              <div className="flex items-center justify-between text-sm">
                <span className="text-ink-soft">{c.label}</span>
                <span className="font-medium text-ink">{c.score.toFixed(1)}</span>
              </div>
              <div className="mt-1.5 h-1.5 w-full rounded-full bg-line">
                <div
                  className="h-1.5 rounded-full bg-brand"
                  style={{ width: `${(c.score / 5) * 100}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      <h2 className="mt-9 mb-3 text-sm font-medium uppercase tracking-wider text-ink-faint">
        Reviews received
      </h2>
      <div className="rounded-2xl border border-line bg-white p-6">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium text-ink">Bookkeeping engagement · Jun 2026</p>
          <span className="flex items-center gap-1 text-sm text-ink">
            <Star className="h-3.5 w-3.5 fill-brand text-brand" /> 4.9
          </span>
        </div>
        <p className="mt-3 text-sm leading-relaxed text-ink-soft">
          &ldquo;Paid on time every single month, no chasing needed. Clear about scope from day one.&rdquo;
        </p>
        <p className="mt-3 text-xs text-ink-faint">
          Double-blind: released once both sides rate an engagement.
        </p>
      </div>

      <div className="mt-5 rounded-2xl border border-line bg-brand-soft/50 p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-medium text-ink">Rate your engagement with Jerome Dela Cruz</h3>
            <p className="mt-1 text-sm text-ink-soft">Your side is still open — add it to complete the exchange.</p>
          </div>
          <button className="rounded-xl px-4 py-2 text-sm font-medium text-brand ring-1 ring-inset ring-brand/30 transition-colors hover:bg-brand-soft">
            Rate engagement
          </button>
        </div>
      </div>
    </>
  );
}

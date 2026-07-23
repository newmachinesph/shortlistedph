import type { Metadata } from "next";
import { Star } from "lucide-react";
import { NOINDEX } from "@/lib/site";
import { requirePageUser } from "@/lib/queries";
import { listRateableForEmployer, listReceivedForEmployer } from "@/lib/ratings";
import { stamp } from "@/lib/notify";
import { RatingForm } from "@/components/rating-form";

export const metadata: Metadata = { title: "Ratings", ...NOINDEX };

function StarRow({ value }: { value: number }) {
  return (
    <span className="flex items-center gap-0.5" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          strokeWidth={1.75}
          className={`h-4 w-4 ${n <= value ? "fill-brand text-brand" : "text-ink-faint"}`}
        />
      ))}
    </span>
  );
}

export default async function EmployerRatingsPage() {
  const user = await requirePageUser("employer");
  const [rateable, received] = await Promise.all([
    listRateableForEmployer(user.id),
    listReceivedForEmployer(user.id),
  ]);
  const average = received.length
    ? (received.reduce((sum, r) => sum + r.stars, 0) / received.length).toFixed(1)
    : null;

  return (
    <>
      <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">Ratings</h1>
      <p className="mt-1 text-sm text-ink-soft">
        How the talent you hired rates you — payment punctuality, communication, scope respect.
      </p>

      <section className="mt-7">
        <h2 className="text-sm font-medium uppercase tracking-wider text-ink-faint">
          Rate your counterparts
        </h2>
        {rateable.length === 0 ? (
          <div className="mt-3 rounded-2xl border border-line bg-white p-6">
            <p className="text-sm leading-relaxed text-ink-soft">
              Nobody to rate right now. Rating opens once a candidate consents to a connection or
              completes a paid interview.
            </p>
          </div>
        ) : (
          <div className="mt-3 space-y-4">
            {rateable.map((c) => (
              <div key={c.connectionId} className="rounded-2xl border border-line bg-white p-6">
                <h3 className="font-medium text-ink">{c.counterpart}</h3>
                <p className="text-sm text-ink-soft">{c.jobTitle}</p>
                <RatingForm connectionId={c.connectionId} />
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mt-7">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-medium uppercase tracking-wider text-ink-faint">
            Ratings you&rsquo;ve received
          </h2>
          {average && (
            <span className="rounded-full border border-line px-2.5 py-1 text-[11px] text-ink-faint">
              {average} average · {received.length} rating{received.length === 1 ? "" : "s"}
            </span>
          )}
        </div>
        {received.length === 0 ? (
          <div className="mt-3 rounded-2xl border border-line bg-white p-6 text-center sm:p-10">
            <Star className="mx-auto h-8 w-8 text-ink-faint" strokeWidth={1.75} />
            <h3 className="font-display mt-4 text-lg font-semibold text-ink">No ratings yet</h3>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink-soft">
              Ratings from talent appear here. Both sides rate blind — a rating releases once you
              have both rated, or automatically after 14 days, so nobody can wait to see the
              other&rsquo;s score first.
            </p>
          </div>
        ) : (
          <div className="mt-3 space-y-4">
            {received.map((r) => (
              <div key={r.id} className="rounded-2xl border border-line bg-white p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h3 className="font-medium text-ink">{r.counterpart}</h3>
                    <p className="text-sm text-ink-soft">{r.jobTitle}</p>
                  </div>
                  <StarRow value={r.stars} />
                </div>
                {r.comment && (
                  <p className="mt-3 text-sm leading-relaxed text-ink-soft">{r.comment}</p>
                )}
                <p className="mt-3 text-xs text-ink-faint">{stamp(r.createdAt)}</p>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}

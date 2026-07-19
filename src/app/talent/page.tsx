import Link from "next/link";
import { ArrowRight, BadgeCheck, Camera, EyeOff } from "lucide-react";

const stats = [
  ["Jobs matched", "9", "this month"],
  ["Profile views", "4", "by shortlisting employers"],
  ["Times shortlisted", "2", "top-5 slates"],
  ["Connection requests", "1", "awaiting your consent"],
];

const activity: [when: string, what: string, highlight: boolean][] = [
  ["Today", "You were shortlisted #1 of 5 for a US healthcare role.", true],
  ["Today", "New connection request from a dental group in Austin, TX.", true],
  ["3 days ago", "Your profile matched a telehealth intake job (not shortlisted — rate band mismatch).", false],
  ["1 week ago", "An employer viewed your snapshot profile.", false],
];

export default function TalentDashboard() {
  return (
    <>
      <div className="flex items-center gap-4">
        <span className="font-display flex h-12 w-12 items-center justify-center rounded-xl bg-brand-soft text-lg font-semibold text-brand">
          KB
        </span>
        <div>
          <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">
            Magandang umaga, Kristine
          </h1>
          <p className="mt-0.5 text-sm text-ink-soft">
            Your profile is working while you aren&rsquo;t. Here&rsquo;s what it did.
          </p>
        </div>
      </div>

      <dl className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map(([label, value, sub]) => (
          <div key={label} className="rounded-2xl border border-line bg-white p-5">
            <dt className="text-xs text-ink-faint">{label}</dt>
            <dd className="font-display mt-1.5 text-3xl font-semibold text-brand">{value}</dd>
            <dd className="mt-0.5 text-xs text-ink-faint">{sub}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-brand px-6 py-5">
        <p className="text-sm font-medium text-white">
          A dental group in Austin wants to connect. You&rsquo;ll see their full
          job description before deciding.
        </p>
        <Link
          href="/talent/connections"
          className="inline-flex items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-brand transition-colors hover:bg-brand-soft"
        >
          Review request <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <section className="rounded-2xl border border-line bg-white p-6">
          <h2 className="text-sm font-medium uppercase tracking-wider text-ink-faint">
            How employers see you
          </h2>
          <ul className="mt-4 space-y-3.5 text-sm leading-relaxed text-ink-soft">
            <li className="flex gap-2.5">
              <EyeOff className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
              <span>
                You&rsquo;re invisible until you land on a shortlist — no
                browsing, no cold outreach.
              </span>
            </li>
            <li className="flex gap-2.5">
              <Camera className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
              <span>
                Your profile has been stable for{" "}
                <span className="font-medium text-ink">74 days</span>.
                Stability strengthens ranking — employers trust profiles that
                aren&rsquo;t rewritten per job.
              </span>
            </li>
            <li className="flex gap-2.5">
              <BadgeCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
              <span>
                You&rsquo;re ID-verified. Your documents were never uploaded
                here — you&rsquo;ll show them to an employer only after hiring,
                if you choose.
              </span>
            </li>
          </ul>
          <Link
            href="/talent/profile"
            className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-brand hover:underline"
          >
            View your standing profile <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </section>

        <section className="rounded-2xl border border-line bg-white p-6">
          <h2 className="text-sm font-medium uppercase tracking-wider text-ink-faint">
            Recent activity
          </h2>
          <ul className="mt-4">
            {activity.map(([when, what, highlight], i) => (
              <li key={what} className="relative flex gap-3.5 pb-5 last:pb-0">
                {i < activity.length - 1 && (
                  <span aria-hidden className="absolute left-[5px] top-4 h-full w-px bg-line" />
                )}
                <span
                  aria-hidden
                  className={`mt-1.5 h-[11px] w-[11px] shrink-0 rounded-full ring-2 ring-white ${
                    highlight ? "bg-brand" : "bg-line"
                  }`}
                />
                <div className="text-sm leading-relaxed">
                  <span className="text-xs text-ink-faint">{when}</span>
                  <p className={highlight ? "mt-0.5 font-medium text-ink" : "mt-0.5 text-ink-soft"}>
                    {what}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}

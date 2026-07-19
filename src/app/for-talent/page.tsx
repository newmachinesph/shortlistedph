import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BadgeCheck, Clock, Lock, ShieldOff, Wallet } from "lucide-react";
import { PublicPage } from "@/components/public-chrome";
import { DiditMockup } from "@/components/didit-mockup";
import { pageMeta } from "@/lib/site";

export const metadata: Metadata = pageMeta({
  title: "For talent",
  description:
    "Upload your resume once. Every hidden job description gets matched against your standing profile automatically. Verification is optional, your documents stay yours, and you never pay us for placement.",
  path: "/for-talent",
});

const neverStore: [string, string][] = [
  [
    "Your ID and NBI clearance",
    "Neither ever reaches our servers. Verification runs inside Didit; we receive a pass or fail and a timestamp, nothing else. When an employer eventually needs to see the documents, you hand them over yourself.",
  ],
  [
    "Your PhilSys PSN",
    "The permanent 12-digit number on the back of your national ID is classified sensitive information under RA 11055, and storing it without authority carries prison time. We never ask for it and never keep it. The card number on the front is all verification needs.",
  ],
  [
    "Selfies and session video",
    "Didit holds those under its own retention policy for as long as the check takes. We store the verdict.",
  ],
];

export default function ForTalentPage() {
  return (
    <PublicPage>

      <section className="mx-auto w-full max-w-6xl px-5 pt-14 pb-16 sm:px-8">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-ember">For talent</p>
        <h1 className="font-display mt-4 max-w-3xl text-[clamp(2rem,8vw,3.75rem)] font-semibold leading-[1.08] tracking-tight text-ink">
          Never write another application.
        </h1>
        <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-soft">
          You upload a resume once; after that, every hidden job description that comes through
          gets matched against your profile whether you&rsquo;re at your desk or asleep. There is
          nothing to apply to, so there is nothing to tailor.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-4">
          <Link
            href="/onboarding"
            className="inline-flex items-center gap-2 rounded-2xl bg-brand px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-brand/25 transition-colors hover:bg-brand-dark"
          >
            Upload your resume <ArrowRight className="h-4 w-4" />
          </Link>
          <span className="text-sm text-ink-soft">Free, and it stays free.</span>
        </div>
      </section>

      <section className="w-full border-y border-line bg-white">
        <div className="mx-auto grid max-w-6xl items-center gap-14 px-5 py-20 sm:px-8 lg:grid-cols-[1fr_320px]">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-3 py-1 text-xs font-medium text-brand">
              <BadgeCheck className="h-3.5 w-3.5" /> Optional
            </span>
            <h2 className="font-display mt-4 text-3xl font-semibold tracking-tight text-ink">
              Prove you&rsquo;re you, if you want to
            </h2>
            <p className="mt-4 max-w-xl leading-relaxed text-ink-soft">
              Employers hiring across an ocean carry one fear above all others: that the person
              they interviewed isn&rsquo;t the person who turns up on Monday. A verified profile
              answers that before they have to ask, which tends to make the first conversation
              shorter and warmer.
            </p>
            <p className="mt-4 max-w-xl leading-relaxed text-ink-soft">
              Skipping it costs you nothing structural. Unverified people get shortlisted and
              hired here every bit as much, because ranking runs on evidence of work rather than
              on a badge.
            </p>

            <div className="mt-8 grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-line p-5">
                <Clock className="h-5 w-5 text-brand" strokeWidth={1.75} />
                <h3 className="mt-3 font-medium text-ink">About four minutes</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
                  Your PhilID, driver&rsquo;s licence or passport, then a selfie. If you hold a
                  Philippine ePassport, its chip can be read directly, which is the strongest proof
                  available.
                </p>
              </div>
              <div className="rounded-2xl border border-line p-5">
                <Wallet className="h-5 w-5 text-brand" strokeWidth={1.75} />
                <h3 className="mt-3 font-medium text-ink">₱60, none of it ours</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
                  Paid once by QR Ph from GCash, Maya or any bank app. That is what the check
                  costs and we keep none of it. It pays for the check itself; it does not buy a
                  position, a placement, or a job.
                </p>
              </div>
            </div>
          </div>

          <DiditMockup />
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-5 py-20 sm:px-8">
        <div className="flex items-start gap-3">
          <Lock className="mt-1 h-5 w-5 shrink-0 text-brand" strokeWidth={1.75} />
          <div>
            <h2 className="font-display text-3xl font-semibold tracking-tight text-ink">
              What we never store
            </h2>
            <p className="mt-3 max-w-2xl leading-relaxed text-ink-soft">
              Most platforms ask for your documents and keep them. We built this the other way
              round, partly because the law is strict and mostly because a database of Filipino
              workers&rsquo; IDs is a target we refuse to become.
            </p>
          </div>
        </div>
        <dl className="mt-10 grid gap-5 lg:grid-cols-3">
          {neverStore.map(([term, detail]) => (
            <div key={term} className="rounded-2xl border border-line bg-white p-6">
              <dt className="font-medium text-ink">{term}</dt>
              <dd className="mt-2 text-sm leading-relaxed text-ink-soft">{detail}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="w-full border-y border-line bg-white">
        <div className="mx-auto max-w-3xl px-5 py-20 sm:px-8">
          <h2 className="font-display text-3xl font-semibold tracking-tight text-ink">
            About your NBI clearance
          </h2>
          <p className="mt-4 leading-relaxed text-ink-soft">
            Get one, keep it current, and show it to your employer directly once you&rsquo;re
            hired. Never upload it here, and be careful where else you upload it: several sites
            offering to &ldquo;verify&rdquo; NBI clearances online have no connection to the NBI
            at all, and handing them your details tells you nothing while costing you privacy.
          </p>
          <p className="mt-4 leading-relaxed text-ink-soft">
            A clearance is valid for a year and costs ₱130 plus a ₱25 payment fee. Overseas
            employers rarely know what it is, so it helps to explain: it means the NBI searched
            its records against your name and fingerprints on the day it was issued and found
            nothing. If your name is common, expect a &ldquo;hit&rdquo; and a short interview to
            clear it, which is routine and not a mark against you.
          </p>
          <p className="mt-4 leading-relaxed text-ink-soft">
            Anyone charging you to be placed, shortlisted, or &ldquo;prioritised&rdquo; for a job
            is running the oldest recruitment scam in the country. That includes anyone claiming
            to represent us.{" "}
            <Link href="/conduct" className="font-medium text-brand hover:underline">
              Report them
            </Link>
            .
          </p>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-5 py-20 sm:px-8">
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="rounded-2xl border border-line bg-white p-7">
            <ShieldOff className="h-5 w-5 text-ember" strokeWidth={1.75} />
            <h3 className="font-display mt-4 text-xl font-semibold text-ink">
              What verification won&rsquo;t do
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-ink-soft">
              It won&rsquo;t make a thin profile strong, and it can&rsquo;t vouch for skills you
              haven&rsquo;t evidenced. Ranking still runs mostly on what your resume and past
              engagements actually support; verification breaks ties, it doesn&rsquo;t win them.
              The fastest way up the list is a confirmed outcome from someone who worked with you.
            </p>
          </div>
          <div className="rounded-2xl border border-line bg-white p-7">
            <BadgeCheck className="h-5 w-5 text-brand" strokeWidth={1.75} />
            <h3 className="font-display mt-4 text-xl font-semibold text-ink">
              One rate, one profile
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-ink-soft">
              You set a standing rate that every employer sees, and it locks for 30 days after any
              change. That sounds restrictive until you realise what it kills: the negotiation
              theatre where whoever guesses the number best wins, instead of whoever does the job
              best.
            </p>
          </div>
        </div>
      </section>

      <section className="mx-auto w-full max-w-6xl px-5 pb-24 sm:px-8">
        <div className="rounded-3xl bg-brand px-6 py-12 text-center sm:px-14 sm:py-14">
          <h2 className="font-display mx-auto max-w-2xl text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Upload once. Get matched while you sleep.
          </h2>
          <Link
            href="/onboarding"
            className="mt-8 inline-block rounded-2xl bg-white px-6 py-3.5 text-sm font-semibold text-brand transition-colors hover:bg-brand-soft"
          >
            Build my profile — free
          </Link>
        </div>
      </section>

      </PublicPage>
  );
}

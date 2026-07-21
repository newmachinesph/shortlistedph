import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  ClipboardList,
  FileText,
  Gauge,
  Handshake,
  ShieldCheck,
  Video,
} from "lucide-react";
import { PublicPage } from "@/components/public-chrome";
import { JsonLd } from "@/components/json-ld";
import { pageMeta, SITE_URL } from "@/lib/site";
import {
  INTERVIEW_DURATION_MINUTES,
  INTERVIEWER_RATE_MIN,
  INTERVIEWER_RATE_MAX,
  employerPrice,
  interviewerPoolStats,
} from "@/lib/interviews";

export const metadata: Metadata = pageMeta({
  title: "Interview screening for shortlisted candidates",
  description:
    "Have any candidate on your shortlist interviewed by a vetted interviewer before you commit. A recorded 30-minute session, a structured written assessment, and the candidate consents before anything is charged.",
  path: "/interviews",
});

/** Pool figures are read from the database; refresh hourly, not per request. */
export const revalidate = 3600;

const lowPrice = employerPrice(INTERVIEWER_RATE_MIN);
const highPrice = employerPrice(INTERVIEWER_RATE_MAX);

const steps = [
  {
    icon: ClipboardList,
    title: "You request an interview",
    body: "Signed in, looking at a real candidate on a shortlist you've already unlocked, you ask for one to be interviewed. You pick the interviewer from a pool matched to the role; you never post the request into the open.",
  },
  {
    icon: Handshake,
    title: "The candidate consents first",
    body: "Before a peso moves, the candidate agrees to sit the interview and to being recorded. If they decline, nothing is charged and the request ends there. Consent comes ahead of payment on purpose, so a no never took your money.",
  },
  {
    icon: Video,
    title: `A recorded ${INTERVIEW_DURATION_MINUTES}-minute session`,
    body: "The interviewer runs a live conversation on a fixed template, records it, and probes the specific claims that matter for the job rather than reading the resume back to them.",
  },
  {
    icon: FileText,
    title: "A written assessment comes back",
    body: "You get a structured report on the same fields every time: a hire recommendation, scores, and the interviewer's read on where the candidate is strong and where you'd want to push harder.",
  },
];

const assessmentFields = [
  [
    "A recommendation",
    "Strong yes, yes, lean yes, or no. One line that says whether the interviewer would put this person in front of you again.",
  ],
  [
    "Three scores",
    "Technical depth, communication, and spoken English, each rated so you can compare one candidate against another on the same scale.",
  ],
  [
    "Strengths",
    "What held up under questioning. The claims the interviewer pushed on and came away convinced by.",
  ],
  [
    "Concerns",
    "Where the answers thinned out, what the interviewer couldn't confirm, and the questions still worth asking yourself.",
  ],
];

function serviceSchema(count: number) {
  return {
    "@context": "https://schema.org",
    "@type": "Service",
    name: "Candidate interview screening",
    description:
      "A vetted interviewer runs a recorded 30-minute interview of a shortlisted candidate and returns a structured written assessment: a hire recommendation, scores for technical skill, communication and English, plus strengths and concerns.",
    provider: { "@id": `${SITE_URL}/#organization` },
    serviceType: "Pre-hire interview screening",
    areaServed: { "@type": "Country", name: "Philippines" },
    ...(count > 0 ? { audience: { "@type": "Audience", audienceType: "Employers hiring remote talent" } } : {}),
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: "USD",
      lowPrice: String(lowPrice),
      highPrice: String(highPrice),
      description:
        "Priced per interview. The interviewer sets their own rate; a flat platform fee is added on top.",
    },
  };
}

export default async function InterviewsPage() {
  const pool = await interviewerPoolStats();
  const hasPool = pool.count > 0;

  return (
    <>
      <JsonLd data={serviceSchema(pool.count)} />
      <PublicPage>
        <section className="mx-auto w-full max-w-6xl px-5 pt-14 pb-16 sm:px-8">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-brand">
            Pay-per-interview
          </p>
          <h1 className="font-display mt-4 max-w-3xl text-[clamp(2rem,8vw,3.75rem)] font-semibold leading-[1.08] tracking-tight text-ink">
            Interview the shortlist before you bet on it.
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-soft">
            A ranked profile tells you who to talk to, not how they hold up in a room. Have any
            candidate on your shortlist interviewed by a vetted interviewer, get a recorded session
            and a written assessment back, and decide on evidence instead of a document.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <Link
              href="/for-employers"
              className="inline-flex items-center gap-2 rounded-2xl bg-brand px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-brand/25 transition-colors hover:bg-brand-dark"
            >
              Start with a shortlist <ArrowRight className="h-4 w-4" />
            </Link>
            <span className="text-sm text-ink-soft">
              You request an interview once you&rsquo;re signed in and looking at a candidate.
            </span>
          </div>
        </section>

        <section className="w-full border-y border-line bg-white">
          <div className="mx-auto max-w-4xl px-5 py-20 sm:px-8">
            <h2 className="font-display max-w-2xl text-3xl font-semibold tracking-tight text-ink">
              How an interview happens
            </h2>
            <p className="mt-3 max-w-2xl leading-relaxed text-ink-soft">
              Four steps, and the order is the point: the candidate says yes before you&rsquo;re
              ever charged.
            </p>
            <ol className="mt-10 space-y-12">
              {steps.map((s, i) => (
                <li key={s.title} className="flex gap-4 sm:gap-6">
                  <div className="flex flex-col items-center">
                    <span className="font-display flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-sm font-semibold text-brand">
                      {i + 1}
                    </span>
                    {i < steps.length - 1 && (
                      <span aria-hidden className="mt-3 w-px flex-1 bg-line" />
                    )}
                  </div>
                  <div className="min-w-0 pb-2">
                    <h3 className="font-display flex items-center gap-2.5 text-lg font-semibold text-ink sm:text-xl">
                      <s.icon className="h-5 w-5 shrink-0 text-brand" strokeWidth={1.75} />
                      {s.title}
                    </h3>
                    <p className="mt-3 max-w-2xl leading-relaxed text-ink-soft">{s.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-5 py-20 sm:px-8">
          <h2 className="font-display max-w-2xl text-3xl font-semibold tracking-tight text-ink">
            What the assessment contains
          </h2>
          <p className="mt-3 max-w-2xl leading-relaxed text-ink-soft">
            Every report uses the same fixed fields. The interviewer fills the template; they
            don&rsquo;t design it, so two candidates you interviewed a week apart line up side by
            side.
          </p>
          <dl className="mt-10 grid gap-5 sm:grid-cols-2">
            {assessmentFields.map(([term, detail]) => (
              <div key={term} className="rounded-2xl border border-line bg-white p-6">
                <dt className="font-medium text-ink">{term}</dt>
                <dd className="mt-2 text-sm leading-relaxed text-ink-soft">{detail}</dd>
              </div>
            ))}
          </dl>
        </section>

        <section className="w-full border-y border-line bg-white">
          <div className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
            <div className="flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-brand">
              <ShieldCheck className="h-4 w-4" strokeWidth={1.75} /> The interviewer pool
            </div>
            {hasPool ? (
              <>
                <h2 className="font-display mt-4 max-w-2xl text-3xl font-semibold tracking-tight text-ink">
                  Vetted interviewers, chosen for the role you&rsquo;re hiring.
                </h2>
                <p className="mt-3 max-w-2xl leading-relaxed text-ink-soft">
                  We don&rsquo;t run a directory you can browse and poach from. You see the pool as
                  numbers here, and pick a specific interviewer only once you&rsquo;re signed in
                  and looking at a real candidate.
                </p>
                <dl className="mt-10 flex flex-wrap gap-x-12 gap-y-6 border-t border-line pt-8">
                  {[
                    [pool.count.toLocaleString("en-PH"), "vetted interviewers active"],
                    ...(pool.domains > 0
                      ? ([[`${pool.domains}`, "fields of expertise covered"]] as [string, string][])
                      : []),
                    ...(pool.avgYears > 0
                      ? ([[`${pool.avgYears} yrs`, "average experience"]] as [string, string][])
                      : []),
                  ].map(([v, l]) => (
                    <div key={l}>
                      <dt className="sr-only">{l}</dt>
                      <dd className="font-display text-3xl font-semibold text-ink">{v}</dd>
                      <dd className="mt-1 text-sm text-ink-faint">{l}</dd>
                    </div>
                  ))}
                </dl>
              </>
            ) : (
              <>
                <h2 className="font-display mt-4 max-w-2xl text-3xl font-semibold tracking-tight text-ink">
                  Vetted interviewers, chosen for the role you&rsquo;re hiring.
                </h2>
                <p className="mt-3 max-w-2xl leading-relaxed text-ink-soft">
                  Every interviewer is screened for their field before they can take a request, and
                  matched to the role rather than picked off a list. There&rsquo;s no directory to
                  browse or poach from: you choose an interviewer only once you&rsquo;re signed in
                  and looking at a real candidate. If your field isn&rsquo;t covered yet, we&rsquo;ll
                  tell you before you commit to anything.
                </p>
              </>
            )}
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-5 py-20 sm:px-8">
          <div className="grid gap-10 lg:grid-cols-2">
            <div>
              <h2 className="font-display max-w-md text-3xl font-semibold tracking-tight text-ink">
                Why interview before you commit
              </h2>
              <p className="mt-4 max-w-md leading-relaxed text-ink-soft">
                A profile is what someone claims and what a past engagement was willing to confirm.
                It gets you a good shortlist; it can&rsquo;t tell you how a person reasons out loud,
                handles a question they didn&rsquo;t expect, or sounds on a call with your client.
                An interview does, and a recorded one means you can go back to the tape instead of
                trusting a memory of it.
              </p>
              <p className="mt-4 max-w-md leading-relaxed text-ink-soft">
                Hiring on a document alone is the risk this removes. Spend a little to see the
                person before you spend a lot to onboard them.
              </p>
            </div>
            <div className="rounded-3xl border border-line bg-white p-8">
              <div className="flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-ink-faint">
                <Gauge className="h-4 w-4 text-brand" strokeWidth={1.75} /> What it costs
              </div>
              <p className="font-display mt-4 text-4xl font-semibold text-ink">
                ${lowPrice}&ndash;${highPrice}
              </p>
              <p className="mt-1 text-sm text-ink-faint">per interview, paid once</p>
              <p className="mt-5 text-sm leading-relaxed text-ink-soft">
                There&rsquo;s no single sticker price, because interviewers set their own rate
                between ${INTERVIEWER_RATE_MIN} and ${INTERVIEWER_RATE_MAX}. A flat platform fee
                sits on top, and you see the exact total for the interviewer you pick before you
                confirm. Nothing is charged until the candidate has consented.
              </p>
            </div>
          </div>
        </section>

        <section className="mx-auto w-full max-w-6xl px-5 pb-24 pt-4 sm:px-8">
          <div className="rounded-3xl bg-brand px-6 py-12 text-center sm:px-14 sm:py-14">
            <h2 className="font-display mx-auto max-w-2xl text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              Get the shortlist, then interview the ones worth interviewing.
            </h2>
            <p className="mx-auto mt-4 max-w-lg text-sm leading-relaxed text-white/80">
              Post a job description, unlock your slate, and request an interview on any candidate
              you want a closer look at.
            </p>
            <Link
              href="/for-employers"
              className="mt-8 inline-block rounded-2xl bg-white px-6 py-3.5 text-sm font-semibold text-brand transition-colors hover:bg-brand-soft"
            >
              See how it works for employers
            </Link>
            <p className="mt-6 text-sm text-white/80">
              Interview people for a living?{" "}
              <Link href="/apply/interviewer" className="font-medium text-white underline hover:text-brand-soft">
                Join the interviewer pool
              </Link>
              .
            </p>
          </div>
        </section>
      </PublicPage>
    </>
  );
}

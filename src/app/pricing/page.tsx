import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { PublicPage } from "@/components/public-chrome";
import { JsonLd } from "@/components/json-ld";
import { pageMeta } from "@/lib/site";

export const metadata: Metadata = pageMeta({
  title: "Pricing",
  description:
    "Employers pay per shortlist. Talent pays nothing to be listed, matched or hired. No job ads, no per-hire fees, no salary handling.",
  path: "/pricing",
});

const tiers = [
  {
    name: "Preview",
    price: "Free",
    unit: "see your slate before paying",
    highlight: false,
    features: [
      "Post a hidden job description",
      "Full ranked slate of 5: scores, match reasons, dimension bars",
      "Names and photos blurred",
      "Dossiers and connections locked",
      "No card required",
    ],
    cta: "Post a job description",
  },
  {
    name: "Unlock",
    price: "$49",
    unit: "per shortlist",
    highlight: true,
    features: [
      "Names, dossiers, snapshot profiles",
      "Connection requests included",
      "Free re-slate if fewer than 3 consent",
      "Pay only after you've seen the slate",
      "Three-pack: $119, credits never expire",
    ],
    cta: "Unlock a shortlist",
  },
  {
    name: "Hiring desk",
    price: "$249",
    unit: "per month",
    highlight: false,
    features: [
      "10 shortlists per month",
      "Team seats for your staff",
      "Silver-medalist pool across jobs",
      "Priority matching queue",
      "Cancel anytime",
    ],
    cta: "Talk to us",
  },
];

const faqs = [
  [
    "Do you handle salaries or contracts?",
    "No. We are sourcing only. You hire and pay your worker directly. No escrow, no cut of wages, no per-hire fee. You pay for the shortlist, and what happens after is between you and your hire.",
  ],
  [
    "Why is the preview free?",
    "Because the slate sells itself. You see exactly who ranked and why before paying a peso. If the match quality doesn't convince you, don't unlock it.",
  ],
  [
    "What if nobody on my slate consents to connect?",
    "If fewer than 3 of 5 candidates accept your connection request, we rebuild the slate free. Candidates see your response-rate score; employers who respond fast rarely need this.",
  ],
  [
    "Does talent ever pay anything?",
    "Never to be listed, matched, shortlisted, prioritised, or hired. Placement fees are the oldest recruitment scam in Philippine hiring and we will not touch them. Identity verification sits outside that entirely: it is optional, it is a check run by an outside provider, the ₱60 covers what the check costs and we keep none of it. People who skip it get shortlisted and hired here the same as anyone else.",
  ],
  [
    "Why can't I browse candidates?",
    "Browsing is what makes resumes fake. Because candidates can't see jobs and employers can't scrape profiles, nobody can game the match. You get a ranked slate instead. That's the product.",
  ],
];

/** Generated from the same array the page renders, so the two can't drift. */
const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map(([question, answer]) => ({
    "@type": "Question",
    name: question,
    acceptedAnswer: { "@type": "Answer", text: answer },
  })),
};

export default function PricingPage() {
  return (
    <>
      <JsonLd data={faqSchema} />
      <PublicPage>

      <section className="mx-auto w-full max-w-6xl px-5 pt-14 pb-16 text-center sm:px-8">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-ember">Pricing</p>
        <h1 className="font-display mx-auto mt-4 max-w-2xl text-4xl font-semibold tracking-tight text-ink sm:text-5xl">
          Employers pay per shortlist.
          <br />
          Talent pays <span className="text-brand">nothing to get hired</span>.
        </h1>
        <p className="mx-auto mt-5 max-w-xl leading-relaxed text-ink-soft">
          Post a job description and see your ranked slate free, then pay only to
          unlock names and connections. No per-hire percentage, no salary
          handling. The hire is yours.
        </p>
      </section>

      <section className="mx-auto w-full max-w-6xl px-5 pb-16 sm:px-8">
        <div className="grid gap-5 lg:grid-cols-3">
          {tiers.map((t) => (
            <div
              key={t.name}
              className={`flex flex-col rounded-3xl p-7 ${
                t.highlight
                  ? "bg-brand text-white shadow-xl shadow-brand/25"
                  : "border border-line bg-white"
              }`}
            >
              <h2 className={`text-sm font-medium uppercase tracking-wider ${t.highlight ? "text-white/80" : "text-ink-faint"}`}>
                {t.name}
              </h2>
              <p className="font-display mt-3 text-4xl font-semibold">{t.price}</p>
              <p className={`mt-1 text-sm ${t.highlight ? "text-white/80" : "text-ink-faint"}`}>{t.unit}</p>
              <ul className="mt-6 flex-1 space-y-2.5">
                {t.features.map((f) => (
                  <li key={f} className="flex gap-2.5 text-sm leading-relaxed">
                    <Check className={`mt-0.5 h-4 w-4 shrink-0 ${t.highlight ? "text-white/80" : "text-brand"}`} />
                    <span className={t.highlight ? "text-white/90" : "text-ink-soft"}>{f}</span>
                  </li>
                ))}
              </ul>
              <Link
                href="/employer/briefs/new"
                className={`mt-7 inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold transition-colors ${
                  t.highlight
                    ? "bg-white text-brand hover:bg-brand-soft"
                    : "bg-brand text-white hover:bg-brand-dark"
                }`}
              >
                {t.cta} <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          ))}
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-4 rounded-3xl border border-line bg-white px-7 py-6">
          <div>
            <h2 className="font-display text-xl font-semibold text-ink">
              For talent: free to join, free to get hired.
            </h2>
            <p className="mt-1 max-w-xl text-sm leading-relaxed text-ink-soft">
              Standing profile, automatic matching, and every shortlist you land on,
              all free, permanently. Identity verification is the one optional extra,
              and the ₱60 goes to the check rather than to us. If anyone ever asks you
              to pay to be placed, it&rsquo;s not us.
            </p>
          </div>
          <Link
            href="/onboarding"
            className="inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-sm font-semibold text-brand ring-1 ring-inset ring-brand/30 transition-colors hover:bg-brand-soft"
          >
            Upload your resume <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      <section className="mx-auto w-full max-w-3xl px-5 pb-24 sm:px-8">
        <h2 className="font-display text-2xl font-semibold tracking-tight text-ink">
          Questions we always get
        </h2>
        <dl className="mt-6 space-y-6">
          {faqs.map(([q, a]) => (
            <div key={q} className="rounded-2xl border border-line bg-white p-6">
              <dt className="font-medium text-ink">{q}</dt>
              <dd className="mt-2 text-sm leading-relaxed text-ink-soft">{a}</dd>
            </div>
          ))}
        </dl>
      </section>

      </PublicPage>
    </>
  );
}

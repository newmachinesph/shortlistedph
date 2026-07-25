import type { Metadata } from "next";
import { ArrowRight, Check } from "lucide-react";
import { PublicPage } from "@/components/public-chrome";
import { JsonLd } from "@/components/json-ld";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Section } from "@/components/ui/section";
import { pageMeta } from "@/lib/site";
import { employerPrice } from "@/lib/interviews";

const interviewPrice = employerPrice();

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

      {/* Hero — centered, the one pricing promise. */}
      <section className="mx-auto w-full max-w-6xl px-5 pt-14 pb-16 text-center sm:px-8">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-ember">Pricing</p>
        <h1 className="font-display mx-auto mt-4 max-w-2xl font-semibold leading-[1.1] tracking-tight text-ink [font-size:var(--text-h1)]">
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

      {/* Tiers — the highlighted Unlock card carries the band colour. */}
      <section className="mx-auto w-full max-w-6xl px-5 pb-16 sm:px-8">
        <div className="grid gap-5 lg:grid-cols-3">
          {tiers.map((t) => (
            <div
              key={t.name}
              className={`flex flex-col p-7 [border-radius:var(--radius-lg)] ${
                t.highlight
                  ? "bg-brand text-white shadow-xl shadow-brand/25"
                  : "border border-line bg-[var(--color-surface)] [box-shadow:var(--shadow-card)]"
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
              <ButtonLink
                href="/start"
                variant="solid"
                size="md"
                className={`mt-7 ${
                  t.highlight
                    ? "!bg-white !text-brand !shadow-none hover:!bg-brand-soft"
                    : "!shadow-none"
                }`}
              >
                {t.cta} <ArrowRight className="h-4 w-4" />
              </ButtonLink>
            </div>
          ))}
        </div>

        <Card className="mt-5 flex flex-wrap items-center justify-between gap-4 px-7 py-6 ![border-radius:var(--radius-lg)]">
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
          <ButtonLink href="/onboarding" variant="outline" size="md">
            Upload your resume <ArrowRight className="h-4 w-4" />
          </ButtonLink>
        </Card>
      </section>

      {/* Interview add-on. */}
      <section className="mx-auto w-full max-w-6xl px-5 pb-16 sm:px-8">
        <Card className="flex flex-col gap-6 px-7 py-8 ![border-radius:var(--radius-lg)] sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-brand">
              Add-on: pay per interview
            </p>
            <h2 className="font-display mt-3 text-xl font-semibold text-ink">
              Have a shortlisted candidate interviewed before you commit.
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">
              Once your slate is unlocked, you can ask a vetted interviewer to run a recorded
              30-minute session with any candidate and send back a written assessment. It&rsquo;s a
              flat ${interviewPrice} per interview, whichever candidate and interviewer. The
              candidate consents before anything is charged.
            </p>
          </div>
          <ButtonLink href="/interviews" variant="outline" size="md" className="shrink-0">
            How interviews work <ArrowRight className="h-4 w-4" />
          </ButtonLink>
        </Card>
      </section>

      {/* FAQ — narrow measure. */}
      <Section tone="white">
        <div className="mx-auto max-w-3xl">
          <h2 className="font-display font-semibold tracking-tight text-ink [font-size:var(--text-h2)]">
            Questions we always get
          </h2>
          <dl className="mt-6 space-y-6">
            {faqs.map(([q, a]) => (
              <Card key={q} className="p-6">
                <dt className="font-medium text-ink">{q}</dt>
                <dd className="mt-2 text-sm leading-relaxed text-ink-soft">{a}</dd>
              </Card>
            ))}
          </dl>
        </div>
      </Section>

      </PublicPage>
    </>
  );
}

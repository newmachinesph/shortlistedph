import Link from "next/link";
import { ArrowRight, EyeOff, Camera, Lock, FileCheck } from "lucide-react";
import { LogoMark } from "@/components/logo";
import { AvatarCluster } from "@/components/avatar-cluster";
import { PublicPage } from "@/components/public-chrome";
import { JsonLd } from "@/components/json-ld";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Section, SectionHeader } from "@/components/ui/section";
import { StatStrip } from "@/components/ui/stat";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";
import { getPublicStats } from "@/lib/stats";
import { getShowcaseAvatars } from "@/lib/talent-showcase";

const orgSchema = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${SITE_URL}/#organization`,
      name: SITE_NAME,
      url: SITE_URL,
      logo: `${SITE_URL}/mark.svg`,
      description: SITE_DESCRIPTION,
      sameAs: ["https://www.facebook.com/phshortlisted/"],
      areaServed: { "@type": "Country", name: "Philippines" },
      knowsAbout: [
        "remote hiring",
        "Philippine remote talent sourcing",
        "candidate identity verification",
      ],
    },
    {
      "@type": "WebSite",
      "@id": `${SITE_URL}/#website`,
      url: SITE_URL,
      name: SITE_NAME,
      description: SITE_DESCRIPTION,
      publisher: { "@id": `${SITE_URL}/#organization` },
      inLanguage: "en-PH",
    },
    {
      "@type": "Service",
      name: "Automated candidate shortlisting",
      provider: { "@id": `${SITE_URL}/#organization` },
      serviceType: "Recruitment sourcing",
      areaServed: { "@type": "Country", name: "Philippines" },
      offers: {
        "@type": "Offer",
        price: "49",
        priceCurrency: "USD",
        description: "Unlock one ranked shortlist. Previewing the ranked slate is free.",
      },
    },
  ],
};

const antiGaming = [
  {
    icon: EyeOff,
    title: "Job descriptions are hidden",
    body: "Candidates never see what employers are looking for, so there is nothing to tailor a resume to.",
  },
  {
    icon: Camera,
    title: "Profiles are snapshots",
    body: "Employers see each profile as it existed when their job description was posted. Editing after the fact changes nothing.",
  },
  {
    icon: FileCheck,
    title: "Rates are standing",
    body: "One rate per person, with visible history and a cooldown. No quoting one number to a startup and another to a US company.",
  },
  {
    icon: Lock,
    title: "Documents stay yours",
    body: "Verification is optional. IDs and NBI clearance are never uploaded to us mid-process. You show them directly to your employer once you're hired.",
  },
];

/** Figures come from the database; re-read hourly rather than on every request. */
export const revalidate = 3600;

export default async function Home() {
  const [stats, showcase] = await Promise.all([getPublicStats(), getShowcaseAvatars(9)]);

  return (
    <>
      <JsonLd data={orgSchema} />
      <PublicPage>

      {/* Hero — Marquee. The one promise, at display scale. */}
      <section className="mx-auto w-full max-w-6xl px-5 pt-16 pb-[var(--space-section)] sm:px-8 sm:pt-24">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-ember">
          Shortlists, not job ads · Philippine remote talent
        </p>
        <h1 className="font-display mt-5 max-w-4xl font-semibold leading-[1.02] tracking-tight text-ink [font-size:var(--text-display)] [overflow-wrap:anywhere]">
          Don&rsquo;t post a job ad. Get a <span className="text-brand">shortlist</span>.
        </h1>
        <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-soft">
          Tell us who you need. Our matching engine ranks Filipino remote professionals against
          your job description and hands you the top candidates. No job ads, no application spam.
        </p>
        <div className="mt-9 flex flex-wrap items-center gap-4">
          <ButtonLink href="/start" variant="solid">
            Write your job description <ArrowRight className="h-4 w-4" />
          </ButtonLink>
          <ButtonLink href="/onboarding" variant="outline">
            I&rsquo;m talent: upload my resume
          </ButtonLink>
        </div>
        <div className="mt-10">
          <AvatarCluster
            images={showcase}
            caption={
              stats
                ? `${stats.matchable.toLocaleString("en-PH")} profiles ready to be matched today`
                : undefined
            }
          />
        </div>
        {stats && (
          <div className="mt-14">
            <StatStrip
              items={[
                { value: stats.profiles.toLocaleString("en-PH"), label: "profiles in the talent pool" },
                { value: `${stats.avgYears} yrs`, label: "average experience" },
                { value: `$${stats.medianRateUsd}`, label: "median hourly rate" },
                { value: "₱0", label: "for talent to join and get hired" },
              ]}
            />
          </div>
        )}
      </section>

      {/* Two audiences, one engine — the split that carries the whole product. */}
      <Section id="employers" tone="white">
        <div className="grid gap-14 lg:grid-cols-2">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-brand">For employers</p>
            <h2 className="font-display mt-3 font-semibold tracking-tight text-ink [font-size:var(--text-h2)]">
              Stop reading 400 applications.
            </h2>
            <ol className="mt-8 space-y-6">
              {[
                ["Write a job description", "Real budget, real dealbreakers. It stays hidden from candidates, so you can be honest."],
                ["We match and rank", "Every profile is embedded and scored against your job description. You see why each person ranked."],
                ["Meet your shortlist", "A slate of 5, with snapshot-frozen profiles. Request a connection; candidates consent before contact."],
              ].map(([t, b], i) => (
                <li key={t} className="flex gap-4">
                  <span className="font-display flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand-soft text-sm font-semibold text-brand">
                    {i + 1}
                  </span>
                  <span>
                    <span className="block font-medium text-ink">{t}</span>
                    <span className="mt-1 block text-sm leading-relaxed text-ink-soft">{b}</span>
                  </span>
                </li>
              ))}
            </ol>
            <Link
              href="/for-employers"
              className="mt-7 inline-flex items-center gap-2 text-sm font-medium text-brand hover:underline"
            >
              More for employers <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div id="talent" className="scroll-mt-28 lg:border-l lg:border-line lg:pl-14">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-ember">For talent</p>
            <h2 className="font-display mt-3 font-semibold tracking-tight text-ink [font-size:var(--text-h2)]">
              Never write another application.
            </h2>
            <ol className="mt-8 space-y-6">
              {[
                ["Upload your resume once", "We build your standing profile from it. Review it, fix what's wrong, done in minutes."],
                ["Your profile does the work", "Every new job is matched against you automatically, while you sleep."],
                ["Get shortlisted", "When an employer wants to talk, you see the full job description and decide. Nothing is shared without your consent."],
              ].map(([t, b], i) => (
                <li key={t} className="flex gap-4">
                  <span className="font-display flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-ember-soft text-sm font-semibold text-ember">
                    {i + 1}
                  </span>
                  <span>
                    <span className="block font-medium text-ink">{t}</span>
                    <span className="mt-1 block text-sm leading-relaxed text-ink-soft">{b}</span>
                  </span>
                </li>
              ))}
            </ol>
            <Link
              href="/for-talent"
              className="mt-7 inline-flex items-center gap-2 text-sm font-medium text-ember hover:underline"
            >
              More for talent <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </Section>

      {/* Anti-gaming — the defensible claim, as a card grid. */}
      <Section id="trust" tone="paper">
        <SectionHeader
          eyebrow="Why the ranking is trustworthy"
          title={<>Built so resumes can&rsquo;t be gamed.</>}
          lede="Job boards reward whoever rewrites their resume best. We removed the rewrite button."
        />
        <div className="mt-10 grid gap-5 sm:grid-cols-2">
          {antiGaming.map((f) => (
            <Card key={f.title} className="p-6">
              <f.icon className="h-5 w-5 text-brand" strokeWidth={1.75} />
              <h3 className="mt-4 font-medium text-ink">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">{f.body}</p>
            </Card>
          ))}
        </div>
        <Link
          href="/why-it-works"
          className="mt-8 inline-flex items-center gap-2 text-sm font-medium text-brand hover:underline"
        >
          How the matching actually works <ArrowRight className="h-4 w-4" />
        </Link>
      </Section>

      {/* Close — the dark brand band. */}
      <Section tone="band" className="text-center">
        <LogoMark className="mx-auto h-12 w-auto brightness-0 invert" />
        <h2 className="font-display mx-auto mt-6 max-w-2xl font-semibold tracking-tight text-white [font-size:var(--text-h1)]">
          Your next hire is already on the list.
        </h2>
        <div className="mt-8 flex flex-wrap justify-center gap-4">
          <ButtonLink
            href="/start"
            variant="solid"
            className="!bg-white !text-brand !shadow-none hover:!bg-brand-soft"
          >
            Get your shortlist
          </ButtonLink>
          <ButtonLink
            href="/onboarding"
            variant="outline"
            className="!text-white !ring-white/40 hover:!bg-white/10"
          >
            Join as talent, free
          </ButtonLink>
        </div>
      </Section>

      </PublicPage>
    </>
  );
}

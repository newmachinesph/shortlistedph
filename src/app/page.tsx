import Link from "next/link";
import { ArrowRight, EyeOff, Camera, Lock, FileCheck } from "lucide-react";
import { LogoMark } from "@/components/logo";
import { PublicPage } from "@/components/public-chrome";
import { JsonLd } from "@/components/json-ld";
import { SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "@/lib/site";

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

export default function Home() {
  return (
    <>
      <JsonLd data={orgSchema} />
      <PublicPage>

      <section className="mx-auto w-full max-w-6xl px-5 pt-16 pb-20 sm:px-8 sm:pt-24">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-ember">
          Shortlists, not job ads · Philippine remote talent
        </p>
        <h1 className="font-display mt-5 max-w-3xl text-5xl font-semibold leading-[1.05] tracking-tight text-ink sm:text-7xl">
          Don&rsquo;t post a job ad.
          <br />
          Get a <span className="text-brand">shortlist</span>.
        </h1>
        <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-soft">
          Tell us who you need. Our matching engine ranks 500+ Filipino remote
          professionals against your job description and hands you the top candidates. No job ads, no application spam.
        </p>
        <div className="mt-9 flex flex-wrap items-center gap-4">
          <Link
            href="/employer/briefs/new"
            className="inline-flex items-center gap-2 rounded-2xl bg-brand px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-brand/25 transition-all hover:bg-brand-dark hover:shadow-brand/30"
          >
            Write your job description <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/onboarding"
            className="inline-flex items-center gap-2 rounded-2xl px-6 py-3.5 text-sm font-semibold text-brand ring-1 ring-inset ring-brand/30 transition-colors hover:bg-brand-soft"
          >
            I&rsquo;m talent: upload my resume
          </Link>
        </div>
        <dl className="mt-16 flex flex-wrap gap-x-12 gap-y-6 border-t border-line pt-8">
          {[
            ["500+", "profiles ready to match"],
            ["40+", "remote roles covered"],
            ["₱0", "to join and get hired"],
            ["~24h", "description to shortlist"],
          ].map(([v, l]) => (
            <div key={l}>
              <dt className="sr-only">{l}</dt>
              <dd className="font-display text-3xl font-semibold text-ink">{v}</dd>
              <dd className="mt-1 text-sm text-ink-faint">{l}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section id="employers" className="w-full scroll-mt-16 border-y border-line bg-white">
        <div className="mx-auto grid max-w-6xl gap-14 px-5 py-20 sm:px-8 lg:grid-cols-2">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-brand">For employers</p>
            <h2 className="font-display mt-3 text-3xl font-semibold tracking-tight text-ink">
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
          <div id="talent" className="scroll-mt-28">
            <p className="text-xs font-medium uppercase tracking-[0.2em] text-ember">For talent</p>
            <h2 className="font-display mt-3 text-3xl font-semibold tracking-tight text-ink">
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
      </section>

      <section id="trust" className="mx-auto w-full max-w-6xl scroll-mt-16 px-5 py-20 sm:px-8">
        <h2 className="font-display max-w-2xl text-3xl font-semibold tracking-tight text-ink">
          Built so resumes can&rsquo;t be gamed.
        </h2>
        <p className="mt-3 max-w-xl text-ink-soft">
          Job boards reward whoever rewrites their resume best. We removed the
          rewrite button.
        </p>
        <div className="mt-10 grid gap-5 sm:grid-cols-2">
          {antiGaming.map((f) => (
            <div key={f.title} className="rounded-2xl border border-line bg-white p-6">
              <f.icon className="h-5 w-5 text-brand" strokeWidth={1.75} />
              <h3 className="mt-4 font-medium text-ink">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">{f.body}</p>
            </div>
          ))}
        </div>
        <Link
          href="/why-it-works"
          className="mt-8 inline-flex items-center gap-2 text-sm font-medium text-brand hover:underline"
        >
          How the matching actually works <ArrowRight className="h-4 w-4" />
        </Link>
      </section>

      <section className="mx-auto w-full max-w-6xl px-5 pb-24 sm:px-8">
        <div className="rounded-3xl bg-brand px-8 py-14 text-center sm:px-14">
          <LogoMark className="mx-auto h-12 w-auto brightness-0 invert" />
          <h2 className="font-display mx-auto mt-6 max-w-2xl text-3xl font-semibold tracking-tight text-white sm:text-4xl">
            Your next hire is already on the list.
          </h2>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link
              href="/employer/briefs/new"
              className="rounded-2xl bg-white px-6 py-3.5 text-sm font-semibold text-brand transition-colors hover:bg-brand-soft"
            >
              Get your shortlist
            </Link>
            <Link
              href="/onboarding"
              className="rounded-2xl px-6 py-3.5 text-sm font-semibold text-white ring-1 ring-inset ring-white/40 transition-colors hover:bg-white/10"
            >
              Join as talent, free
            </Link>
          </div>
        </div>
      </section>

      </PublicPage>
    </>
  );
}

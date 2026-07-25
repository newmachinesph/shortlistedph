import type { Metadata } from "next";
import { ArrowRight, BadgeCheck, Camera, FileWarning, Fingerprint, XCircle } from "lucide-react";
import { PublicPage } from "@/components/public-chrome";
import { ButtonLink } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Section, SectionHeader } from "@/components/ui/section";
import { pageMeta } from "@/lib/site";

export const metadata: Metadata = pageMeta({
  title: "For employers",
  description:
    "Write a job description nobody can read but us. Get a ranked shortlist of Filipino remote talent, free to preview. Honest detail on what identity verification proves and what it can't.",
  path: "/for-employers",
});

const proves: [string, string][] = [
  [
    "One human, one account",
    "Face match plus liveness ties the profile to a specific person who was physically present when the check ran. Account farms rely on cheap duplicate accounts; this makes each one cost real effort and a real face.",
  ],
  [
    "The document is genuine",
    "Didit reads the chip or the printed security features rather than eyeballing a photo, so a scan of a scan fails. On a Philippine ePassport it reads the ICAO chip, which is cryptographically signed and can't be forged, only stolen.",
  ],
  [
    "They were in the Philippines",
    "Device and IP signals flag the VPN and remote-desktop setups behind most rented-account operations.",
  ],
  [
    "It happened, and when",
    "You get a dated attestation you can point at later. That matters more than it sounds if a dispute ever gets serious.",
  ],
];

const doesNotProve: [string, string][] = [
  [
    "That they'll do the work themselves",
    "Verification is a moment, not a subscription. Someone can verify honestly in April and hand the laptop to a cousin in June.",
  ],
  [
    "That the resume is true",
    "Identity and competence are different questions. Nothing in a face match tells you whether they've really run Dentrix for six years.",
  ],
  [
    "That a stolen identity is caught",
    "In July 2024 KnowBe4 — a security awareness company — hired a North Korean operative as a principal engineer. The background check came back clean because the identity was a real person's, and four video interviews matched the photo because the photo had been AI-enhanced. Their endpoint monitoring caught him loading malware and cut access within 25 minutes. Pre-hire checks failed; post-hire monitoring worked.",
  ],
];

const builtInChecks = [
  {
    icon: Camera,
    title: "Profiles are frozen",
    body: "You see each candidate as they were the day you posted, with the date they last edited. Nobody can rewrite their history after reading your requirements, because they never see them.",
  },
  {
    icon: Fingerprint,
    title: "Claims carry provenance",
    body: "Every skill is marked confirmed or self-reported. Confirmed means both sides of a past engagement agreed how it went; self-reported means somebody typed it. We weight them differently and show you which is which.",
  },
  {
    icon: FileWarning,
    title: "One standing rate",
    body: "Rates are set once, locked for 30 days, and their history is visible. You'll never be quoted one number because you sound American and another because you sound like a startup.",
  },
];

export default function ForEmployersPage() {
  return (
    <PublicPage>

      {/* Hero — subpage scale, same voice as the homepage marquee. */}
      <section className="mx-auto w-full max-w-6xl px-5 pt-14 pb-[var(--space-section)] sm:px-8">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-brand">For employers</p>
        <h1 className="font-display mt-4 max-w-3xl font-semibold leading-[1.08] tracking-tight text-ink [font-size:var(--text-h1)]">
          Stop reading 400 applications.
        </h1>
        <p className="mt-6 max-w-xl text-lg leading-relaxed text-ink-soft">
          Write down who you need, honestly, including the budget. Candidates never see it, which
          is exactly why you can be blunt. We rank the market against it and hand you five people,
          or fewer if only three deserve the slot.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-4">
          <ButtonLink href="/start" variant="solid">
            Write a job description <ArrowRight className="h-4 w-4" />
          </ButtonLink>
          <span className="text-sm text-ink-soft">
            Previewing your shortlist costs nothing.
          </span>
        </div>
      </section>

      {/* Verification scope — the honest two-column ledger. */}
      <Section tone="white">
        <SectionHeader
          title="What a verified candidate actually gives you"
          lede={
            <>
              Most platforms wave the word &ldquo;verified&rdquo; around without saying what it
              covers. Here is the whole scope, including the parts that don&rsquo;t flatter us.
            </>
          }
        />
        <div className="mt-10 grid gap-10 lg:grid-cols-2">
          <div>
            <h3 className="flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-brand">
              <BadgeCheck className="h-4 w-4" /> What it proves
            </h3>
            <dl className="mt-5 space-y-5">
              {proves.map(([term, detail]) => (
                <Card key={term} className="p-5">
                  <dt className="font-medium text-ink">{term}</dt>
                  <dd className="mt-1.5 text-sm leading-relaxed text-ink-soft">{detail}</dd>
                </Card>
              ))}
            </dl>
          </div>

          <div>
            <h3 className="flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-ember">
              <XCircle className="h-4 w-4" /> What it doesn&rsquo;t
            </h3>
            <dl className="mt-5 space-y-5">
              {doesNotProve.map(([term, detail]) => (
                <Card key={term} className="p-5">
                  <dt className="font-medium text-ink">{term}</dt>
                  <dd className="mt-1.5 text-sm leading-relaxed text-ink-soft">{detail}</dd>
                </Card>
              ))}
            </dl>
          </div>
        </div>

        <p className="mt-10 max-w-3xl bg-paper p-6 text-sm leading-relaxed text-ink-soft [border-radius:var(--radius-card)]">
          Verification is optional here, so you&rsquo;ll see both verified and unverified people
          on a shortlist. Verified profiles rank slightly higher when everything else is close;
          the badge breaks ties rather than deciding them, because a verified mediocre match is
          still a mediocre match.
        </p>
      </Section>

      {/* The product's own checks — card trio. */}
      <Section tone="paper">
        <SectionHeader
          title={<>The checks identity can&rsquo;t make for you</>}
          lede="Three things we built into the product precisely because no KYC provider covers them."
        />
        <div className="mt-10 grid gap-5 lg:grid-cols-3">
          {builtInChecks.map((f) => (
            <Card key={f.title} className="p-6">
              <f.icon className="h-5 w-5 text-brand" strokeWidth={1.75} />
              <h3 className="mt-4 font-medium text-ink">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">{f.body}</p>
            </Card>
          ))}
        </div>
      </Section>

      {/* NBI clearance — long-form prose at reading measure. */}
      <Section tone="white">
        <div className="mx-auto max-w-3xl">
          <h2 className="font-display font-semibold tracking-tight text-ink [font-size:var(--text-h2)]">
            NBI clearance, and how to ask for it
          </h2>
          <p className="mt-4 leading-relaxed text-ink-soft">
            The NBI clearance is the Philippine criminal-record certificate, and it&rsquo;s the
            document most overseas employers have heard of without quite knowing what it says. It
            means one thing: on the day it was issued, a search of the National Bureau of
            Investigation&rsquo;s records against that person&rsquo;s name and fingerprints turned
            up nothing.
          </p>
          <p className="mt-4 leading-relaxed text-ink-soft">
            It does not cover convictions abroad, local police blotters, civil or labour cases, or
            anything that happened after the issue date. It costs the worker ₱130 and lasts a
            year, so asking for a recent one is reasonable; asking for one before you&rsquo;ve
            decided to hire is not, and good candidates will read it as a bad sign.
          </p>
          <div className="mt-6 bg-ember-soft p-6 [border-radius:var(--radius-card)]">
            <h3 className="font-medium text-ink">A warning about online verification</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">
              Several sites offer to verify NBI clearances. We checked the most prominent one: it
              runs on a privacy-shielded domain registered through a US proxy service, posts to its
              own private API, and never contacts any NBI system. It isn&rsquo;t an NBI service and
              we won&rsquo;t link to it. As far as we can establish there is no public NBI
              verification portal at all, which is a limitation worth knowing rather than a gap to
              paper over. Ask the candidate for the clearance directly, check the date, and treat
              the paper as one input among several.
            </p>
          </div>
          <p className="mt-6 leading-relaxed text-ink-soft">
            Worth knowing that the document is not tamper-proof at the source either: in January
            2025 four NBI ICT staff and seven fixers were arrested for selling fast-tracked
            clearances. A genuine certificate can still have come through a corrupted process, and
            no authenticity check catches that.
          </p>

          <Card className="mt-8 p-6">
            <h3 className="text-sm font-medium uppercase tracking-wider text-ink-faint">
              Further reading
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-ink-soft">
              Respicio &amp; Co., a Philippine law firm, published a useful explainer in June 2026
              on what a clearance &ldquo;hit&rdquo; means:{" "}
              <a
                href="https://www.respicio.ph/commentaries/how-to-check-an-nbi-clearance-hit-online"
                target="_blank"
                rel="noopener noreferrer"
                className="font-medium text-brand hover:underline"
              >
                How to check an NBI clearance hit online
              </a>
              . The short version is that a hit usually means a name matched something in the
              database and a person has to look at it, not that anything was found. Shared
              surnames and spelling differences trigger them constantly. If a candidate mentions a
              delay for this reason, it is routine.
            </p>
            <p className="mt-3 text-sm leading-relaxed text-ink-faint">
              We differ from that article on one point. It points readers to
              nbi-clearance.io as an official verification tool; when we checked, that domain was
              registered anonymously through a US privacy service and queries its own private API
              rather than anything run by the NBI. We could find no evidence connecting it to the
              Bureau. Take the explanation of hits, which is sound, and get the clearance itself
              from the candidate.
            </p>
          </Card>
        </div>
      </Section>

      {/* Close — the dark brand band, same voice as the homepage. */}
      <Section tone="band" className="text-center">
        <h2 className="font-display mx-auto max-w-2xl font-semibold tracking-tight text-white [font-size:var(--text-h1)]">
          See your shortlist before you pay for it.
        </h2>
        <p className="mx-auto mt-4 max-w-lg text-sm leading-relaxed text-white/80">
          Post a job description, get a ranked slate with names hidden and every score visible.
          $49 unlocks it, and only if the match quality convinces you.
        </p>
        <div className="mt-8">
          <ButtonLink
            href="/start"
            variant="solid"
            className="!bg-white !text-brand !shadow-none hover:!bg-brand-soft"
          >
            Write a job description
          </ButtonLink>
        </div>
      </Section>

      </PublicPage>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Camera, EyeOff, FileCheck, Filter, Lock } from "lucide-react";
import { PublicPage } from "@/components/public-chrome";
import { Section } from "@/components/ui/section";
import { pageMeta } from "@/lib/site";

export const metadata: Metadata = pageMeta({
  title: "Why it works",
  description:
    "Job boards reward whoever rewrites their resume best. Hidden job descriptions, snapshot profiles, standing rates and a quality floor remove the incentive to game the match.",
  path: "/why-it-works",
});

const mechanics = [
  {
    icon: EyeOff,
    title: "Job descriptions stay hidden",
    body: "Candidates never read what you're looking for, so there's nothing to mirror back at you. Everything about a profile was written before your job existed. This is also why you can be blunt in a job description in a way you never could in a public advert: real budget, real dealbreakers, the thing that got the last two hires fired.",
  },
  {
    icon: Camera,
    title: "Profiles are frozen at posting",
    body: "The moment you publish, we snapshot every profile we rank. Later edits change nothing about what you were shown, and you see the date each person last touched theirs. Someone who hasn't edited in 74 days isn't reacting to you.",
  },
  {
    icon: FileCheck,
    title: "Claims carry their source",
    body: "A skill is either confirmed by a past engagement both sides signed off on, or it's self-reported. We weight confirmed claims roughly double and label them so you can see the difference. Anyone can type \"expert in Dentrix\"; not everyone can point at the practice that agreed.",
  },
  {
    icon: Lock,
    title: "One rate, locked",
    body: "A standing rate applies to every employer, changes lock for 30 days, and the history is visible to anyone who shortlists that person. It ends the guessing game where the outcome depends on who read whom better.",
  },
  {
    icon: Filter,
    title: "Short slates beat padded ones",
    body: "Below a quality threshold we return nobody rather than filling five seats. When we tested against the real pool, an Amazon PPC job surfaced a recruiter and a postal-services generalist in the top five; that shortlist now comes back empty, honestly, instead of spending your attention on people we already know are wrong.",
  },
];

export default function WhyItWorksPage() {
  return (
    <PublicPage>

      {/* Hero — Long-Document opening at subpage scale. */}
      <section className="mx-auto w-full max-w-6xl px-5 pt-14 pb-[var(--space-section)] sm:px-8">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-brand">Why it works</p>
        <h1 className="font-display mt-4 max-w-3xl font-semibold leading-[1.08] tracking-tight text-ink [font-size:var(--text-h1)]">
          Built so resumes can&rsquo;t be gamed.
        </h1>
        <p className="mt-6 max-w-2xl text-lg leading-relaxed text-ink-soft">
          Every job board has the same flaw: the application is the unit of competition, so the
          winner is whoever rewrites their resume best for each posting. Inflated titles, invented
          rates, keyword stuffing. None of that is dishonesty exactly; it&rsquo;s what the system
          asks for. We removed the rewrite button instead of asking people to behave.
        </p>
      </section>

      {/* The five mechanics — numbered rail, genuinely ordinal. */}
      <Section tone="white">
        <div className="mx-auto max-w-4xl">
          <ol className="space-y-12">
            {mechanics.map((m, i) => (
              <li key={m.title} className="flex gap-4 sm:gap-6">
                <div className="flex flex-col items-center">
                  <span className="font-display flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-sm font-semibold text-brand">
                    {i + 1}
                  </span>
                  {i < mechanics.length - 1 && (
                    <span aria-hidden className="mt-3 w-px flex-1 bg-line" />
                  )}
                </div>
                <div className="min-w-0 pb-2">
                  <h2 className="font-display flex items-center gap-2.5 text-lg font-semibold text-ink sm:text-xl">
                    <m.icon className="h-5 w-5 shrink-0 text-brand" strokeWidth={1.75} />
                    {m.title}
                  </h2>
                  <p className="mt-3 max-w-2xl leading-relaxed text-ink-soft">{m.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </Section>

      {/* The honest limits — prose at reading measure. */}
      <Section tone="paper">
        <div className="mx-auto max-w-4xl">
          <h2 className="font-display font-semibold tracking-tight text-ink [font-size:var(--text-h2)]">
            What this doesn&rsquo;t fix
          </h2>
          <p className="mt-4 leading-relaxed text-ink-soft">
            Hidden job descriptions stop tailoring at the matching stage; they don&rsquo;t stop
            someone overselling in the interview once the job is finally revealed to them. Frozen
            profiles prove what was claimed and when, not whether it was true. Identity verification,
            which is optional, ties an account to a real person on one day and says nothing about the
            next.
          </p>
          <p className="mt-4 leading-relaxed text-ink-soft">
            What the design actually buys is narrower and more useful than &ldquo;no more bad
            hires&rdquo;: the profile that got someone in front of you existed before you did. Every
            claim on it is either backed by someone else or visibly not. Whether they can do the job
            is still a conversation you have to have.
          </p>
        </div>
      </Section>

      {/* Onward — the two audience doors. */}
      <Section tone="white">
        <div className="grid gap-5 sm:grid-cols-2">
          <Link
            href="/for-employers"
            className="group border border-line bg-[var(--color-surface)] p-8 [border-radius:var(--radius-lg)] [box-shadow:var(--shadow-card)] transition-shadow transition-transform hover:-translate-y-0.5 hover:[box-shadow:var(--shadow-lift)]"
          >
            <h3 className="font-display text-2xl font-semibold tracking-tight text-ink">
              For employers
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">
              What verification proves, what it doesn&rsquo;t, and how to read an NBI clearance.
            </p>
            <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-brand">
              Read more <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>
          <Link
            href="/for-talent"
            className="group border border-line bg-[var(--color-surface)] p-8 [border-radius:var(--radius-lg)] [box-shadow:var(--shadow-card)] transition-shadow transition-transform hover:-translate-y-0.5 hover:[box-shadow:var(--shadow-lift)]"
          >
            <h3 className="font-display text-2xl font-semibold tracking-tight text-ink">
              For talent
            </h3>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">
              Upload once, get matched while you sleep, and keep your documents in your own hands.
            </p>
            <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-ember">
              Read more <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </span>
          </Link>
        </div>
      </Section>

      </PublicPage>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CircleDollarSign, TrendingUp, UserCheck } from "lucide-react";
import { PublicPage } from "@/components/public-chrome";
import { pageMeta } from "@/lib/site";
import { getSessionUser } from "@/lib/session";
import { currentDraft } from "@/lib/job-draft";
import { StartForm, type StartInitial } from "./start-form";

export const metadata: Metadata = pageMeta({
  title: "Describe the role, see who matches",
  description:
    "Describe the role you're hiring for and see how many Filipino remote professionals already match — free. No account needed to preview, no payment until you choose to see the shortlist.",
  path: "/start",
});

const promises: [typeof CircleDollarSign, string, string][] = [
  [
    CircleDollarSign,
    "Nothing to pay to look",
    "Describing the role and seeing your shortlist is free. You pay only when you decide to view a candidate's name and reach out.",
  ],
  [
    UserCheck,
    "Checked before you see them",
    "Before anyone reaches your shortlist we confirm they're still available and gauge their interest — so you're not chasing people who've already moved on.",
  ],
  [
    TrendingUp,
    "The pool keeps growing",
    "We keep sourcing after you submit. New professionals are matched against your role as they join, so a thin list today gets deeper.",
  ],
];

export default async function StartPage() {
  const user = await getSessionUser();
  const isEmployer = user?.role === "employer";
  const draft = await currentDraft();

  const initial: StartInitial = {
    title: draft?.title ?? "",
    rawText: draft?.rawText ?? "",
    budgetMax: draft?.budgetMax ?? null,
    hoursPerWeek: draft?.hoursPerWeek ?? null,
    mustHaves: draft?.mustHaves ?? [],
    count: draft?.matchCount ?? null,
  };

  return (
    <PublicPage>
      <section className="mx-auto w-full max-w-3xl px-5 pt-14 pb-16 sm:px-8">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-brand">Get your shortlist</p>
        <h1 className="font-display mt-4 text-[clamp(2rem,7vw,3.25rem)] font-semibold leading-[1.08] tracking-tight text-ink">
          Describe the role. See who already matches.
        </h1>
        <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink-soft">
          Write down who you need — candidates never see it, so be blunt about budget and
          dealbreakers. We&rsquo;ll show you how many Filipino professionals fit before you sign up
          for anything.
        </p>

        {isEmployer && (
          <div className="mt-6 flex flex-col gap-3 rounded-2xl border border-line bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-ink-soft">
              You&rsquo;re signed in. Anything you draft here carries into the builder.
            </p>
            <Link
              href="/employer/briefs/new"
              className="inline-flex shrink-0 items-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-dark"
            >
              Continue to the builder <ArrowRight className="h-4 w-4" strokeWidth={1.75} />
            </Link>
          </div>
        )}

        <div className="mt-8">
          <StartForm initial={initial} />
        </div>

        <dl className="mt-10 grid gap-4 sm:grid-cols-3">
          {promises.map(([Icon, term, detail]) => (
            <div key={term} className="rounded-2xl border border-line bg-white p-5">
              <Icon className="h-5 w-5 text-brand" strokeWidth={1.75} />
              <dt className="mt-3 font-medium text-ink">{term}</dt>
              <dd className="mt-1.5 text-sm leading-relaxed text-ink-soft">{detail}</dd>
            </div>
          ))}
        </dl>
      </section>
    </PublicPage>
  );
}

import type { Metadata } from "next";
import { pageMeta } from "@/lib/site";
import Link from "next/link";
import { PublicFooter, PublicHeader } from "@/components/public-chrome";

export const metadata: Metadata = pageMeta({
  title: "Terms of Service",
  description:
    "shortlisted.ph is sourcing only. We are not an employer, staffing agency, or payroll provider, and we never hold or take a cut of salaries.",
  path: "/terms",
});

const sections: [string, string][] = [
  [
    "What shortlisted.ph is",
    "shortlisted.ph is a sourcing platform. Employers post hidden job descriptions; we match and rank talent profiles and deliver shortlists. We are not an employer, staffing agency, or payroll provider. Employment relationships, contracts, and salary payments happen directly between employers and talent.",
  ],
  [
    "Money",
    "Employers pay per shortlist. Talent never pays to be listed, matched, shortlisted, prioritised, or hired. Identity verification is optional and separate from all of that: the ₱60 covers a check run by an outside provider and we keep none of it. We never hold, transfer, or take a percentage of salaries.",
  ],
  [
    "Honesty",
    "Profiles are snapshots: employers see them as they existed when a job description was posted. Misrepresenting identity, experience, or authorship of work is grounds for removal. Employers who fail to honor confirmed outcomes damage their public track record and may be removed.",
  ],
  [
    "Documents",
    "Identity documents (government ID, NBI clearance) are never uploaded to or stored by shortlisted.ph. Verification is optional; talent presents documents directly to employers after hiring, at their own discretion.",
  ],
  [
    "Ratings and outcomes",
    "Ratings require a platform agreement and reveal double-blind. Outcome confirmations are mutual statements by both parties and build payment-verified history; false confirmations violate these terms.",
  ],
];

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-paper">
      <PublicHeader />
      <main className="mx-auto w-full max-w-3xl px-5 pt-8 pb-20 sm:px-8">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-ink">Terms of Service</h1>
        <p className="mt-2 text-sm text-ink-faint">Prototype draft · July 2026 · not yet legal text</p>
        <div className="mt-8 space-y-6">
          {sections.map(([t, b]) => (
            <section key={t} className="rounded-2xl border border-line bg-white p-6">
              <h2 className="font-medium text-ink">{t}</h2>
              <p className="mt-2 text-sm leading-relaxed break-words text-ink-soft">{b}</p>
            </section>
          ))}
        </div>
        <p className="mt-8 text-sm text-ink-soft">
          See also our{" "}
          <Link href="/privacy" className="font-medium text-brand hover:underline">Privacy Policy</Link>
          {" "}and{" "}
          <Link href="/conduct" className="font-medium text-brand hover:underline">Code of Conduct</Link>.
        </p>
      </main>
      <PublicFooter />
    </div>
  );
}

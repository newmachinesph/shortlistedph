import type { Metadata } from "next";
import Link from "next/link";
import { PublicFooter, PublicHeader } from "@/components/public-chrome";

export const metadata: Metadata = { title: "Privacy Policy — shortlisted.ph" };

const sections: [string, string][] = [
  [
    "What we collect",
    "Talent: your resume and the standing profile built from it, your standing rate and its history, and engagement outcomes you confirm. Employers: contact details, job descriptions, and activity that forms your public track record (response rate, confirmed hires).",
  ],
  [
    "What we never store",
    "Government IDs, NBI clearances, and similar documents are never uploaded to shortlisted.ph. Verification happens without us keeping copies; documents are shown by talent directly to employers after hiring.",
  ],
  [
    "Who sees what",
    "Talent profiles are invisible to employers until shortlisted. In free previews, names, photos, and contact details are withheld. Full profiles are revealed only after a candidate consents to connect. Every reveal is logged and visible to the talent in their consent log.",
  ],
  [
    "Data Privacy Act",
    "We operate under the Philippine Data Privacy Act of 2012. You can request an export or deletion of your data at any time from the Legal section of your workspace, or by writing to privacy@shortlisted.ph.",
  ],
  [
    "AI processing",
    "Resumes are processed by AI to build standing profiles and compute match rankings. Profiles are embedded for search. We do not sell data or use it to train third-party models.",
  ],
];

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-paper">
      <PublicHeader />
      <main className="mx-auto w-full max-w-3xl px-5 pt-8 pb-20">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-ink">Privacy Policy</h1>
        <p className="mt-2 text-sm text-ink-faint">Prototype draft · July 2026 · not yet legal text</p>
        <div className="mt-8 space-y-6">
          {sections.map(([t, b]) => (
            <section key={t} className="rounded-2xl border border-line bg-white p-6">
              <h2 className="font-medium text-ink">{t}</h2>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">{b}</p>
            </section>
          ))}
        </div>
        <p className="mt-8 text-sm text-ink-soft">
          See also our <Link href="/terms" className="font-medium text-brand hover:underline">Terms of Service</Link>.
        </p>
      </main>
      <PublicFooter />
    </div>
  );
}

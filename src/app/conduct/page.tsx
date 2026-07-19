import type { Metadata } from "next";
import Link from "next/link";
import { PublicFooter, PublicHeader } from "@/components/public-chrome";

export const metadata: Metadata = { title: "Code of Conduct — shortlisted.ph" };

const sections: [string, string][] = [
  [
    "One human, one account, one reputation",
    "Every account belongs to exactly one real person or one real business, forever. Selling, sharing, or duplicating accounts ends all of them. Your history — confirmed outcomes, ratings, rate history, stability — follows your identity and cannot be reset by re-registering.",
  ],
  [
    "We witness. You contract.",
    "shortlisted.ph is not your employer, your agency, or your bank. Agreements are e-signed between talent and employer directly, and salaries are paid directly. What we do is keep the record: who agreed to what, when, and how it ended. That record is the platform.",
  ],
  [
    "Honesty is structural, not requested",
    "Profiles are snapshots — employers see them as they existed when a job was posted. Claims are tagged by what backs them: a confirmed engagement outcome, or nothing. The engine ranks what you can prove. Fabricating experience, portfolios, or references is not a rule violation we debate; it is removal.",
  ],
  [
    "Fraud ends everything",
    "Misrepresentation of identity, fabricated credentials, ghosting with assets or access, fake outcome confirmations, or any scam attempt — with evidence — means permanent removal. Records, agreements, and confirmations are preserved and will be disclosed to the NBI, the PNP Anti-Cybercrime Group, or courts upon lawful request. Fraud between contracting parties may constitute estafa under Article 315 of the Revised Penal Code or computer-related fraud under the Cybercrime Prevention Act of 2012 — pursued by the wronged party, with our records as evidence.",
  ],
  [
    "Employers are held to the same bar",
    "Non-payment of confirmed work, fake job descriptions, harvesting personal data, unpaid 'trial tasks', or asking anyone for money is grounds for removal. An employer's track record — response rate, confirmed hires, outcome history — is shown to every candidate before they consent to connect. Reputation here is earned in both directions.",
  ],
  [
    "Talent never pays. Anyone who asks is a scammer.",
    "There are no listing fees, matching fees, placement fees, or training fees — on or off this platform. Recruitment placement fees are the oldest scam in Philippine hiring. If anyone claiming to represent shortlisted.ph or an employer asks you for money, report it to support@shortlisted.ph immediately.",
  ],
];

export default function ConductPage() {
  return (
    <div className="min-h-screen bg-paper">
      <PublicHeader />
      <main className="mx-auto w-full max-w-3xl px-5 pt-8 pb-20">
        <h1 className="font-display text-3xl font-semibold tracking-tight text-ink">Code of Conduct</h1>
        <p className="mt-3 max-w-xl leading-relaxed text-ink-soft">
          Being shortlisted here means something because of what we don&rsquo;t
          allow. This page is the whole doctrine — short on purpose.
        </p>
        <div className="mt-8 space-y-6">
          {sections.map(([t, b]) => (
            <section key={t} className="rounded-2xl border border-line bg-white p-6">
              <h2 className="font-medium text-ink">{t}</h2>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">{b}</p>
            </section>
          ))}
        </div>
        <p className="mt-8 text-sm text-ink-soft">
          See also our{" "}
          <Link href="/terms" className="font-medium text-brand hover:underline">Terms of Service</Link>
          {" "}and{" "}
          <Link href="/privacy" className="font-medium text-brand hover:underline">Privacy Policy</Link>.
        </p>
      </main>
      <PublicFooter />
    </div>
  );
}

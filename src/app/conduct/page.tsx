import type { Metadata } from "next";
import { pageMeta } from "@/lib/site";
import Link from "next/link";
import { PublicFooter, PublicHeader } from "@/components/public-chrome";
import { Card } from "@/components/ui/card";

export const metadata: Metadata = pageMeta({
  title: "Code of Conduct",
  description:
    "One human, one account, one reputation. The rules both sides agree to on shortlisted.ph, and how to report anyone charging Filipino workers to be placed.",
  path: "/conduct",
});

const sections: [string, string][] = [
  [
    "One human, one account, one reputation",
    "Every account belongs to exactly one real person or one real business, forever. Selling, sharing, or duplicating accounts ends all of them. Your history (confirmed outcomes, ratings, rate history, stability) follows your identity and cannot be reset by re-registering.",
  ],
  [
    "We witness. You contract.",
    "shortlisted.ph is not your employer, your agency, or your bank. Agreements are e-signed between talent and employer directly, and salaries are paid directly. What we do is keep the record: who agreed to what, when, and how it ended. That record is the platform.",
  ],
  [
    "Honesty is structural, not requested",
    "Profiles are snapshots: employers see them as they existed when a job was posted. Claims are tagged by what backs them: a confirmed engagement outcome, or nothing. The engine ranks what you can prove. Fabricating experience, portfolios, or references is not a rule violation we debate; it is removal.",
  ],
  [
    "Fraud ends everything",
    "Misrepresentation of identity, fabricated credentials, ghosting with assets or access, fake outcome confirmations, or any scam attempt, where evidence supports it, means permanent removal. We preserve records, agreements, and confirmations, and will disclose them to the NBI, the PNP Anti-Cybercrime Group, or courts on lawful request. Fraud between contracting parties may constitute estafa under Article 315 of the Revised Penal Code or computer-related fraud under the Cybercrime Prevention Act of 2012. The wronged party pursues it; our records serve as evidence.",
  ],
  [
    "Employers are held to the same bar",
    "Non-payment of confirmed work, fake job descriptions, harvesting personal data, unpaid 'trial tasks', or asking anyone for money is grounds for removal. Every candidate sees an employer's track record (response rate, confirmed hires, outcome history) before consenting to connect. Reputation here is earned in both directions.",
  ],
  [
    "Talent never pays to be hired.",
    "No listing fees, matching fees, placement fees, or training fees, on or off this platform. Recruitment placement fees are the oldest scam in Philippine hiring. Identity verification is not one of these: it is optional, it is a check run by an outside provider, the ₱60 covers what that check costs and we keep none of it, and declining it takes nothing away from you. Nobody at shortlisted.ph will ever ask you for money to be listed, matched, shortlisted, prioritised, or hired. Anyone who does is running a scam; report it to support@shortlisted.ph.",
  ],
];

export default function ConductPage() {
  return (
    <div className="min-h-screen bg-paper">
      <PublicHeader />
      <main className="mx-auto w-full max-w-3xl px-5 pt-8 pb-20 sm:px-8">
        <h1 className="font-display font-semibold tracking-tight text-ink [font-size:var(--text-h1)]">Code of Conduct</h1>
        <p className="mt-3 max-w-xl leading-relaxed text-ink-soft">
          Being shortlisted here means something because of what we don&rsquo;t
          allow. This page is the whole doctrine — short on purpose.
        </p>
        <div className="mt-8 space-y-6">
          {sections.map(([t, b]) => (
            <Card key={t} className="p-6">
              <h2 className="font-medium text-ink">{t}</h2>
              <p className="mt-2 text-sm leading-relaxed break-words text-ink-soft">{b}</p>
            </Card>
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

"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, FileUp, Loader2, ShieldAlert } from "lucide-react";
import { Logo } from "@/components/logo";

const gateRules: [string, string][] = [
  [
    "You're matched on verified experience, not ambition.",
    "The engine ranks what you can prove — confirmed engagements, verified skills. A polished resume with nothing behind it goes nowhere here.",
  ],
  [
    "Inflated rates don't get argued with. They just never match.",
    "Your standing rate is compared against profiles with similar verified experience. Price yourself above what you can prove and you'll simply stop appearing on shortlists.",
  ],
  [
    "Fabricated experience ends the account. Permanently.",
    "One human, one account, one reputation. Fraud with evidence means removal, and records are preserved for lawful requests by Philippine authorities.",
  ],
  [
    "You never pay anything. Anyone who asks is scamming you.",
    "No listing fees, no placement fees, no 'training' fees — on or off this platform. Report anyone who asks.",
  ],
];

const steps = [
  "Reading your resume…",
  "Extracting experience and skills…",
  "Building your standing profile…",
  "Indexing you for matching…",
];

const extracted = [
  ["Headline", "Medical VA — US dental practices"],
  ["Experience", "6 years · 2 engagements found"],
  ["Skills", "Dentrix, Eaglesoft, insurance verification, +3 more"],
  ["Suggested rate", "$9/hr — you can change this before publishing"],
];

export default function OnboardingPage() {
  const [stage, setStage] = useState<"gate" | "upload" | "parsing" | "review">("gate");
  const [step, setStep] = useState(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const start = () => {
    setStage("parsing");
    steps.forEach((_, i) =>
      timers.current.push(setTimeout(() => setStep(i), i * 900)),
    );
    timers.current.push(
      setTimeout(() => setStage("review"), steps.length * 900 + 400),
    );
  };

  return (
    <div className="min-h-screen bg-paper">
      <header className="mx-auto max-w-2xl px-5 py-6">
        <Link href="/">
          <Logo />
        </Link>
      </header>
      <main className="mx-auto max-w-2xl px-5 pb-20">
        {stage === "gate" && (
          <>
            <p className="mt-8 inline-flex items-center gap-1.5 rounded-full bg-ember-soft px-3 py-1 text-xs font-medium text-ember">
              <ShieldAlert className="h-3.5 w-3.5" /> Read this first
            </p>
            <h1 className="font-display mt-4 text-3xl font-semibold tracking-tight text-ink">
              This platform has a bar.
            </h1>
            <p className="mt-3 leading-relaxed text-ink-soft">
              Being shortlisted here means something because of what we
              don&rsquo;t allow. Two minutes of straight talk before you upload:
            </p>
            <ul className="mt-7 space-y-4">
              {gateRules.map(([title, body]) => (
                <li key={title} className="rounded-2xl border border-line bg-white p-5">
                  <p className="font-medium text-ink">{title}</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">{body}</p>
                </li>
              ))}
            </ul>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <button
                onClick={() => setStage("upload")}
                className="inline-flex items-center gap-2 rounded-2xl bg-brand px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-brand/25 transition-colors hover:bg-brand-dark"
              >
                I understand — build my profile <ArrowRight className="h-4 w-4" />
              </button>
              <Link href="/conduct" className="text-sm font-medium text-brand hover:underline">
                Read the full Code of Conduct
              </Link>
            </div>
          </>
        )}
        {stage === "upload" && (
          <>
            <h1 className="font-display mt-8 text-3xl font-semibold tracking-tight text-ink">
              Upload your resume. That&rsquo;s the whole job.
            </h1>
            <p className="mt-3 leading-relaxed text-ink-soft">
              We build your standing profile from it, then match you against
              every new brief automatically. You never apply, never tailor,
              never write a cover letter again.
            </p>
            <button
              onClick={start}
              className="mt-8 flex w-full flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-brand/40 bg-white px-6 py-14 transition-colors hover:border-brand hover:bg-brand-soft/40"
            >
              <FileUp className="h-8 w-8 text-brand" strokeWidth={1.5} />
              <span className="font-medium text-ink">Drop your resume here</span>
              <span className="text-sm text-ink-faint">
                PDF, DOC, or DOCX · or click to use a sample resume (demo)
              </span>
            </button>
            <p className="mt-6 text-sm leading-relaxed text-ink-faint">
              Free forever for talent. Verification is optional, and your ID or
              NBI clearance never touches our servers — you show documents
              directly to an employer only after you&rsquo;re hired.
            </p>
          </>
        )}

        {stage === "parsing" && (
          <div className="pt-20 text-center">
            <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-brand-soft">
              <Loader2 className="h-7 w-7 animate-spin text-brand" />
            </span>
            <h1 className="font-display mt-6 text-2xl font-semibold text-ink">
              Building your profile
            </h1>
            <ul className="mx-auto mt-6 max-w-xs space-y-2.5 text-left">
              {steps.map((s, i) => (
                <li
                  key={s}
                  className={`flex items-center gap-2.5 text-sm ${
                    i < step ? "text-brand" : i === step ? "text-ink" : "text-ink-faint"
                  }`}
                >
                  {i < step ? (
                    <Check className="h-4 w-4" />
                  ) : i === step ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <span className="h-4 w-4" />
                  )}
                  {s}
                </li>
              ))}
            </ul>
          </div>
        )}

        {stage === "review" && (
          <>
            <span className="mt-8 inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-3 py-1 text-xs font-medium text-brand">
              <Check className="h-3.5 w-3.5" /> Profile drafted in 34 seconds
            </span>
            <h1 className="font-display mt-4 text-3xl font-semibold tracking-tight text-ink">
              Here&rsquo;s what we found. Correct anything.
            </h1>
            <dl className="mt-7 space-y-4">
              {extracted.map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-2xl border border-line bg-white px-5 py-4"
                >
                  <dt className="text-xs text-ink-faint">{label}</dt>
                  <dd className="mt-0.5 font-medium text-ink">{value}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-8 flex flex-wrap items-center gap-4">
              <Link
                href="/talent"
                className="inline-flex items-center gap-2 rounded-2xl bg-brand px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-brand/25 transition-colors hover:bg-brand-dark"
              >
                Publish my profile <ArrowRight className="h-4 w-4" />
              </Link>
              <p className="text-xs leading-relaxed text-ink-faint">
                Matching starts immediately.
                <br />
                Your rate locks for 30 days after each change.
              </p>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

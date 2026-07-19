"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Check, FileUp, Loader2, ShieldAlert } from "lucide-react";
import { Logo } from "@/components/logo";
import { api } from "@/lib/auth-client";

const gateRules: [string, string][] = [
  [
    "We match verified experience, not ambition",
    "Your profile is ranked against what your resume and past engagements actually support. Claims nobody can back count for less.",
  ],
  [
    "One rate, for everyone",
    "You set a standing rate. It locks for 30 days and its history is visible to employers who shortlist you. No quoting one number to a startup and another to a US company.",
  ],
  [
    "Fabrication ends the account",
    "Invented experience, borrowed portfolios, or fake references mean removal: permanent, and bound to your identity.",
  ],
  [
    "You never pay anyone. Ever.",
    "No listing, matching, or placement fees. If anyone asks you for money to be shortlisted or hired, report it.",
  ],
];

type Stage = "gate" | "upload" | "parsing" | "review" | "publishing";

type Parsed = {
  headline: string;
  summary: string;
  city: string | null;
  yearsExperience: number;
  suggestedRateUsd: number | null;
  skills: string[];
  engagements: { role: string; company: string; span: string }[];
};

export default function OnboardingPage() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>("gate");
  const [parsed, setParsed] = useState<Parsed | null>(null);
  const [rate, setRate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setError(null);
    setStage("parsing");
    try {
      const { uploadUrl, key } = await api<{ uploadUrl: string; key: string }>(
        "/api/talent/resume/upload-url",
        {
          method: "POST",
          body: JSON.stringify({ contentType: file.type, sizeBytes: file.size }),
        },
      );

      const put = await fetch(uploadUrl, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type },
      });
      if (!put.ok) throw new Error("Upload failed. Check your connection and try again");

      const { parsed } = await api<{ parsed: Parsed }>("/api/talent/resume/parse", {
        method: "POST",
        body: JSON.stringify({ key }),
      });

      setParsed(parsed);
      setRate(parsed.suggestedRateUsd ? String(parsed.suggestedRateUsd) : "");
      setStage("review");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setStage("upload");
    }
  }

  async function handlePublish() {
    setError(null);
    setStage("publishing");
    try {
      const parsedRate = Number(rate);
      if (!parsedRate || parsedRate < 1) throw new Error("Set your standing rate before publishing");
      await api("/api/talent/rate", { method: "PUT", body: JSON.stringify({ rateUsd: parsedRate }) });
      await api("/api/talent/publish", { method: "POST" });
      router.push("/talent");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not publish");
      setStage("review");
    }
  }

  return (
    <div className="min-h-screen bg-paper">
      <header className="mx-auto max-w-2xl px-5 py-6">
        <Link href="/">
          <Logo />
        </Link>
      </header>
      <main className="mx-auto max-w-2xl px-5 pb-20">
        {error && (
          <p className="mt-4 rounded-xl bg-ember-soft px-4 py-3 text-sm text-ember">{error}</p>
        )}

        {stage === "gate" && (
          <>
            <p className="mt-8 inline-flex items-center gap-1.5 rounded-full bg-ember-soft px-3 py-1 text-xs font-medium text-ember">
              <ShieldAlert className="h-3.5 w-3.5" /> Read this first
            </p>
            <h1 className="font-display mt-4 text-3xl font-semibold tracking-tight text-ink">
              This platform has a bar.
            </h1>
            <p className="mt-3 leading-relaxed text-ink-soft">
              Being shortlisted here means something because of what we don&rsquo;t allow. Two
              minutes of straight talk before you upload:
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
                type="button"
                onClick={() => setStage("upload")}
                className="inline-flex items-center gap-2 rounded-2xl bg-brand px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-brand/25 transition-colors hover:bg-brand-dark"
              >
                I understand: build my profile <ArrowRight className="h-4 w-4" />
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
              We build your standing profile from it, then match you against every new job
              description automatically. You never apply and never write another cover letter.
            </p>
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.doc,.docx,.txt"
              className="sr-only"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFile(file);
              }}
            />
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="mt-8 flex w-full flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-brand/40 bg-white px-6 py-14 transition-colors hover:border-brand hover:bg-brand-soft/40"
            >
              <FileUp className="h-8 w-8 text-brand" strokeWidth={1.5} />
              <span className="font-medium text-ink">Choose your resume</span>
              <span className="text-sm text-ink-faint">PDF, DOC, DOCX or TXT · up to 5MB</span>
            </button>
            <p className="mt-6 text-sm leading-relaxed text-ink-faint">
              Free forever for talent. Verification is optional, and your ID or NBI clearance never
              touches our servers. You show them directly to an employer once
              you&rsquo;re hired.
            </p>
          </>
        )}

        {stage === "parsing" && (
          <div className="pt-20 text-center">
            <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-brand-soft">
              <Loader2 className="h-7 w-7 animate-spin text-brand" />
            </span>
            <h1 className="font-display mt-6 text-2xl font-semibold text-ink">
              Reading your resume
            </h1>
            <p className="mt-2 text-sm text-ink-soft">
              Extracting your experience and skills. This takes a few seconds.
            </p>
          </div>
        )}

        {(stage === "review" || stage === "publishing") && parsed && (
          <>
            <span className="mt-8 inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-3 py-1 text-xs font-medium text-brand">
              <Check className="h-3.5 w-3.5" /> Profile drafted from your resume
            </span>
            <h1 className="font-display mt-4 text-3xl font-semibold tracking-tight text-ink">
              Here&rsquo;s what we found. Correct anything.
            </h1>

            <div className="mt-7 space-y-4">
              <div className="rounded-2xl border border-line bg-white px-5 py-4">
                <p className="text-xs text-ink-faint">Headline</p>
                <p className="mt-0.5 font-medium text-ink">{parsed.headline}</p>
              </div>
              <div className="rounded-2xl border border-line bg-white px-5 py-4">
                <p className="text-xs text-ink-faint">Experience</p>
                <p className="mt-0.5 font-medium text-ink">
                  {parsed.yearsExperience} years · {parsed.engagements.length} engagements found
                </p>
              </div>
              <div className="rounded-2xl border border-line bg-white px-5 py-4">
                <p className="text-xs text-ink-faint">Skills</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {parsed.skills.map((s) => (
                    <span
                      key={s}
                      className="rounded-full border border-line px-2.5 py-1 text-xs text-ink-soft"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>
              <div className="rounded-2xl border border-line bg-white px-5 py-4">
                <label htmlFor="rate" className="text-xs text-ink-faint">
                  Your standing rate (USD / hour)
                </label>
                <div className="mt-1.5 flex items-center gap-2">
                  <span className="font-display text-2xl font-semibold text-ink">$</span>
                  <input
                    id="rate"
                    type="number"
                    min={1}
                    step={0.5}
                    value={rate}
                    onChange={(e) => setRate(e.target.value)}
                    className="w-28 rounded-xl border border-line bg-paper px-3 py-2 text-sm text-ink focus:outline-2 focus:outline-brand"
                  />
                  <span className="text-sm text-ink-faint">/ hr</span>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-ink-faint">
                  Locks for 30 days once published. Its history is visible to employers who
                  shortlist you.
                </p>
              </div>
            </div>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <button
                type="button"
                onClick={handlePublish}
                disabled={stage === "publishing"}
                className="inline-flex items-center gap-2 rounded-2xl bg-brand px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-brand/25 transition-colors hover:bg-brand-dark disabled:opacity-60"
              >
                {stage === "publishing" && <Loader2 className="h-4 w-4 animate-spin" />}
                {stage === "publishing" ? "Publishing…" : "Publish my profile"}
                {stage !== "publishing" && <ArrowRight className="h-4 w-4" />}
              </button>
              <p className="text-xs leading-relaxed text-ink-faint">
                Matching starts immediately.
                <br />
                You can refine everything later.
              </p>
            </div>
          </>
        )}
      </main>
    </div>
  );
}

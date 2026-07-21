"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Loader2, Video } from "lucide-react";
import { api } from "@/lib/auth-client";

// priceUsd is the employer price — the interviewer's rate plus the platform
// fee, computed server-side. The raw rate never reaches the client.
export type PoolInterviewer = {
  id: string;
  name: string;
  bio: string | null;
  expertise: string[];
  languages: string[];
  yearsExperience: number;
  priceUsd: number;
};

export function InterviewPool({
  slateEntryId,
  candidateName,
  interviewers,
  durationMinutes,
  alreadyRequested,
}: {
  slateEntryId: string;
  candidateName: string;
  interviewers: PoolInterviewer[];
  durationMinutes: number;
  alreadyRequested: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(alreadyRequested);
  const [questionsText, setQuestionsText] = useState("");
  const [notes, setNotes] = useState("");

  if (done) {
    return (
      <Link
        href="/employer/interviews"
        className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium text-brand ring-1 ring-inset ring-brand/30 transition-colors hover:bg-brand-soft"
      >
        <Check className="h-4 w-4" strokeWidth={1.75} /> Interview requested
      </Link>
    );
  }

  async function choose(interviewerId: string) {
    setError(null);
    setPendingId(interviewerId);
    const suggestedQuestions = questionsText
      .split("\n")
      .map((q) => q.trim())
      .filter(Boolean);
    try {
      await api("/api/interviews", {
        method: "POST",
        body: JSON.stringify({
          slateEntryId,
          interviewerId,
          suggestedQuestions,
          employerNotes: notes.trim() || undefined,
        }),
      });
      setDone(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not request the interview");
      setPendingId(null);
    }
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium text-brand ring-1 ring-inset ring-brand/30 transition-colors hover:bg-brand-soft"
      >
        <Video className="h-4 w-4" strokeWidth={1.75} /> Interview this candidate
      </button>
    );
  }

  return (
    <div className="w-full rounded-2xl border border-line bg-paper p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h4 className="font-display text-sm font-semibold text-ink">
            Pick an interviewer for {candidateName}
          </h4>
          <p className="mt-1 text-sm leading-relaxed text-ink-soft">
            A vetted interviewer runs a recorded {durationMinutes}-minute interview and files an
            assessment. {candidateName} is asked to consent first — you are only charged after they
            agree. The interview is recorded, and the recording is shared with you.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="shrink-0 text-sm text-ink-faint hover:text-ink"
        >
          Close
        </button>
      </div>

      <div className="mt-4 space-y-4">
        <div>
          <label htmlFor="iv-questions" className="block text-sm font-medium text-ink">
            Suggested questions <span className="font-normal text-ink-faint">(optional)</span>
          </label>
          <p className="mt-0.5 text-xs text-ink-faint">One per line. The interviewer sees these.</p>
          <textarea
            id="iv-questions"
            rows={4}
            value={questionsText}
            onChange={(e) => setQuestionsText(e.target.value)}
            placeholder={"Walk me through a system you designed end to end.\nHow do you handle disagreement on a technical decision?"}
            className="mt-1.5 w-full rounded-xl border border-line bg-white px-4 py-3 text-base text-ink placeholder:text-ink-faint focus:outline-2 focus:outline-brand sm:text-sm"
          />
        </div>
        <div>
          <label htmlFor="iv-notes" className="block text-sm font-medium text-ink">
            Notes for the interviewer <span className="font-normal text-ink-faint">(optional)</span>
          </label>
          <p className="mt-0.5 text-xs text-ink-faint">
            Context or what to probe — the role, must-haves, anything to confirm.
          </p>
          <textarea
            id="iv-notes"
            rows={3}
            maxLength={2000}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-line bg-white px-4 py-3 text-base text-ink placeholder:text-ink-faint focus:outline-2 focus:outline-brand sm:text-sm"
          />
        </div>
      </div>

      {interviewers.length === 0 ? (
        <p className="mt-4 text-sm text-ink-soft">
          No interviewers are available right now. Check back shortly.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {interviewers.map((iv) => (
            <li key={iv.id} className="rounded-xl border border-line bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                    <p className="font-medium text-ink">{iv.name}</p>
                    <span className="text-xs text-ink-faint">
                      {iv.yearsExperience} yrs experience
                    </span>
                  </div>
                  {iv.bio && (
                    <p className="mt-1 text-sm leading-relaxed text-ink-soft">{iv.bio}</p>
                  )}
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {iv.expertise.map((e) => (
                      <span
                        key={e}
                        className="rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-medium text-brand"
                      >
                        {e}
                      </span>
                    ))}
                    {iv.languages.map((l) => (
                      <span
                        key={l}
                        className="rounded-full border border-line px-2 py-0.5 text-[11px] text-ink-soft"
                      >
                        {l}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="flex w-full flex-col items-stretch gap-1.5 sm:w-auto sm:items-end">
                  <p className="font-display text-lg font-semibold text-ink sm:text-right">
                    ${iv.priceUsd.toFixed(2)}
                  </p>
                  <button
                    type="button"
                    onClick={() => choose(iv.id)}
                    disabled={pendingId !== null}
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-dark disabled:opacity-60"
                  >
                    {pendingId === iv.id && <Loader2 className="h-4 w-4 animate-spin" />}
                    {pendingId === iv.id ? "Requesting…" : "Choose"}
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      {error && <p className="mt-3 text-sm text-ember">{error}</p>}
    </div>
  );
}

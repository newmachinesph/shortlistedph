"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Check, Loader2, Upload, Video } from "lucide-react";
import { api } from "@/lib/auth-client";

export type AssignmentCandidate = {
  name: string;
  headline: string | null;
  city: string | null;
  yearsExperience: number;
  skills: string[];
};

export type Assignment = {
  id: string;
  status: string; // paid | scheduled | recorded
  scheduledAt: string | null;
  hasRecording: boolean;
  company: string;
  candidate: AssignmentCandidate;
};

type Option = { value: string; label: string };

const INPUT =
  "w-full rounded-xl border border-line bg-paper px-4 py-3 text-base text-ink sm:text-sm focus:outline-2 focus:outline-brand";
const SCORES = [1, 2, 3, 4, 5];

export function InterviewerAssignment({
  assignment,
  durationMinutes,
  recommendationOptions,
}: {
  assignment: Assignment;
  durationMinutes: number;
  recommendationOptions: Option[];
}) {
  const router = useRouter();
  const { candidate } = assignment;
  const recorded = assignment.status === "recorded";

  return (
    <div className="rounded-2xl border border-line bg-white p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold text-ink">{candidate.name}</h2>
          <p className="text-sm text-ink-soft">
            {[candidate.headline, candidate.city, `${candidate.yearsExperience} yrs`]
              .filter(Boolean)
              .join(" · ")}
          </p>
          <p className="mt-0.5 text-sm text-ink-faint">for {assignment.company}</p>
        </div>
        <StatusPill status={assignment.status} />
      </div>

      {candidate.skills.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {candidate.skills.slice(0, 8).map((s) => (
            <span key={s} className="rounded-full bg-brand-soft px-2.5 py-1 text-xs font-medium text-brand">
              {s}
            </span>
          ))}
        </div>
      )}

      <ScheduleBlock assignment={assignment} durationMinutes={durationMinutes} onDone={() => router.refresh()} />
      <UploadBlock assignment={assignment} onDone={() => router.refresh()} />

      {recorded ? (
        <AssessmentBlock
          interviewId={assignment.id}
          recommendationOptions={recommendationOptions}
          onDone={() => router.refresh()}
        />
      ) : (
        <p className="mt-5 rounded-xl bg-paper px-4 py-3 text-sm text-ink-soft">
          Upload the recording to unlock the assessment. A report can&rsquo;t be filed without it.
        </p>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: Record<string, string> = {
    paid: "Needs scheduling",
    scheduled: "Scheduled",
    recorded: "Awaiting report",
  };
  return (
    <span className="inline-flex items-center rounded-full bg-ember-soft px-2.5 py-1 text-[11px] font-medium text-ember">
      {map[status] ?? status}
    </span>
  );
}

function ScheduleBlock({
  assignment,
  durationMinutes,
  onDone,
}: {
  assignment: Assignment;
  durationMinutes: number;
  onDone: () => void;
}) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!value) return setError("Pick a date and time.");
    setError(null);
    setBusy(true);
    try {
      await api("/api/interviewer/schedule", {
        method: "POST",
        body: JSON.stringify({ interviewId: assignment.id, scheduledAt: value }),
      });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save the time");
      setBusy(false);
    }
  }

  return (
    <div className="mt-5 border-t border-line pt-5">
      <p className="flex items-center gap-2 text-sm font-medium text-ink">
        <CalendarClock className="h-4 w-4 text-ink-soft" strokeWidth={1.75} />
        {assignment.scheduledAt ? "Scheduled time" : "Set the time"}
        <span className="font-normal text-ink-faint">· {durationMinutes} min</span>
      </p>
      {assignment.scheduledAt && (
        <p className="mt-1 text-sm text-ink-soft">
          {new Date(assignment.scheduledAt).toLocaleString("en-PH", {
            dateStyle: "medium",
            timeStyle: "short",
          })}
        </p>
      )}
      <div className="mt-2 flex flex-col gap-2 sm:flex-row">
        <input
          type="datetime-local"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className={INPUT}
          aria-label="Interview date and time"
        />
        <button
          type="button"
          onClick={submit}
          disabled={busy}
          className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-brand px-4 text-sm font-medium text-white transition-colors hover:bg-brand-dark disabled:opacity-60"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          {assignment.scheduledAt ? "Reschedule" : "Confirm"}
        </button>
      </div>
      {error && <p className="mt-1.5 text-xs text-ember">{error}</p>}
    </div>
  );
}

function UploadBlock({ assignment, onDone }: { assignment: Assignment; onDone: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [stage, setStage] = useState<"idle" | "uploading">("idle");

  async function handleFile(file: File) {
    setError(null);
    setStage("uploading");
    try {
      const { uploadUrl, key } = await api<{ uploadUrl: string; key: string }>(
        "/api/interviewer/recording",
        {
          method: "POST",
          body: JSON.stringify({ interviewId: assignment.id, contentType: file.type, sizeBytes: file.size }),
        },
      );

      const put = await fetch(uploadUrl, { method: "PUT", body: file, headers: { "Content-Type": file.type } });
      if (!put.ok) throw new Error("Upload failed. Check your connection and try again");

      await api("/api/interviewer/recording", {
        method: "PATCH",
        body: JSON.stringify({ interviewId: assignment.id, key }),
      });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setStage("idle");
    }
  }

  if (assignment.hasRecording) {
    return (
      <div className="mt-5 border-t border-line pt-5">
        <p className="flex items-center gap-2 text-sm text-ink-soft">
          <Check className="h-4 w-4 text-brand" strokeWidth={2} /> Recording uploaded
        </p>
      </div>
    );
  }

  return (
    <div className="mt-5 border-t border-line pt-5">
      <p className="flex items-center gap-2 text-sm font-medium text-ink">
        <Video className="h-4 w-4 text-ink-soft" strokeWidth={1.75} /> Upload the recording
      </p>
      <p className="mt-0.5 text-xs text-ink-faint">MP4, WebM, MOV, MKV, or an audio file.</p>
      <label className="mt-2 flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-dashed border-line bg-paper px-4 text-sm font-medium text-ink-soft transition-colors hover:border-brand/40 hover:text-brand">
        {stage === "uploading" ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> Uploading…
          </>
        ) : (
          <>
            <Upload className="h-4 w-4" strokeWidth={1.75} /> Choose file
          </>
        )}
        <input
          type="file"
          accept="video/*,audio/*"
          disabled={stage === "uploading"}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFile(f);
          }}
          className="hidden"
        />
      </label>
      {error && <p className="mt-1.5 text-xs text-ember">{error}</p>}
    </div>
  );
}

function AssessmentBlock({
  interviewId,
  recommendationOptions,
  onDone,
}: {
  interviewId: string;
  recommendationOptions: Option[];
  onDone: () => void;
}) {
  const [form, setForm] = useState({
    recommendation: "",
    overall: 0,
    technical: 0,
    communication: 0,
    englishFluency: 0,
    strengths: "",
    concerns: "",
    notes: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const scoreFields: [keyof typeof form, string][] = [
    ["overall", "Overall"],
    ["technical", "Technical"],
    ["communication", "Communication"],
    ["englishFluency", "English fluency"],
  ];

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.recommendation) return setError("Pick a recommendation.");
    for (const [key, label] of scoreFields) {
      if (!form[key]) return setError(`Score ${label.toLowerCase()} from 1 to 5.`);
    }
    if (!form.strengths.trim()) return setError("Note at least one strength.");
    if (!form.concerns.trim()) return setError("Note any concerns.");

    setBusy(true);
    try {
      await api("/api/interviewer/assessment", {
        method: "POST",
        body: JSON.stringify({
          interviewId,
          recommendation: form.recommendation,
          overall: form.overall,
          technical: form.technical,
          communication: form.communication,
          englishFluency: form.englishFluency,
          strengths: form.strengths.trim(),
          concerns: form.concerns.trim(),
          notes: form.notes.trim() || undefined,
        }),
      });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not file the assessment");
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-5 border-t border-line pt-5">
      <p className="text-sm font-medium text-ink">File the assessment</p>

      {error && <p className="mt-3 rounded-xl bg-ember-soft px-4 py-3 text-sm text-ember">{error}</p>}

      <label htmlFor={`rec-${interviewId}`} className="mt-4 block text-sm font-medium text-ink">
        Recommendation
      </label>
      <select
        id={`rec-${interviewId}`}
        value={form.recommendation}
        onChange={(e) => setForm({ ...form, recommendation: e.target.value })}
        className={`${INPUT} mt-1.5`}
      >
        <option value="">Choose…</option>
        {recommendationOptions.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>

      <div className="mt-4 space-y-3">
        {scoreFields.map(([key, label]) => (
          <div key={key}>
            <p className="text-sm font-medium text-ink">{label}</p>
            <div className="mt-1.5 grid grid-cols-5 gap-1.5">
              {SCORES.map((n) => {
                const active = form[key] === n;
                return (
                  <button
                    key={n}
                    type="button"
                    aria-pressed={active}
                    onClick={() => setForm({ ...form, [key]: n })}
                    className={`min-h-11 rounded-xl border text-sm font-medium transition-colors ${
                      active
                        ? "border-brand bg-brand text-white"
                        : "border-line bg-paper text-ink-soft hover:border-brand/40 hover:text-brand"
                    }`}
                  >
                    {n}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <label htmlFor={`str-${interviewId}`} className="mt-4 block text-sm font-medium text-ink">
        Strengths
      </label>
      <textarea
        id={`str-${interviewId}`}
        rows={3}
        value={form.strengths}
        onChange={(e) => setForm({ ...form, strengths: e.target.value })}
        className={`${INPUT} mt-1.5`}
      />

      <label htmlFor={`con-${interviewId}`} className="mt-4 block text-sm font-medium text-ink">
        Concerns
      </label>
      <textarea
        id={`con-${interviewId}`}
        rows={3}
        value={form.concerns}
        onChange={(e) => setForm({ ...form, concerns: e.target.value })}
        className={`${INPUT} mt-1.5`}
      />

      <label htmlFor={`notes-${interviewId}`} className="mt-4 block text-sm font-medium text-ink">
        Notes <span className="font-normal text-ink-faint">(optional)</span>
      </label>
      <textarea
        id={`notes-${interviewId}`}
        rows={2}
        value={form.notes}
        onChange={(e) => setForm({ ...form, notes: e.target.value })}
        className={`${INPUT} mt-1.5`}
      />

      <button
        type="submit"
        disabled={busy}
        className="mt-5 flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-brand-dark disabled:opacity-60"
      >
        {busy && <Loader2 className="h-4 w-4 animate-spin" />}
        {busy ? "Filing…" : "Submit assessment"}
      </button>
      <p className="mt-2 text-center text-xs text-ink-faint">
        This sends the report to the employer and closes the interview.
      </p>
    </form>
  );
}

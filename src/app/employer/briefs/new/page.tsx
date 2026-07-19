"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, EyeOff, Plus, Sparkles, X } from "lucide-react";

const draft = {
  title: "Medical VA for a growing dental group",
  budget: "$8 – $11 / hr",
  hours: "40h / week",
  overlap: "≥ 4h EST overlap",
  mustHaves: ["US dental practice experience", "Insurance verification", "Practice management software", "Phone-heavy comfort"],
};

type Stage = "compose" | "drafting" | "review" | "posted";

const fieldCls =
  "mt-1 w-full rounded-xl border border-line bg-paper px-3.5 py-2.5 text-sm text-ink focus:outline-2 focus:outline-brand";

export default function NewBriefPage() {
  const [stage, setStage] = useState<Stage>("compose");
  const [text, setText] = useState("");
  const [title, setTitle] = useState(draft.title);
  const [budget, setBudget] = useState(draft.budget);
  const [hours, setHours] = useState(draft.hours);
  const [overlap, setOverlap] = useState(draft.overlap);
  const [mustHaves, setMustHaves] = useState(draft.mustHaves);
  const [newMustHave, setNewMustHave] = useState("");

  const handleDraft = () => {
    setStage("drafting");
    setTimeout(() => setStage("review"), 1400);
  };

  const removeMustHave = (m: string) =>
    setMustHaves((prev) => prev.filter((x) => x !== m));

  const addMustHave = () => {
    const v = newMustHave.trim();
    if (!v || mustHaves.includes(v)) return;
    setMustHaves((prev) => [...prev, v]);
    setNewMustHave("");
  };

  if (stage === "posted") {
    return (
      <div className="mx-auto max-w-lg pt-16 text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-soft">
          <EyeOff className="h-6 w-6 text-brand" />
        </span>
        <h1 className="font-display mt-5 text-2xl font-semibold tracking-tight text-ink">
          Posted — and hidden.
        </h1>
        <p className="mt-3 leading-relaxed text-ink-soft">
          No candidate will ever see it. We&rsquo;re matching it against 512
          standing profiles now; your ranked shortlist lands in roughly 24
          hours.
        </p>
        <Link
          href="/employer/briefs/medical-va-dental"
          className="mt-7 inline-flex items-center gap-2 rounded-2xl bg-brand px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-dark"
        >
          Preview a finished slate <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">New job description</h1>
      <p className="mt-1.5 flex items-center gap-1.5 text-sm text-ink-soft">
        <EyeOff className="h-4 w-4" />
        <span>
          Job descriptions are never shown to candidates. Be blunt — real
          budget, real dealbreakers.
        </span>
      </p>

      {stage !== "review" ? (
        <div className="mt-6 rounded-2xl border border-line bg-white p-6">
          <label htmlFor="brief" className="text-sm font-medium text-ink">
            Describe who you need
          </label>
          <textarea
            id="brief"
            rows={8}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={
              "Paste a job description, or write freely:\n\nWe run 3 dental clinics in Austin. Need a VA who has actually worked US dental front desk — insurance verification, Dentrix, heavy phones. $8–11/hr, 40h, at least 4h EST overlap. Dealbreaker: no healthcare experience."
            }
            className="mt-3 w-full resize-none rounded-xl border border-line bg-paper px-4 py-3 text-sm leading-relaxed text-ink placeholder:text-ink-faint focus:outline-2 focus:outline-brand"
          />
          <button
            onClick={handleDraft}
            disabled={stage === "drafting"}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Sparkles className="h-4 w-4" />
            {stage === "drafting" ? "Structuring your job description…" : "Draft with AI"}
          </button>
        </div>
      ) : (
        <div className="mt-6 space-y-5">
          <div className="rounded-2xl border border-line bg-white p-6">
            <p className="flex items-center gap-1.5 text-xs font-medium text-brand">
              <Sparkles className="h-3.5 w-3.5" /> Drafted from your description — edit anything
            </p>
            <div className="mt-4 space-y-4">
              <div>
                <label htmlFor="title" className="text-xs text-ink-faint">Title</label>
                <input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className={`${fieldCls} font-medium`}
                />
              </div>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                <div>
                  <label htmlFor="budget" className="text-xs text-ink-faint">Budget band</label>
                  <input id="budget" value={budget} onChange={(e) => setBudget(e.target.value)} className={fieldCls} />
                </div>
                <div>
                  <label htmlFor="hours" className="text-xs text-ink-faint">Hours</label>
                  <input id="hours" value={hours} onChange={(e) => setHours(e.target.value)} className={fieldCls} />
                </div>
                <div>
                  <label htmlFor="overlap" className="text-xs text-ink-faint">Overlap</label>
                  <input id="overlap" value={overlap} onChange={(e) => setOverlap(e.target.value)} className={fieldCls} />
                </div>
              </div>
              <div>
                <span className="text-xs text-ink-faint">Must-haves</span>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {mustHaves.map((m) => (
                    <span
                      key={m}
                      className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft py-1 pl-2.5 pr-1.5 text-xs font-medium text-brand"
                    >
                      {m}
                      <button
                        onClick={() => removeMustHave(m)}
                        aria-label={`Remove ${m}`}
                        className="rounded-full p-0.5 transition-colors hover:bg-brand hover:text-white"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="mt-2.5 flex gap-2">
                  <input
                    value={newMustHave}
                    onChange={(e) => setNewMustHave(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addMustHave()}
                    placeholder="Add a must-have…"
                    aria-label="Add a must-have"
                    className="w-full max-w-64 rounded-xl border border-line bg-paper px-3.5 py-2 text-sm text-ink placeholder:text-ink-faint focus:outline-2 focus:outline-brand"
                  />
                  <button
                    onClick={addMustHave}
                    aria-label="Add must-have"
                    className="rounded-xl px-3 py-2 text-brand ring-1 ring-inset ring-brand/30 transition-colors hover:bg-brand-soft"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setStage("posted")}
              className="rounded-2xl bg-brand px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-brand/25 transition-colors hover:bg-brand-dark"
            >
              Post job description
            </button>
            <button
              onClick={() => setStage("compose")}
              className="rounded-2xl px-5 py-3 text-sm font-medium text-ink-soft transition-colors hover:text-ink"
            >
              Back to editing
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

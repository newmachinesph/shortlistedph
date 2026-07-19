"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, EyeOff, Loader2, Plus, Sparkles, X } from "lucide-react";
import { api } from "@/lib/auth-client";

type Stage = "compose" | "drafting" | "review" | "publishing" | "posted";

type Draft = {
  title: string;
  budgetMin: number | null;
  budgetMax: number | null;
  hoursPerWeek: number | null;
  overlap: string | null;
  mustHaves: string[];
  niceToHaves: string[];
};

// text-base on phones so iOS does not zoom the viewport on focus.
const fieldCls =
  "mt-1 w-full rounded-xl border border-line bg-paper px-3.5 py-2.5 text-base text-ink focus:outline-2 focus:outline-brand sm:text-sm";

export default function NewJobDescriptionPage() {
  const [stage, setStage] = useState<Stage>("compose");
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ jdId: string; scanned: number; entries: number } | null>(null);

  const [draft, setDraft] = useState<Draft>({
    title: "",
    budgetMin: null,
    budgetMax: null,
    hoursPerWeek: null,
    overlap: null,
    mustHaves: [],
    niceToHaves: [],
  });
  const [newMustHave, setNewMustHave] = useState("");

  async function handleDraft() {
    setError(null);
    setStage("drafting");
    try {
      const { draft } = await api<{ draft: Draft }>("/api/jds/draft", {
        method: "POST",
        body: JSON.stringify({ text }),
      });
      setDraft(draft);
      setStage("review");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not draft that");
      setStage("compose");
    }
  }

  async function handlePublish() {
    setError(null);
    setStage("publishing");
    try {
      const { jd } = await api<{ jd: { id: string } }>("/api/jds", {
        method: "POST",
        body: JSON.stringify(draft),
      });
      const matched = await api<{ scanned: number; entries: number }>(`/api/jds/${jd.id}/publish`, {
        method: "POST",
      });
      setResult({ jdId: jd.id, ...matched });
      setStage("posted");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not publish");
      setStage("review");
    }
  }

  const removeMustHave = (m: string) =>
    setDraft((d) => ({ ...d, mustHaves: d.mustHaves.filter((x) => x !== m) }));

  const addMustHave = () => {
    const v = newMustHave.trim();
    if (!v || draft.mustHaves.includes(v)) return;
    setDraft((d) => ({ ...d, mustHaves: [...d.mustHaves, v] }));
    setNewMustHave("");
  };

  if (stage === "posted" && result) {
    return (
      <div className="mx-auto max-w-lg pt-16 text-center">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-soft">
          <EyeOff className="h-6 w-6 text-brand" />
        </span>
        <h1 className="font-display mt-5 text-2xl font-semibold tracking-tight text-ink">
          Posted — and hidden.
        </h1>
        <p className="mt-3 leading-relaxed text-ink-soft">
          No candidate will ever see it. We scanned {result.scanned}{" "}
          {result.scanned === 1 ? "profile" : "profiles"} and ranked{" "}
          {result.entries} for your shortlist.
        </p>
        <Link
          href={`/employer/briefs/${result.jdId}`}
          className="mt-7 inline-flex items-center gap-2 rounded-2xl bg-brand px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-dark"
        >
          See your shortlist <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">
        New job description
      </h1>
      <p className="mt-1.5 flex items-center gap-1.5 text-sm text-ink-soft">
        <EyeOff className="h-4 w-4" />
        <span>Never shown to candidates. Be blunt — real budget, real dealbreakers.</span>
      </p>

      {error && <p className="mt-4 rounded-xl bg-ember-soft px-4 py-3 text-sm text-ember">{error}</p>}

      {stage === "compose" || stage === "drafting" ? (
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
            className="mt-3 w-full resize-none rounded-xl border border-line bg-paper px-4 py-3 text-base leading-relaxed text-ink placeholder:text-ink-faint focus:outline-2 focus:outline-brand sm:text-sm"
          />
          <button
            type="button"
            onClick={handleDraft}
            disabled={stage === "drafting" || text.trim().length < 20}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-brand px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60"
          >
            {stage === "drafting" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            {stage === "drafting" ? "Structuring…" : "Draft with AI"}
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
                  value={draft.title}
                  onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                  className={`${fieldCls} font-medium`}
                />
              </div>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div>
                  <label htmlFor="min" className="text-xs text-ink-faint">Budget min $/hr</label>
                  <input
                    id="min"
                    type="number"
                    value={draft.budgetMin ?? ""}
                    onChange={(e) => setDraft({ ...draft, budgetMin: e.target.value ? Number(e.target.value) : null })}
                    className={fieldCls}
                  />
                </div>
                <div>
                  <label htmlFor="max" className="text-xs text-ink-faint">Budget max $/hr</label>
                  <input
                    id="max"
                    type="number"
                    value={draft.budgetMax ?? ""}
                    onChange={(e) => setDraft({ ...draft, budgetMax: e.target.value ? Number(e.target.value) : null })}
                    className={fieldCls}
                  />
                </div>
                <div>
                  <label htmlFor="hours" className="text-xs text-ink-faint">Hours / week</label>
                  <input
                    id="hours"
                    type="number"
                    value={draft.hoursPerWeek ?? ""}
                    onChange={(e) => setDraft({ ...draft, hoursPerWeek: e.target.value ? Number(e.target.value) : null })}
                    className={fieldCls}
                  />
                </div>
                <div>
                  <label htmlFor="overlap" className="text-xs text-ink-faint">Overlap</label>
                  <input
                    id="overlap"
                    value={draft.overlap ?? ""}
                    onChange={(e) => setDraft({ ...draft, overlap: e.target.value || null })}
                    className={fieldCls}
                  />
                </div>
              </div>
              <div>
                <span className="text-xs text-ink-faint">Must-haves — these are hard filters</span>
                <div className="mt-1.5 flex flex-wrap gap-2">
                  {draft.mustHaves.map((m) => (
                    <span
                      key={m}
                      className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft py-1 pl-2.5 pr-1.5 text-xs font-medium text-brand"
                    >
                      {m}
                      <button
                        type="button"
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
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addMustHave();
                      }
                    }}
                    placeholder="Add a must-have…"
                    aria-label="Add a must-have"
                    className="w-full max-w-64 rounded-xl border border-line bg-paper px-3.5 py-2 text-base text-ink placeholder:text-ink-faint focus:outline-2 focus:outline-brand sm:text-sm"
                  />
                  <button
                    type="button"
                    onClick={addMustHave}
                    aria-label="Add must-have"
                    className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-brand ring-1 ring-inset ring-brand/30 transition-colors hover:bg-brand-soft"
                  >
                    <Plus className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handlePublish}
              disabled={stage === "publishing" || !draft.title || draft.mustHaves.length === 0}
              className="inline-flex items-center gap-2 rounded-2xl bg-brand px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-brand/25 transition-colors hover:bg-brand-dark disabled:opacity-60"
            >
              {stage === "publishing" && <Loader2 className="h-4 w-4 animate-spin" />}
              {stage === "publishing" ? "Matching the market…" : "Post and match"}
            </button>
            <button
              type="button"
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

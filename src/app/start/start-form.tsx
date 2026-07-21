"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Loader2, Plus, Users, X } from "lucide-react";
import { api } from "@/lib/auth-client";

export type StartInitial = {
  title: string;
  rawText: string;
  budgetMax: number | null;
  hoursPerWeek: number | null;
  mustHaves: string[];
  count: number | null;
};

// text-base on phones so iOS does not zoom the viewport on focus (16px targets).
const fieldCls =
  "mt-1 w-full rounded-xl border border-line bg-paper px-3.5 py-3 text-base text-ink placeholder:text-ink-faint focus:outline-2 focus:outline-brand sm:text-sm";

export function StartForm({ initial }: { initial: StartInitial }) {
  const [text, setText] = useState(initial.rawText);
  const [title, setTitle] = useState(initial.title);
  const [budgetMax, setBudgetMax] = useState<string>(initial.budgetMax?.toString() ?? "");
  const [hours, setHours] = useState<string>(initial.hoursPerWeek?.toString() ?? "");
  const [mustHaves, setMustHaves] = useState<string[]>(initial.mustHaves);
  const [newMustHave, setNewMustHave] = useState("");

  const [count, setCount] = useState<number | null>(initial.count);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addMustHave = () => {
    const v = newMustHave.trim();
    if (!v || mustHaves.includes(v) || mustHaves.length >= 10) return;
    setMustHaves((m) => [...m, v]);
    setNewMustHave("");
  };
  const removeMustHave = (m: string) => setMustHaves((prev) => prev.filter((x) => x !== m));

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const { count } = await api<{ count: number }>("/api/start", {
        method: "POST",
        body: JSON.stringify({
          title: title.trim(),
          rawText: text.trim(),
          budgetMax: budgetMax ? Number(budgetMax) : null,
          hoursPerWeek: hours ? Number(hours) : null,
          mustHaves,
        }),
      });
      setCount(count);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not count that");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-2xl border border-line bg-white p-6 sm:p-7">
      <label htmlFor="what" className="text-sm font-medium text-ink">
        What do you need done?
      </label>
      <textarea
        id="what"
        rows={5}
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="A VA who has run US dental front-desk — insurance verification, Dentrix, heavy phones. At least 4h EST overlap. Dealbreaker: no healthcare experience."
        className="mt-2 w-full resize-none rounded-xl border border-line bg-paper px-4 py-3 text-base leading-relaxed text-ink placeholder:text-ink-faint focus:outline-2 focus:outline-brand sm:text-sm"
      />

      <div className="mt-4">
        <label htmlFor="title" className="text-xs text-ink-faint">
          Role title <span className="text-ink-faint/70">(optional)</span>
        </label>
        <input
          id="title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Dental virtual assistant"
          className={fieldCls}
        />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4">
        <div>
          <label htmlFor="budget" className="text-xs text-ink-faint">
            Budget ceiling $/hr
          </label>
          <input
            id="budget"
            type="number"
            inputMode="decimal"
            min={0}
            value={budgetMax}
            onChange={(e) => setBudgetMax(e.target.value)}
            placeholder="11"
            className={fieldCls}
          />
        </div>
        <div>
          <label htmlFor="hours" className="text-xs text-ink-faint">
            Hours / week
          </label>
          <input
            id="hours"
            type="number"
            inputMode="numeric"
            min={1}
            value={hours}
            onChange={(e) => setHours(e.target.value)}
            placeholder="40"
            className={fieldCls}
          />
        </div>
      </div>

      <div className="mt-4">
        <span className="text-xs text-ink-faint">
          Must-haves <span className="text-ink-faint/70">(optional, hard filters)</span>
        </span>
        {mustHaves.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-2">
            {mustHaves.map((m) => (
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
                  <X className="h-3 w-3" strokeWidth={1.75} />
                </button>
              </span>
            ))}
          </div>
        )}
        <div className="mt-2 flex gap-2">
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
            className="w-full max-w-64 rounded-xl border border-line bg-paper px-3.5 py-2.5 text-base text-ink placeholder:text-ink-faint focus:outline-2 focus:outline-brand sm:text-sm"
          />
          <button
            type="button"
            onClick={addMustHave}
            aria-label="Add must-have"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-brand ring-1 ring-inset ring-brand/30 transition-colors hover:bg-brand-soft"
          >
            <Plus className="h-4 w-4" strokeWidth={1.75} />
          </button>
        </div>
      </div>

      {error && (
        <p className="mt-4 rounded-xl bg-ember-soft px-4 py-3 text-sm text-ember">{error}</p>
      )}

      <button
        type="submit"
        disabled={loading || text.trim().length < 10}
        className="mt-5 inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl bg-brand px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
      >
        {loading ? <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.75} /> : <Users className="h-4 w-4" strokeWidth={1.75} />}
        {count === null ? "See how many match" : "Update the count"}
      </button>

      {count !== null && (
        <div className="mt-6 rounded-2xl border border-brand/25 bg-brand-soft p-5">
          {count > 0 ? (
            <p className="text-base leading-relaxed text-ink">
              <span className="font-display text-2xl font-semibold text-brand">
                About {count.toLocaleString("en-PH")}
              </span>{" "}
              Filipino {count === 1 ? "professional already matches" : "professionals already match"} —
              and we keep sourcing.
            </p>
          ) : (
            <p className="text-base leading-relaxed text-ink">
              We source Filipino professionals for roles like this every week. Describe yours now and
              you&rsquo;ll be first in line as matches come in.
            </p>
          )}
          <p className="mt-2 text-sm text-ink-soft">
            You&rsquo;re seeing a count, not names. Create a free account to see the actual
            shortlist — no payment until you unlock it.
          </p>
          <Link
            href="/register"
            className="mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-brand px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-brand-dark"
          >
            Create a free account to see your shortlist <ArrowRight className="h-4 w-4" strokeWidth={1.75} />
          </Link>
        </div>
      )}
    </form>
  );
}

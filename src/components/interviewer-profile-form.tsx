"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { api } from "@/lib/auth-client";

const INPUT =
  "mt-1.5 w-full rounded-xl border border-line bg-paper px-4 py-3 text-base text-ink sm:text-sm focus:outline-2 focus:outline-brand";

function toList(raw: string): string[] {
  const seen = new Set<string>();
  for (const part of raw.split(/[,\n]/)) {
    const v = part.trim();
    if (v) seen.add(v);
  }
  return [...seen];
}

export function InterviewerProfileForm({
  initial,
  rateMin,
  rateMax,
}: {
  initial: { bio: string; expertise: string; languages: string; rateUsd: number };
  rateMin: number;
  rateMax: number;
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    bio: initial.bio,
    expertise: initial.expertise,
    languages: initial.languages,
    rateUsd: String(initial.rateUsd),
  });
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setForm({ ...form, [k]: e.target.value });
    setSaved(false);
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const expertise = toList(form.expertise);
    const languages = toList(form.languages);
    if (!expertise.length) return setError("List at least one area of expertise.");
    if (!languages.length) return setError("List at least one language.");

    setBusy(true);
    try {
      await api("/api/interviewer/profile", {
        method: "PATCH",
        body: JSON.stringify({
          bio: form.bio.trim(),
          expertise,
          languages,
          rateUsd: Number(form.rateUsd) || rateMin,
        }),
      });
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save your profile");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 rounded-2xl border border-line bg-white p-5 sm:p-7">
      {error && <p className="mb-4 rounded-xl bg-ember-soft px-4 py-3 text-sm text-ember">{error}</p>}

      <label htmlFor="bio" className="block text-sm font-medium text-ink">
        About you
      </label>
      <textarea id="bio" required minLength={30} rows={5} value={form.bio} onChange={set("bio")} className={INPUT} />

      <label htmlFor="expertise" className="mt-4 block text-sm font-medium text-ink">
        Areas of expertise
      </label>
      <p className="mt-0.5 text-xs text-ink-faint">Comma-separated.</p>
      <input id="expertise" required value={form.expertise} onChange={set("expertise")} className={INPUT} />

      <label htmlFor="languages" className="mt-4 block text-sm font-medium text-ink">
        Languages
      </label>
      <p className="mt-0.5 text-xs text-ink-faint">Comma-separated.</p>
      <input id="languages" required value={form.languages} onChange={set("languages")} className={INPUT} />

      <label htmlFor="rate" className="mt-4 block text-sm font-medium text-ink">
        Rate (USD / interview)
      </label>
      <input
        id="rate"
        type="number"
        inputMode="decimal"
        min={rateMin}
        max={rateMax}
        step={1}
        required
        value={form.rateUsd}
        onChange={set("rateUsd")}
        className={INPUT}
      />
      <p className="mt-1 text-xs text-ink-faint">
        ${rateMin}–${rateMax}. Outside this range is clamped.
      </p>

      <button
        type="submit"
        disabled={busy}
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-brand-dark disabled:opacity-60"
      >
        {busy && <Loader2 className="h-4 w-4 animate-spin" />}
        {saved && !busy ? (
          <>
            <Check className="h-4 w-4" strokeWidth={2} /> Saved
          </>
        ) : busy ? (
          "Saving…"
        ) : (
          "Save changes"
        )}
      </button>
    </form>
  );
}

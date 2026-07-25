"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { api } from "@/lib/auth-client";

/**
 * `visibility` is two gates at once: matching reads it as the pool cut, and the
 * public showcase reads it as consent to show the person's face. It had no UI
 * at all — everyone sat on the `true` default having never been asked.
 *
 * An explicit button, not a checkbox that saves on change: leaving the matching
 * pool is not something to do by brushing a control.
 */
export function VisibilityToggle({ visible }: { visible: boolean }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    setSaving(true);
    setError(null);
    try {
      await api("/api/talent/profile", {
        method: "PATCH",
        body: JSON.stringify({ visibility: !visible }),
      });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="mt-5 rounded-2xl border border-line bg-white p-6">
      <div className="flex items-center gap-2">
        {visible ? (
          <Eye className="h-4 w-4 text-brand" strokeWidth={1.75} />
        ) : (
          <EyeOff className="h-4 w-4 text-ink-faint" strokeWidth={1.75} />
        )}
        <h2 className="text-sm font-medium uppercase tracking-wider text-ink-faint">
          Matching and your photo
        </h2>
      </div>

      <p className="font-display mt-3 text-lg font-semibold text-ink">
        {visible ? "In the matching pool" : "Out of the matching pool"}
      </p>

      <ul className="mt-3 space-y-2 text-sm leading-relaxed text-ink-soft">
        <li>
          {visible
            ? "The engine can consider you for a shortlist. You are still never browsable — every appearance needs an invitation you accept first."
            : "No job is matched against your profile and no new invitations are sent. Shortlists you already accepted stay exactly as they are."}
        </li>
        <li>
          {visible
            ? "Your photo may appear on our public pages as a face only — never with your name, city, or headline."
            : "Your photo will not appear on any public page."}
        </li>
      </ul>

      {error && <p className="mt-3 text-sm text-ember">{error}</p>}

      <button
        type="button"
        onClick={toggle}
        disabled={saving}
        className={`mt-5 inline-flex min-h-[44px] items-center gap-2 rounded-xl px-5 text-sm font-medium transition-colors disabled:opacity-60 ${
          visible
            ? "border border-line bg-paper text-ink-soft hover:border-ember hover:text-ember"
            : "bg-brand text-white hover:bg-brand-dark"
        }`}
      >
        {saving && <Loader2 className="h-4 w-4 animate-spin" />}
        {visible ? "Take me out of matching" : "Put me back in matching"}
      </button>
    </section>
  );
}

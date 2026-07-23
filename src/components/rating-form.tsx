"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Star } from "lucide-react";
import { api } from "@/lib/auth-client";

/** Inline star picker + optional comment. Post, then refresh — same shape as MessageSend. */
export function RatingForm({ connectionId }: { connectionId: string }) {
  const router = useRouter();
  const [stars, setStars] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (sent) {
    return (
      <span className="mt-4 inline-flex items-center gap-1.5 rounded-xl bg-brand-soft px-4 py-2 text-sm font-medium text-brand">
        <Check className="h-4 w-4" strokeWidth={1.75} /> Rating submitted
      </span>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (stars < 1 || busy) return;
    setError(null);
    setBusy(true);
    try {
      await api("/api/ratings", {
        method: "POST",
        body: JSON.stringify({ connectionId, stars, comment: comment.trim() || undefined }),
      });
      setSent(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not submit the rating");
    } finally {
      setBusy(false);
    }
  }

  const active = hovered || stars;

  return (
    <form onSubmit={handleSubmit} className="mt-4 space-y-3">
      <div className="flex items-center gap-1" onMouseLeave={() => setHovered(0)}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            aria-label={`${n} star${n === 1 ? "" : "s"}`}
            onClick={() => setStars(n)}
            onMouseEnter={() => setHovered(n)}
            className="p-0.5"
          >
            <Star
              strokeWidth={1.75}
              className={`h-6 w-6 transition-colors ${
                n <= active ? "fill-brand text-brand" : "text-ink-faint"
              }`}
            />
          </button>
        ))}
      </div>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        maxLength={2000}
        rows={2}
        placeholder="Optional comment — what was working with them like?"
        aria-label="Rating comment"
        className="w-full rounded-xl border border-line bg-paper px-4 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:border-brand focus:outline-none"
      />
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={stars < 1 || busy}
          className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-dark disabled:opacity-50"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.75} />}
          {busy ? "Submitting…" : "Submit rating"}
        </button>
        {error && <span className="text-xs text-ember">{error}</span>}
      </div>
    </form>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

/**
 * Approve or reject one identity attempt. Rejecting demands a note before the
 * button does anything — the note is delivered to the applicant, and "rejected,
 * no reason given" on something they paid for is not an outcome we ship.
 */
export function VerificationActions({ userId }: { userId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState("");

  async function send(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/verifications/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        setError(payload?.error ?? "Review failed");
        return;
      }
      startTransition(() => router.refresh());
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  const disabled = busy || pending;

  return (
    <div className="mt-3 flex w-full flex-wrap items-center gap-2 border-t border-line pt-3">
      <input
        type="text"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        maxLength={500}
        placeholder="Reason — required to reject, sent to the applicant"
        className="min-w-0 flex-1 basis-64 rounded-lg border border-line bg-paper px-2 py-1.5 text-base sm:text-xs"
      />
      <button
        type="button"
        disabled={disabled}
        onClick={() => send({ action: "approve" })}
        className="inline-flex min-h-11 items-center rounded-xl bg-brand px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-brand-dark disabled:opacity-50 sm:min-h-0"
      >
        {disabled ? "Saving…" : "Approve"}
      </button>
      <button
        type="button"
        disabled={disabled || note.trim().length === 0}
        onClick={() => send({ action: "reject", note: note.trim() })}
        className="inline-flex min-h-11 items-center rounded-xl px-3 py-1.5 text-xs font-medium text-ember ring-1 ring-inset ring-ember/30 transition-colors hover:bg-ember-soft disabled:opacity-50 sm:min-h-0"
      >
        Reject
      </button>
      {error && <span className="w-full text-xs text-ember">{error}</span>}
    </div>
  );
}

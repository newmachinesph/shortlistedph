"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Action = "approve" | "reject" | "pause" | "activate" | "revoke";

function useVet(interviewerId: string) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: Action) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/interviewers/${interviewerId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const payload = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        setError(payload?.error ?? "Could not update interviewer");
        return;
      }
      startTransition(() => router.refresh());
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  return { disabled: busy || pending, error, run };
}

/** Approve or reject a pending application. */
export function InterviewerVet({ interviewerId }: { interviewerId: string }) {
  const { disabled, error, run } = useVet(interviewerId);
  return (
    <div className="w-full sm:w-auto">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => run("approve")}
          disabled={disabled}
          className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl bg-brand px-4 py-1.5 text-xs font-medium text-white transition-colors hover:bg-brand-dark disabled:opacity-50 sm:min-h-0 sm:flex-none"
        >
          {disabled ? "Saving…" : "Approve"}
        </button>
        <button
          type="button"
          onClick={() => run("reject")}
          disabled={disabled}
          className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl px-4 py-1.5 text-xs font-medium text-ember ring-1 ring-inset ring-line transition-colors hover:bg-ember-soft disabled:opacity-50 sm:min-h-0 sm:flex-none"
        >
          Reject
        </button>
      </div>
      {error && <p className="mt-1.5 text-xs text-ember">{error}</p>}
    </div>
  );
}

/**
 * Pause, reactivate, or revoke someone already on the roster.
 *
 * Revoke is terminal and needs a second click: the portal admits active and
 * paused only, so this is the door closing. The interview history stays.
 */
export function InterviewerToggle({
  interviewerId,
  status,
}: {
  interviewerId: string;
  status: string;
}) {
  const { disabled, error, run } = useVet(interviewerId);
  const [confirming, setConfirming] = useState(false);
  const paused = status === "paused";

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {confirming && (
        <span className="w-full text-right text-[11px] leading-relaxed text-ember">
          Revoking is permanent — they lose the portal and cannot be reinstated from here. Click
          again to confirm.
        </span>
      )}
      <button
        type="button"
        onClick={() => run(paused ? "activate" : "pause")}
        disabled={disabled}
        className="inline-flex min-h-11 items-center justify-center rounded-xl px-4 py-1.5 text-xs font-medium text-ink-soft ring-1 ring-inset ring-line transition-colors hover:bg-paper disabled:opacity-50 sm:min-h-0"
      >
        {disabled ? "Saving…" : paused ? "Reactivate" : "Pause"}
      </button>
      <button
        type="button"
        onClick={() => (confirming ? run("revoke") : setConfirming(true))}
        disabled={disabled}
        className="inline-flex min-h-11 items-center justify-center rounded-xl px-4 py-1.5 text-xs font-medium text-ember ring-1 ring-inset ring-ember/30 transition-colors hover:bg-ember-soft disabled:opacity-50 sm:min-h-0"
      >
        {confirming ? "Confirm revoke" : "Revoke"}
      </button>
      {error && <p className="w-full text-right text-xs text-ember">{error}</p>}
    </div>
  );
}

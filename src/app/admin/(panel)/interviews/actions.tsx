"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

/**
 * Admin cancel. Two clicks, because this is how an interview whose interviewer
 * went dark gets unwound: it returns the employer's credit and tells all three
 * parties, and there is no un-cancel.
 */
export function CancelInterview({ interviewId }: { interviewId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState("");

  async function cancel() {
    if (!confirming) {
      setConfirming(true);
      setError(null);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/interviews/${interviewId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel", reason: reason.trim() || undefined }),
      });
      const payload = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        setError(payload?.error ?? "Cancel failed");
        return;
      }
      startTransition(() => router.refresh());
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  }

  const disabled = busy || pending;

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {error && <span className="w-full text-right text-[11px] text-ember">{error}</span>}
      {confirming && (
        <>
          <span className="w-full text-right text-[11px] leading-relaxed text-ember">
            Returns the credit if one was spent and notifies employer, candidate and
            interviewer. Click again to confirm.
          </span>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={300}
            placeholder="Reason (optional)"
            className="w-40 rounded-lg border border-line bg-paper px-2 py-1.5 text-base sm:text-xs"
          />
        </>
      )}
      <button
        type="button"
        disabled={disabled}
        onClick={cancel}
        className="inline-flex min-h-11 items-center rounded-xl px-3 py-1.5 text-xs font-medium text-ember ring-1 ring-inset ring-ember/30 transition-colors hover:bg-ember-soft disabled:opacity-50 sm:min-h-0"
      >
        {confirming ? "Confirm cancel" : busy ? "Cancelling…" : "Cancel"}
      </button>
    </div>
  );
}

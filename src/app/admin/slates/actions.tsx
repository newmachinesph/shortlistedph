"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function StuckJdActions({ jdId, status }: { jdId: string; status: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  async function run(action: "rematch" | "fail") {
    if (action === "fail" && !confirming) {
      setConfirming(true);
      setError(null);
      return;
    }
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/admin/slates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, jdId }),
      });
      const payload = (await res.json().catch(() => null)) as
        | { error?: string; entries?: number; scanned?: number }
        | null;
      if (!res.ok) {
        setError(payload?.error ?? "Action failed");
        return;
      }
      if (action === "rematch") {
        setResult(
          payload?.entries
            ? `Shortlisted ${payload.entries} of ${payload.scanned} scanned.`
            : "Matching finished with no candidates above the bar.",
        );
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
  // A run already in flight owns the lock; a failed JD is terminal.
  const canRematch = status === "matching";
  const canFail = status === "matching" || status === "rematching";

  return (
    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 sm:justify-end">
      {error && <span className="w-full text-xs text-ember sm:w-auto sm:text-[11px]">{error}</span>}
      {result && (
        <span className="w-full text-xs text-ink-faint sm:w-auto sm:text-[11px]">{result}</span>
      )}
      {confirming && (
        <span className="w-full text-xs leading-relaxed text-ember sm:w-auto sm:text-[11px]">
          Marks this brief failed for the employer. Click again to confirm.
        </span>
      )}
      {canRematch && (
        <button
          type="button"
          disabled={disabled}
          onClick={() => run("rematch")}
          className="inline-flex min-h-11 items-center rounded-xl px-3 py-1.5 text-xs font-medium text-ink-soft ring-1 ring-inset ring-line transition-colors hover:bg-paper disabled:opacity-50 sm:min-h-0"
        >
          {busy ? "Matching…" : "Re-run matching"}
        </button>
      )}
      {canFail && (
        <button
          type="button"
          disabled={disabled}
          onClick={() => run("fail")}
          className="inline-flex min-h-11 items-center rounded-xl px-3 py-1.5 text-xs font-medium text-ember ring-1 ring-inset ring-ember/30 transition-colors hover:bg-ember-soft disabled:opacity-50 sm:min-h-0"
        >
          {confirming ? "Confirm mark failed" : "Mark failed"}
        </button>
      )}
    </div>
  );
}

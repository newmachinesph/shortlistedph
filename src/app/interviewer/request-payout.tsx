"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { api } from "@/lib/auth-client";

/**
 * Asks to be paid for every reported interview no payout has claimed. The
 * amount is deliberately not sent — the server recomputes it from the rows, so
 * what is shown here is a display of the balance, never the basis of the money.
 */
export function RequestPayout({ disabled }: { disabled: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function request() {
    setError(null);
    setBusy(true);
    try {
      await api("/api/interviewer/payout", { method: "POST" });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not request a payout");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={request}
        disabled={busy || disabled}
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-brand px-5 text-sm font-medium text-white transition-colors hover:bg-brand-dark disabled:opacity-60"
      >
        {busy && <Loader2 className="h-4 w-4 animate-spin" />}
        {busy ? "Requesting…" : "Request a payout"}
      </button>
      {error && <p className="mt-2 text-sm text-ember">{error}</p>}
    </>
  );
}

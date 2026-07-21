"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { api } from "@/lib/auth-client";

/**
 * Confirms a consented interview by spending one interview credit. No PayPal
 * hop — the money moved when the credit was bought — so this just calls the
 * confirm route and refreshes. The page only renders this when the employer has
 * at least one credit; a 402 slipping through (balance spent in another tab)
 * still surfaces as a clear message.
 */
export function InterviewConfirmButton({ interviewId }: { interviewId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleConfirm() {
    setError(null);
    setIsBusy(true);
    try {
      await api(`/api/interviews/${interviewId}/confirm`, { method: "POST" });
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not confirm the interview");
    } finally {
      setIsBusy(false);
    }
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={handleConfirm}
        disabled={isBusy || pending}
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-dark disabled:opacity-60"
      >
        {isBusy || pending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.75} /> Confirming…
          </>
        ) : (
          "Confirm (spends 1 interview credit)"
        )}
      </button>
      {error && <span className="text-xs text-ember">{error}</span>}
    </span>
  );
}

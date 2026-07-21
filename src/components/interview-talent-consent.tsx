"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, X } from "lucide-react";
import { api } from "@/lib/auth-client";

/**
 * The candidate's consent action. The full recording-consent wording lives in
 * the page card above these buttons so it is unmissable; the button labels
 * restate what agreeing means one more time.
 */
export function InterviewConsent({ interviewId }: { interviewId: string }) {
  const router = useRouter();
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function decide(action: "consent" | "decline") {
    setError(null);
    setIsBusy(true);
    try {
      await api(`/api/talent/interviews/${interviewId}`, {
        method: "POST",
        body: JSON.stringify({ action }),
      });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save your decision");
      setIsBusy(false);
    }
  }

  return (
    <div className="mt-5">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => decide("consent")}
          disabled={isBusy}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-brand px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-brand-dark disabled:opacity-60 sm:w-auto sm:py-2.5"
        >
          {isBusy ? <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.75} /> : <Check className="h-4 w-4" strokeWidth={1.75} />}
          I agree — interview and record me
        </button>
        <button
          type="button"
          onClick={() => decide("decline")}
          disabled={isBusy}
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl px-5 py-3 text-sm font-medium text-ink-soft ring-1 ring-inset ring-line transition-colors hover:bg-paper disabled:opacity-60 sm:w-auto sm:py-2.5"
        >
          <X className="h-4 w-4" strokeWidth={1.75} /> Decline
        </button>
        <p className="w-full text-xs text-ink-faint sm:w-auto">
          Declining costs you nothing and no payment is ever taken.
        </p>
      </div>
      {error && <p className="mt-2 text-sm text-ember">{error}</p>}
    </div>
  );
}

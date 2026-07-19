"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, X } from "lucide-react";
import { api } from "@/lib/auth-client";

export function ConnectionDecision({ connectionId }: { connectionId: string }) {
  const router = useRouter();
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function decide(decision: "consent" | "decline") {
    setError(null);
    setIsBusy(true);
    try {
      await api(`/api/connections/${connectionId}`, {
        method: "PATCH",
        body: JSON.stringify({ decision }),
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
          className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-dark disabled:opacity-60"
        >
          {isBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
          Accept — share my contact details
        </button>
        <button
          type="button"
          onClick={() => decide("decline")}
          disabled={isBusy}
          className="inline-flex items-center gap-1.5 rounded-xl px-5 py-2.5 text-sm font-medium text-ink-soft ring-1 ring-inset ring-line transition-colors hover:bg-paper disabled:opacity-60"
        >
          <X className="h-4 w-4" /> Decline
        </button>
        <p className="w-full text-xs text-ink-faint sm:w-auto">
          Declining is invisible to future matching.
        </p>
      </div>
      {error && <p className="mt-2 text-sm text-ember">{error}</p>}
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, PenLine } from "lucide-react";
import { api } from "@/lib/auth-client";

/** Shared busy/error/refresh plumbing for the two agreement actions. */
function useAgreementAction(fallbackError: string) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(path: string, init?: RequestInit) {
    setError(null);
    setIsBusy(true);
    try {
      await api(path, init);
      startTransition(() => router.refresh());
    } catch (err) {
      setError(err instanceof Error ? err.message : fallbackError);
    } finally {
      setIsBusy(false);
    }
  }

  return { run, isBusy: isBusy || pending, error };
}

export function SignAgreementButton({ agreementId }: { agreementId: string }) {
  const { run, isBusy, error } = useAgreementAction("Could not sign the agreement");

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={() => run(`/api/agreements/${agreementId}/sign`, { method: "POST" })}
        disabled={isBusy}
        className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-brand px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-dark disabled:opacity-60"
      >
        {isBusy ? (
          <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.75} />
        ) : (
          <PenLine className="h-4 w-4" strokeWidth={1.75} />
        )}
        Sign agreement
      </button>
      {error && <span className="text-xs text-ember">{error}</span>}
    </span>
  );
}

export function ConfirmOutcomeButton({
  agreementId,
  period,
  label,
}: {
  agreementId: string;
  period: string;
  label: string;
}) {
  const { run, isBusy, error } = useAgreementAction("Could not confirm the outcome");

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={() =>
          run(`/api/agreements/${agreementId}/confirm-outcome`, {
            method: "POST",
            body: JSON.stringify({ period }),
          })
        }
        disabled={isBusy}
        className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-brand px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-dark disabled:opacity-60"
      >
        {isBusy ? (
          <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.75} />
        ) : (
          <Check className="h-4 w-4" strokeWidth={1.75} />
        )}
        Confirm {label} — delivered &amp; paid
      </button>
      {error && <span className="text-xs text-ember">{error}</span>}
    </span>
  );
}

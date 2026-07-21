"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { api } from "@/lib/auth-client";

/** Cancels an unpaid interview. The route refuses once it is paid or later. */
export function InterviewCancelButton({ interviewId }: { interviewId: string }) {
  const router = useRouter();
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCancel() {
    setError(null);
    setIsBusy(true);
    try {
      await api(`/api/interviews/${interviewId}`, {
        method: "PATCH",
        body: JSON.stringify({ action: "cancel" }),
      });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not cancel");
      setIsBusy(false);
    }
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={handleCancel}
        disabled={isBusy}
        className="inline-flex min-h-11 items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-ink-soft ring-1 ring-inset ring-line transition-colors hover:bg-paper disabled:opacity-60"
      >
        {isBusy && <Loader2 className="h-4 w-4 animate-spin" />}
        {isBusy ? "Cancelling…" : "Cancel request"}
      </button>
      {error && <span className="text-xs text-ember">{error}</span>}
    </span>
  );
}

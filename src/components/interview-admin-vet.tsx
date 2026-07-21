"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { api } from "@/lib/auth-client";

type Action = "approve" | "reject" | "pause" | "activate";

function useVet(interviewerId: string) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function run(action: Action) {
    setError(null);
    setBusy(true);
    try {
      await api(`/api/admin/interviewers/${interviewerId}`, {
        method: "PATCH",
        body: JSON.stringify({ action }),
      });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update interviewer");
      setBusy(false);
    }
  }

  return { busy, error, run };
}

/** Approve (activates + flips role to interviewer) or reject a pending application. */
export function InterviewerVet({ interviewerId }: { interviewerId: string }) {
  const { busy, error, run } = useVet(interviewerId);
  return (
    <div className="w-full sm:w-auto">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => run("approve")}
          disabled={busy}
          className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-brand px-4 py-1.5 text-xs font-medium text-white transition-colors hover:bg-brand-dark disabled:opacity-50 sm:min-h-0 sm:flex-none"
        >
          {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.75} />}
          Approve
        </button>
        <button
          type="button"
          onClick={() => run("reject")}
          disabled={busy}
          className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl px-4 py-1.5 text-xs font-medium text-ember ring-1 ring-inset ring-line transition-colors hover:bg-ember-soft disabled:opacity-50 sm:min-h-0 sm:flex-none"
        >
          Reject
        </button>
      </div>
      {error && <p className="mt-1.5 text-xs text-ember">{error}</p>}
    </div>
  );
}

/** Pause an active interviewer, or reactivate a paused one. */
export function InterviewerToggle({ interviewerId, status }: { interviewerId: string; status: string }) {
  const { busy, error, run } = useVet(interviewerId);
  const paused = status === "paused";
  return (
    <div>
      <button
        type="button"
        onClick={() => run(paused ? "activate" : "pause")}
        disabled={busy}
        className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl px-4 py-1.5 text-xs font-medium text-ink-soft ring-1 ring-inset ring-line transition-colors hover:bg-paper disabled:opacity-50 sm:min-h-0"
      >
        {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.75} />}
        {paused ? "Reactivate" : "Pause"}
      </button>
      {error && <p className="mt-1.5 text-xs text-ember">{error}</p>}
    </div>
  );
}

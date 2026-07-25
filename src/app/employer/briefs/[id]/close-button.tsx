"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { api } from "@/lib/auth-client";

/** Closing is terminal and stops the public openings board — confirm it. */
export function CloseRoleButton({ jdId }: { jdId: string }) {
  const router = useRouter();
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClose() {
    if (!window.confirm("Close this role? Matching stops and it can't be reopened.")) return;
    setError(null);
    setIsBusy(true);
    try {
      await api(`/api/jds/${jdId}`, { method: "DELETE" });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not close this role");
      setIsBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1.5">
      <button
        type="button"
        onClick={handleClose}
        disabled={isBusy}
        className="inline-flex min-h-11 items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium text-ink-soft ring-1 ring-inset ring-line transition-colors hover:bg-paper hover:text-ink disabled:opacity-60"
      >
        {isBusy && <Loader2 className="h-4 w-4 animate-spin" />}
        {isBusy ? "Closing…" : "Close this role"}
      </button>
      {error && <p className="text-xs text-ember">{error}</p>}
    </div>
  );
}

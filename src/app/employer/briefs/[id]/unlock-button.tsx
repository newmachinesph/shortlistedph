"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { api } from "@/lib/auth-client";

export function UnlockButton({ slateId }: { slateId: string }) {
  const router = useRouter();
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleUnlock() {
    setError(null);
    setIsBusy(true);
    try {
      await api(`/api/slates/${slateId}/unlock`, { method: "POST" });
      router.refresh();
    } catch (err) {
      // 402 with no credits lands here — P3 will send them to checkout instead.
      setError(err instanceof Error ? err.message : "Could not unlock");
      setIsBusy(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1.5">
      <button
        type="button"
        onClick={handleUnlock}
        disabled={isBusy}
        className="inline-flex items-center gap-2 rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-brand transition-colors hover:bg-brand-soft disabled:opacity-70"
      >
        {isBusy && <Loader2 className="h-4 w-4 animate-spin" />}
        {isBusy ? "Unlocking…" : "Unlock shortlist — $49"}
      </button>
      {error && <p className="text-xs text-white/90">{error}</p>}
    </div>
  );
}

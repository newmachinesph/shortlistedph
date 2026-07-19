"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { api } from "@/lib/auth-client";

export function UnlockButton({ slateId, credits }: { slateId: string; credits: number }) {
  const router = useRouter();
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // No credits means the next step is checkout, not a failed request.
  if (credits < 1) {
    return (
      <Link
        href="/employer/billing"
        className="rounded-xl bg-white px-5 py-2.5 text-sm font-semibold text-brand transition-colors hover:bg-brand-soft"
      >
        Unlock shortlist — $49
      </Link>
    );
  }

  async function handleUnlock() {
    setError(null);
    setIsBusy(true);
    try {
      await api(`/api/slates/${slateId}/unlock`, { method: "POST" });
      router.refresh();
    } catch (err) {
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
        {isBusy ? "Unlocking…" : `Use 1 credit to unlock (${credits} left)`}
      </button>
      {error && <p className="text-xs text-white/90">{error}</p>}
    </div>
  );
}

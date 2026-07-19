"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCheck, Loader2 } from "lucide-react";
import { api } from "@/lib/auth-client";

export function MarkAllRead({ unread, icon = false }: { unread: number; icon?: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setError(null);
    setBusy(true);
    try {
      await api("/api/notifications/read", { method: "POST", body: JSON.stringify({ all: true }) });
      router.refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not mark these read");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={busy || unread === 0}
        className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium text-brand ring-1 ring-inset ring-brand/30 transition-colors hover:bg-brand-soft disabled:opacity-50 disabled:hover:bg-transparent"
      >
        {busy ? (
          <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.75} />
        ) : (
          icon && <CheckCheck className="h-4 w-4" strokeWidth={1.75} />
        )}
        Mark all read
      </button>
      {error && <span className="text-xs text-ember">{error}</span>}
    </span>
  );
}

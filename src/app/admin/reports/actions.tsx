"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

export function ReportActions({ reportId }: { reportId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [resolution, setResolution] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function decide(status: "resolved" | "dismissed") {
    if (!resolution.trim()) {
      setError("Write a resolution note first — it is the record of why.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/reports/${reportId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status, resolution: resolution.trim() }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(body?.error ?? "Update failed");
        return;
      }
      startTransition(() => router.refresh());
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  const disabled = busy || pending;

  return (
    <div className="mt-4 border-t border-line pt-4">
      <textarea
        value={resolution}
        onChange={(e) => setResolution(e.target.value)}
        rows={2}
        placeholder="Resolution note — what you decided and why."
        className="w-full rounded-xl border border-line bg-paper px-3 py-2 text-sm text-ink placeholder:text-ink-faint focus:border-brand focus:outline-none"
      />
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={disabled}
          onClick={() => decide("resolved")}
          className="rounded-xl bg-ember px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90 disabled:opacity-50"
        >
          Resolve
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => decide("dismissed")}
          className="rounded-xl px-4 py-2 text-sm font-medium text-ink-soft ring-1 ring-inset ring-line transition-colors hover:bg-paper disabled:opacity-50"
        >
          Dismiss
        </button>
        {error && <span className="text-xs text-ember">{error}</span>}
        <span className="ml-auto self-center text-xs text-ink-faint">
          Records preserved for lawful requests
        </span>
      </div>
    </div>
  );
}

"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type Status = "active" | "suspended" | "banned";

const NEXT: Record<string, { status: Status; label: string; danger?: boolean }[]> = {
  active: [
    { status: "suspended", label: "Suspend" },
    { status: "banned", label: "Ban", danger: true },
  ],
  suspended: [
    { status: "active", label: "Reactivate" },
    { status: "banned", label: "Ban", danger: true },
  ],
  banned: [{ status: "active", label: "Reactivate" }],
};

export function UserStatusActions({ userId, status }: { userId: string; status: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function set(next: Status) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
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

  const options = NEXT[status] ?? NEXT.active;

  return (
    <div className="flex items-center gap-2">
      {error && <span className="text-[11px] text-ember">{error}</span>}
      {options.map((o) => (
        <button
          key={o.status}
          type="button"
          disabled={busy || pending}
          onClick={() => set(o.status)}
          className={`rounded-xl px-3 py-1.5 text-xs font-medium ring-1 ring-inset transition-colors disabled:opacity-50 ${
            o.danger
              ? "text-ember ring-ember/30 hover:bg-ember-soft"
              : "text-ink-soft ring-line hover:bg-paper"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

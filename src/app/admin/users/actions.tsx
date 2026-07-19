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

const CONSEQUENCE =
  "ends their sessions, unpublishes any talent profile, and notifies anyone mid-conversation with them";

export function UserStatusActions({
  userId,
  status,
  published,
}: {
  userId: string;
  status: string;
  published?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [confirming, setConfirming] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function send(body: Record<string, unknown>, key: string, needsConfirm: boolean) {
    if (needsConfirm && confirming !== key) {
      setConfirming(key);
      setError(null);
      setNote(null);
      return;
    }
    setBusy(true);
    setError(null);
    setNote(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const payload = (await res.json().catch(() => null)) as
        | { error?: string; note?: string }
        | null;
      if (!res.ok) {
        setError(payload?.error ?? "Update failed");
        return;
      }
      if (payload?.note) setNote(payload.note);
      startTransition(() => router.refresh());
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
      setConfirming(null);
    }
  }

  const disabled = busy || pending;
  const options = NEXT[status] ?? NEXT.active;

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {error && <span className="text-[11px] text-ember">{error}</span>}
      {note && <span className="text-[11px] text-ink-faint">{note}</span>}
      {confirming && (
        <span className="text-[11px] text-ember">
          This {CONSEQUENCE}. Click again to confirm.
        </span>
      )}

      {published && (
        <button
          type="button"
          disabled={disabled}
          onClick={() => send({ unpublish: true }, "unpublish", true)}
          className="rounded-xl px-3 py-1.5 text-xs font-medium text-ink-soft ring-1 ring-inset ring-line transition-colors hover:bg-paper disabled:opacity-50"
        >
          {confirming === "unpublish" ? "Confirm unpublish" : "Unpublish"}
        </button>
      )}

      {options.map((o) => (
        <button
          key={o.status}
          type="button"
          disabled={disabled}
          onClick={() => send({ status: o.status }, o.status, o.status !== "active")}
          className={`rounded-xl px-3 py-1.5 text-xs font-medium ring-1 ring-inset transition-colors disabled:opacity-50 ${
            o.danger
              ? "text-ember ring-ember/30 hover:bg-ember-soft"
              : "text-ink-soft ring-line hover:bg-paper"
          }`}
        >
          {confirming === o.status ? `Confirm ${o.label.toLowerCase()}` : o.label}
        </button>
      ))}
    </div>
  );
}

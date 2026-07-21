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
    <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2 sm:justify-end">
      {error && <span className="w-full text-xs text-ember sm:w-auto sm:text-[11px]">{error}</span>}
      {note && <span className="w-full text-xs text-ink-faint sm:w-auto sm:text-[11px]">{note}</span>}
      {confirming && (
        <span className="w-full text-xs leading-relaxed text-ember sm:w-auto sm:text-[11px]">
          This {CONSEQUENCE}. Click again to confirm.
        </span>
      )}

      {published && (
        <button
          type="button"
          disabled={disabled}
          onClick={() => send({ unpublish: true }, "unpublish", true)}
          className="inline-flex min-h-11 items-center rounded-xl px-3 py-1.5 text-xs font-medium text-ink-soft ring-1 ring-inset ring-line transition-colors hover:bg-paper disabled:opacity-50 sm:min-h-0"
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
          className={`inline-flex min-h-11 items-center rounded-xl px-3 py-1.5 text-xs font-medium ring-1 ring-inset transition-colors disabled:opacity-50 sm:min-h-0 ${
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

/** Grant, deduct, or set an employer's shortlist OR interview credits. */
export function EmployerCredits({
  userId,
  credits,
  interviewCredits,
}: {
  userId: string;
  credits: number;
  interviewCredits: number;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [kind, setKind] = useState<"shortlist" | "interview">("shortlist");
  const [amount, setAmount] = useState("");
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function send(payload: { set?: number; delta?: number }) {
    if (!reason.trim()) {
      setError("Add a reason");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ credits: { ...payload, kind, reason: reason.trim() } }),
      });
      const body = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        setError(body?.error ?? "Failed");
        return;
      }
      setAmount("");
      setReason("");
      startTransition(() => router.refresh());
    } catch {
      setError("Network error");
    } finally {
      setBusy(false);
    }
  }

  const n = Number(amount);
  const valid = Number.isInteger(n) && n !== 0;
  const disabled = busy || pending || !valid;

  return (
    <div className="mt-2 flex w-full flex-wrap items-center gap-2 border-t border-line pt-2">
      <span className="text-xs text-ink-faint">
        Shortlist: <span className="font-medium text-ink">{credits}</span>
      </span>
      <span className="text-xs text-ink-faint">
        Interview: <span className="font-medium text-ink">{interviewCredits}</span>
      </span>
      <select
        value={kind}
        onChange={(e) => setKind(e.target.value as "shortlist" | "interview")}
        className="rounded-lg border border-line bg-paper px-2 py-1.5 text-base sm:text-xs"
        aria-label="Which credit balance"
      >
        <option value="shortlist">Shortlist</option>
        <option value="interview">Interview</option>
      </select>
      <input
        type="number"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="Amount"
        className="w-20 rounded-lg border border-line bg-paper px-2 py-1.5 text-base sm:text-xs"
      />
      <input
        type="text"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Reason (required)"
        className="min-w-0 flex-1 rounded-lg border border-line bg-paper px-2 py-1.5 text-base sm:text-xs"
      />
      <button
        type="button"
        disabled={disabled}
        onClick={() => send({ delta: n })}
        className="inline-flex min-h-11 items-center rounded-xl px-3 py-1.5 text-xs font-medium text-brand ring-1 ring-inset ring-brand/30 transition-colors hover:bg-brand-soft disabled:opacity-50 sm:min-h-0"
      >
        Add / deduct
      </button>
      <button
        type="button"
        disabled={busy || pending || !Number.isInteger(n) || n < 0}
        onClick={() => send({ set: n })}
        className="inline-flex min-h-11 items-center rounded-xl px-3 py-1.5 text-xs font-medium text-ink-soft ring-1 ring-inset ring-line transition-colors hover:bg-paper disabled:opacity-50 sm:min-h-0"
      >
        Set to
      </button>
      {error && <span className="w-full text-[11px] text-ember">{error}</span>}
    </div>
  );
}

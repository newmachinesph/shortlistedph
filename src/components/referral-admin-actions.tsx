"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { api } from "@/lib/auth-client";

/** Settle one pending payout: transfer reference required to mark it paid. */
export function ReferralSettle({ payoutId }: { payoutId: string }) {
  const router = useRouter();
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function settle(status: "paid" | "rejected") {
    setError(null);
    setBusy(true);
    try {
      await api(`/api/admin/affiliates/${payoutId}`, {
        method: "PATCH",
        body: JSON.stringify({
          status,
          reference: reference.trim() || undefined,
          note: note.trim() || undefined,
        }),
      });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not settle that payout");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="w-full">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={reference}
          onChange={(e) => setReference(e.target.value)}
          placeholder="Transfer reference"
          className="min-h-11 w-full min-w-0 flex-1 rounded-xl border border-line bg-white px-3 py-1.5 text-base text-ink outline-none placeholder:text-ink-faint focus:border-brand sm:min-h-0 sm:w-auto sm:min-w-40 sm:text-xs"
        />
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="Note (optional)"
          className="min-h-11 w-full min-w-0 flex-1 rounded-xl border border-line bg-white px-3 py-1.5 text-base text-ink outline-none placeholder:text-ink-faint focus:border-brand sm:min-h-0 sm:w-auto sm:min-w-40 sm:text-xs"
        />
        <button
          type="button"
          onClick={() => settle("paid")}
          disabled={busy || reference.trim().length === 0}
          className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-brand px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-brand-dark disabled:opacity-50 sm:min-h-0 sm:flex-none"
        >
          {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.75} />}
          Mark paid
        </button>
        <button
          type="button"
          onClick={() => settle("rejected")}
          disabled={busy}
          className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl px-3 py-1.5 text-xs font-medium text-ember ring-1 ring-inset ring-line transition-colors hover:bg-ember-soft disabled:opacity-50 sm:min-h-0 sm:flex-none"
        >
          Reject
        </button>
      </div>
      {error && <p className="mt-1.5 text-xs text-ember">{error}</p>}
    </div>
  );
}

/** Kills a flagged conversion. Two clicks, because it reverses an earning. */
export function ReferralVoid({ conversionId }: { conversionId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function voidIt() {
    setError(null);
    setBusy(true);
    try {
      await api(`/api/admin/affiliates/conversions/${conversionId}`, {
        method: "PATCH",
        body: JSON.stringify({ status: "void" }),
      });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not void that conversion");
      setBusy(false);
      setConfirming(false);
    }
  }

  if (error) return <span className="text-xs text-ember">{error}</span>;

  return confirming ? (
    <span className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        onClick={voidIt}
        disabled={busy}
        className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-ember-soft px-3 py-1.5 text-xs font-medium text-ember transition-opacity disabled:opacity-50 sm:min-h-0"
      >
        {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.75} />}
        Confirm void
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        className="inline-flex min-h-11 items-center px-2 text-xs text-ink-faint transition-colors hover:text-ink-soft sm:min-h-0 sm:px-0"
      >
        Cancel
      </button>
    </span>
  ) : (
    <button
      type="button"
      onClick={() => setConfirming(true)}
      className="inline-flex min-h-11 items-center rounded-xl px-3 py-1.5 text-xs font-medium text-ink-soft ring-1 ring-inset ring-line transition-colors hover:bg-paper sm:min-h-0"
    >
      Void
    </button>
  );
}

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { api } from "@/lib/auth-client";

/** Create a payout covering an interviewer's unpaid reported interviews. */
export function PayoutCreate({ interviewerId }: { interviewerId: string }) {
  const router = useRouter();
  const [method, setMethod] = useState<"gcash" | "bank">("gcash");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    setError(null);
    setBusy(true);
    try {
      await api(`/api/admin/interviews/payouts`, {
        method: "POST",
        body: JSON.stringify({ interviewerId, method }),
      });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create that payout");
      setBusy(false);
    }
  }

  return (
    <div className="w-full sm:w-auto">
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={method}
          onChange={(e) => setMethod(e.target.value as "gcash" | "bank")}
          className="min-h-11 rounded-xl border border-line bg-white px-3 py-1.5 text-base text-ink outline-none focus:border-brand sm:min-h-0 sm:text-xs"
        >
          <option value="gcash">GCash</option>
          <option value="bank">Bank</option>
        </select>
        <button
          type="button"
          onClick={create}
          disabled={busy}
          className="inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-brand px-4 py-1.5 text-xs font-medium text-white transition-colors hover:bg-brand-dark disabled:opacity-50 sm:min-h-0 sm:flex-none"
        >
          {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={1.75} />}
          Create payout
        </button>
      </div>
      {error && <p className="mt-1.5 text-xs text-ember">{error}</p>}
    </div>
  );
}

/** Settle one pending payout: transfer reference required to mark it paid. */
export function PayoutSettle({ payoutId }: { payoutId: string }) {
  const router = useRouter();
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function settle(status: "paid" | "rejected") {
    setError(null);
    setBusy(true);
    try {
      await api(`/api/admin/interviews/payouts/${payoutId}`, {
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
          placeholder="PHP transfer reference"
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

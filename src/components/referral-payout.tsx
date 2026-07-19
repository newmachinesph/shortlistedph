"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { api } from "@/lib/auth-client";

type Props = {
  method: string | null;
  accountName: string | null;
  /** Already masked server-side — the full number never reaches the browser. */
  accountMasked: string | null;
  /** Pre-formatted owed balance, one line per currency. Empty means nothing owed. */
  owed: { currency: string; formatted: string }[];
  hasPendingRequest: boolean;
};

export function ReferralPayout({
  method,
  accountName,
  accountMasked,
  owed,
  hasPendingRequest,
}: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(!method);
  const [draftMethod, setDraftMethod] = useState(method ?? "gcash");
  const [draftName, setDraftName] = useState(accountName ?? "");
  const [draftNumber, setDraftNumber] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function saveDetails() {
    setError(null);
    setBusy(true);
    try {
      await api("/api/referral/payout", {
        method: "PATCH",
        body: JSON.stringify({
          method: draftMethod,
          accountName: draftName,
          accountNumber: draftNumber,
        }),
      });
      setDraftNumber("");
      setEditing(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save those details");
    } finally {
      setBusy(false);
    }
  }

  async function request() {
    setError(null);
    setBusy(true);
    try {
      await api("/api/referral/payout", { method: "POST" });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not request a payout");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <p className="text-sm font-medium uppercase tracking-wider text-ink-faint">Payout details</p>
        {editing ? (
          <div className="mt-3 space-y-3">
            <div className="flex flex-wrap gap-2">
              {(["gcash", "bank"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setDraftMethod(m)}
                  className={`rounded-xl px-4 py-2 text-sm font-medium transition-colors ${
                    draftMethod === m
                      ? "bg-brand-soft text-brand ring-1 ring-inset ring-brand"
                      : "text-ink-soft ring-1 ring-inset ring-line hover:bg-paper"
                  }`}
                >
                  {m === "gcash" ? "GCash" : "Bank transfer"}
                </button>
              ))}
            </div>
            <input
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              placeholder="Account name"
              className="w-full rounded-xl border border-line bg-white px-3 py-2 text-sm text-ink outline-none placeholder:text-ink-faint focus:border-brand"
            />
            <input
              value={draftNumber}
              onChange={(e) => setDraftNumber(e.target.value)}
              placeholder={draftMethod === "gcash" ? "GCash number" : "Account number"}
              autoComplete="off"
              className="w-full rounded-xl border border-line bg-white px-3 py-2 text-sm text-ink outline-none placeholder:text-ink-faint focus:border-brand"
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={saveDetails}
                disabled={busy || draftName.trim().length < 2 || draftNumber.trim().length < 4}
                className="inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-dark disabled:opacity-50"
              >
                {busy && <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.75} />}
                Save details
              </button>
              {method && (
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="rounded-xl px-4 py-2 text-sm text-ink-soft ring-1 ring-inset ring-line transition-colors hover:bg-paper"
                >
                  Cancel
                </button>
              )}
            </div>
            <p className="text-xs text-ink-faint">
              Only the last four digits are ever shown back to you or to us on screen.
            </p>
          </div>
        ) : (
          <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl bg-paper px-4 py-3">
            <span className="text-sm text-ink">
              {method === "gcash" ? "GCash" : "Bank transfer"} · {accountName} · {accountMasked}
            </span>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="ml-auto rounded-xl px-3 py-1.5 text-xs font-medium text-ink-soft ring-1 ring-inset ring-line transition-colors hover:bg-white"
            >
              Change
            </button>
          </div>
        )}
      </div>

      <div>
        <p className="text-sm font-medium uppercase tracking-wider text-ink-faint">Request payout</p>
        {hasPendingRequest ? (
          <p className="mt-2 text-sm text-ink-soft">
            A payout request is already waiting to be settled. You can request the next one once
            this has been transferred.
          </p>
        ) : owed.length === 0 ? (
          <p className="mt-2 text-sm text-ink-soft">
            Nothing is owed yet. A company you referred has to buy their first shortlist.
          </p>
        ) : (
          <>
            <p className="mt-2 text-sm text-ink-soft">
              {owed.map((o) => o.formatted).join(" + ")} owed. Requesting records the amount in the
              currency it was earned in; the peso figure is worked out by hand at the rate on the
              day it is transferred, so it will not match exactly.
            </p>
            <button
              type="button"
              onClick={request}
              disabled={busy || !method}
              className="mt-3 inline-flex items-center gap-2 rounded-xl bg-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-dark disabled:opacity-50"
            >
              {busy && <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.75} />}
              Request payout
            </button>
            {!method && (
              <p className="mt-2 text-xs text-ink-faint">
                Add your payout details above first.
              </p>
            )}
          </>
        )}
        {error && <p className="mt-2 text-xs text-ember">{error}</p>}
      </div>
    </div>
  );
}

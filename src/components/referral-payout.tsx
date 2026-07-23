"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { api } from "@/lib/auth-client";

type Props = {
  method: string | null;
  /** PayPal email on file. */
  payoutEmail: string | null;
  /** Pre-formatted owed balance, one line per currency. Empty means nothing owed. */
  owed: { currency: string; formatted: string }[];
  hasPendingRequest: boolean;
};

/** Looks-like-an-email gate for the save button; the server validates properly. */
const EMAIL_RE = /^\S+@\S+\.\S+$/;

export function ReferralPayout({ method, payoutEmail, owed, hasPendingRequest }: Props) {
  const router = useRouter();
  const [editing, setEditing] = useState(!method);
  const [draftEmail, setDraftEmail] = useState(payoutEmail ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function saveDetails() {
    setError(null);
    setBusy(true);
    try {
      await api("/api/referral/payout", {
        method: "PATCH",
        body: JSON.stringify({ method: "paypal", email: draftEmail.trim() }),
      });
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
            <input
              type="email"
              value={draftEmail}
              onChange={(e) => setDraftEmail(e.target.value)}
              placeholder="PayPal email"
              autoComplete="email"
              className="min-h-11 w-full rounded-xl border border-line bg-white px-3 py-2 text-base text-ink outline-none placeholder:text-ink-faint focus:border-brand sm:min-h-0 sm:text-sm"
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={saveDetails}
                disabled={busy || !EMAIL_RE.test(draftEmail.trim())}
                className="inline-flex min-h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-dark disabled:opacity-50 sm:min-h-0 sm:flex-none"
              >
                {busy && <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.75} />}
                Save details
              </button>
              {method && (
                <button
                  type="button"
                  onClick={() => setEditing(false)}
                  className="inline-flex min-h-11 flex-1 items-center justify-center rounded-xl px-4 py-2 text-sm text-ink-soft ring-1 ring-inset ring-line transition-colors hover:bg-paper sm:min-h-0 sm:flex-none"
                >
                  Cancel
                </button>
              )}
            </div>
            <p className="text-xs text-ink-faint">
              Payouts are sent to this PayPal address, so make sure it can receive money.
            </p>
          </div>
        ) : (
          <div className="mt-3 flex flex-wrap items-center gap-3 rounded-xl bg-paper px-4 py-3">
            <span className="min-w-0 flex-1 break-words text-sm text-ink">
              PayPal · {payoutEmail}
            </span>
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="ml-auto inline-flex min-h-11 shrink-0 items-center rounded-xl bg-white px-3 py-1.5 text-xs font-medium text-ink-soft ring-1 ring-inset ring-line transition-colors hover:bg-white sm:min-h-0 sm:bg-transparent"
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
              currency it was earned in; it is paid to your PayPal by hand, so allow a few days for
              it to arrive.
            </p>
            <button
              type="button"
              onClick={request}
              disabled={busy || !method}
              className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-dark disabled:opacity-50 sm:min-h-0 sm:w-auto"
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

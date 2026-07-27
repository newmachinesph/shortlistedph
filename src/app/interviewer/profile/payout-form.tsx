"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { api } from "@/lib/auth-client";

const INPUT =
  "mt-1.5 w-full rounded-xl border border-line bg-paper px-4 py-3 text-base text-ink sm:text-sm focus:outline-2 focus:outline-brand";

type Option = { value: string; label: string };

/**
 * Where earnings are sent. The account number is write-only from here on: the
 * server never returns it and this form only ever shows the last four, so a
 * shared screen or a cached page cannot leak someone's bank details.
 */
export function PayoutForm({
  methods,
  initial,
}: {
  methods: Option[];
  initial: { method: string | null; accountName: string | null; accountTail: string | null };
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    method: initial.method ?? methods[0]?.value ?? "",
    accountName: initial.accountName ?? "",
    accountNumber: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setForm({ ...form, [k]: e.target.value });
    setSaved(false);
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await api("/api/interviewer/payout", {
        method: "PUT",
        body: JSON.stringify({
          method: form.method,
          accountName: form.accountName.trim(),
          accountNumber: form.accountNumber.trim(),
        }),
      });
      setForm({ ...form, accountNumber: "" });
      setSaved(true);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save your payout details");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 rounded-2xl border border-line bg-white p-5 sm:p-7">
      <h2 className="font-display text-lg font-semibold text-ink">Where you get paid</h2>
      <p className="mt-1 text-sm leading-relaxed text-ink-soft">
        Earnings are recorded in USD and settled to pesos by hand at the rate on the day of the
        transfer. Without these details there is nowhere to send them.
      </p>

      {error && <p className="mt-4 rounded-xl bg-ember-soft px-4 py-3 text-sm text-ember">{error}</p>}

      <label htmlFor="payout-method" className="mt-5 block text-sm font-medium text-ink">
        Method
      </label>
      <select id="payout-method" value={form.method} onChange={set("method")} className={INPUT}>
        {methods.map((m) => (
          <option key={m.value} value={m.value}>
            {m.label}
          </option>
        ))}
      </select>

      <label htmlFor="payout-name" className="mt-4 block text-sm font-medium text-ink">
        Account name
      </label>
      <p className="mt-0.5 text-xs text-ink-faint">Exactly as it appears on the account.</p>
      <input
        id="payout-name"
        required
        value={form.accountName}
        onChange={set("accountName")}
        className={INPUT}
      />

      <label htmlFor="payout-number" className="mt-4 block text-sm font-medium text-ink">
        Account number
      </label>
      <p className="mt-0.5 text-xs text-ink-faint">
        {initial.accountTail
          ? `Currently ending ${initial.accountTail}. Type a new one to replace it.`
          : "GCash number, or your bank account number."}
      </p>
      <input
        id="payout-number"
        required
        inputMode="numeric"
        autoComplete="off"
        value={form.accountNumber}
        onChange={set("accountNumber")}
        className={INPUT}
      />

      <button
        type="submit"
        disabled={busy}
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-brand-dark disabled:opacity-60"
      >
        {busy && <Loader2 className="h-4 w-4 animate-spin" />}
        {saved && !busy ? (
          <>
            <Check className="h-4 w-4" strokeWidth={2} /> Saved
          </>
        ) : busy ? (
          "Saving…"
        ) : (
          "Save payout details"
        )}
      </button>
    </form>
  );
}

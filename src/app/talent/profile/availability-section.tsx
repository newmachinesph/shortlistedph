"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarClock, Check, Loader2 } from "lucide-react";
import { api } from "@/lib/auth-client";

const NOTICE_PRESETS = [
  { label: "Available now", days: 0 },
  { label: "About 1 week", days: 7 },
  { label: "About 2 weeks", days: 14 },
  { label: "About 1 month", days: 30 },
];

const AVAILABILITY_OPTIONS = [
  { value: "open", label: "Open — taking on work" },
  { value: "partial", label: "Partially committed" },
  { value: "booked", label: "Fully booked" },
];

type Props = {
  initial: { openToOffers: boolean; availability: string; noticePeriodDays: number | null };
  // Computed on the server so the freshness copy can't drift between the two
  // renders (Date.now() differs server vs client → hydration mismatch).
  label: string;
  note: string;
  stale: boolean;
};

const fieldCls =
  "min-h-[44px] w-full rounded-xl border border-line bg-white px-3.5 text-base text-ink focus:border-brand focus:outline-none";

export function AvailabilitySection({ initial, label, note, stale }: Props) {
  const router = useRouter();
  const presetMatch = NOTICE_PRESETS.some((o) => o.days === initial.noticePeriodDays);

  const [openToOffers, setOpenToOffers] = useState(initial.openToOffers);
  const [availability, setAvailability] = useState(initial.availability);
  const [notice, setNotice] = useState<string>(
    initial.noticePeriodDays == null ? "" : presetMatch ? String(initial.noticePeriodDays) : "other",
  );
  const [otherDays, setOtherDays] = useState<string>(
    initial.noticePeriodDays != null && !presetMatch ? String(initial.noticePeriodDays) : "",
  );
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    let noticePeriodDays: number;
    if (notice === "") {
      setError("Choose how soon you can start.");
      return;
    }
    if (notice === "other") {
      const n = Number(otherDays);
      if (!Number.isFinite(n) || n < 0 || n > 365) {
        setError("Enter a notice period between 0 and 365 days.");
        return;
      }
      noticePeriodDays = Math.round(n);
    } else {
      noticePeriodDays = Number(notice);
    }

    setStatus("saving");
    try {
      await api("/api/talent/availability", {
        method: "PATCH",
        body: JSON.stringify({ openToOffers, availability, noticePeriodDays }),
      });
      setStatus("saved");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save.");
      setStatus("idle");
    }
  }

  return (
    <section className="mt-5 rounded-2xl border border-line bg-white p-6">
      <div className="flex items-center gap-2">
        <CalendarClock className="h-4 w-4 text-brand" strokeWidth={1.75} />
        <h2 className="text-sm font-medium uppercase tracking-wider text-ink-faint">Availability</h2>
      </div>

      <p className="font-display mt-3 text-lg font-semibold text-ink">{label}</p>
      <p className={`mt-1 text-sm ${stale ? "text-ember" : "text-ink-soft"}`}>{note}</p>
      {stale && (
        <p className="mt-3 rounded-xl bg-ember-soft p-3.5 text-xs leading-relaxed text-ember">
          Employers rank fresh profiles higher and we show them when you last confirmed. Confirm now
          to keep your standing accurate.
        </p>
      )}

      <form onSubmit={handleSubmit} className="mt-5 space-y-4">
        <label className="flex min-h-[44px] items-center gap-3">
          <input
            type="checkbox"
            checked={openToOffers}
            onChange={(e) => setOpenToOffers(e.target.checked)}
            className="h-5 w-5 rounded border-line text-brand focus:ring-brand"
          />
          <span className="text-sm text-ink">I&rsquo;m open to new offers</span>
        </label>

        <div>
          <label htmlFor="availability" className="block text-sm text-ink-soft">
            Current load
          </label>
          <select
            id="availability"
            value={availability}
            onChange={(e) => setAvailability(e.target.value)}
            className={`${fieldCls} mt-1.5`}
          >
            {AVAILABILITY_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="notice" className="block text-sm text-ink-soft">
            How soon you can start
          </label>
          <select
            id="notice"
            value={notice}
            onChange={(e) => setNotice(e.target.value)}
            className={`${fieldCls} mt-1.5`}
          >
            <option value="" disabled>
              Choose…
            </option>
            {NOTICE_PRESETS.map((o) => (
              <option key={o.days} value={String(o.days)}>
                {o.label}
              </option>
            ))}
            <option value="other">Other (days)</option>
          </select>
          {notice === "other" && (
            <input
              type="number"
              inputMode="numeric"
              min={0}
              max={365}
              value={otherDays}
              onChange={(e) => setOtherDays(e.target.value)}
              placeholder="Days until you can start"
              className={`${fieldCls} mt-2`}
            />
          )}
        </div>

        {error && <p className="text-sm text-ember">{error}</p>}

        <button
          type="submit"
          disabled={status === "saving"}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-brand px-5 text-sm font-medium text-white transition-colors hover:bg-brand-dark disabled:opacity-60"
        >
          {status === "saving" && <Loader2 className="h-4 w-4 animate-spin" />}
          {status === "saved" && <Check className="h-4 w-4" />}
          {status === "saving" ? "Saving…" : status === "saved" ? "Confirmed" : "Confirm / update"}
        </button>
      </form>
    </section>
  );
}

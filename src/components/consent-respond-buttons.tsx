"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

/**
 * Accept/decline for a match invitation. Shared by the emailed public consent
 * page and the in-app invitations list, so both answer through exactly one
 * endpoint — a second copy would be a second chance to drift from the rules
 * the API enforces (expiry, idempotency, one-strike dormancy).
 */
export function RespondButtons({ token }: { token: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState<"accept" | "decline" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function respond(action: "accept" | "decline") {
    setBusy(action);
    setError(null);
    try {
      const res = await fetch(`/api/consent/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const payload = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        setError(payload?.error ?? "Something went wrong — try again");
        // An already-responded/expired answer means the page state is stale.
        startTransition(() => router.refresh());
        return;
      }
      startTransition(() => router.refresh());
    } catch {
      setError("Network error — try again");
    } finally {
      setBusy(null);
    }
  }

  const disabled = busy !== null || pending;

  return (
    <div className="mt-5">
      {error && <p className="mb-3 text-sm text-ember">{error}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          disabled={disabled}
          onClick={() => respond("accept")}
          className="inline-flex min-h-11 items-center rounded-xl bg-brand px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-dark disabled:opacity-50"
        >
          {busy === "accept" || pending ? "Confirming…" : "I'm interested"}
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => respond("decline")}
          className="inline-flex min-h-11 items-center rounded-xl px-5 py-2.5 text-sm font-medium text-ink-soft ring-1 ring-inset ring-line transition-colors hover:bg-paper disabled:opacity-50"
        >
          {busy === "decline" ? "Declining…" : "Not this one"}
        </button>
      </div>
    </div>
  );
}

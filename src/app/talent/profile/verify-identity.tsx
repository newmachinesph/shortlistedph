"use client";

import { useState } from "react";
import { BadgeCheck, Loader2, ShieldCheck } from "lucide-react";
import { api } from "@/lib/auth-client";

type Qr = {
  intentId: string;
  qrImageUrl: string | null;
  qrData: string | null;
  amountPhp: string;
};

/**
 * The ₱60 identity-verification purchase. The checkout route returns a QR Ph
 * code to render in-app (no hosted page, no returnUrl) — the webhook flips
 * verifiedTier once the payer's app confirms, so we just show the QR and a
 * pending note.
 */
export function VerifyIdentity({ verified }: { verified: boolean }) {
  const [qr, setQr] = useState<Qr | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (verified) {
    return (
      <li className="flex items-center gap-2.5 text-sm text-ink">
        <BadgeCheck className="h-4 w-4 shrink-0 text-brand" strokeWidth={1.75} />
        <span>Identity verification</span>
        <span className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2.5 py-1 text-xs font-medium text-brand">
          Verified
        </span>
      </li>
    );
  }

  async function startCheckout() {
    setStarting(true);
    setError(null);
    try {
      const data = await api<Qr>("/api/paymongo/checkout", { method: "POST" });
      setQr(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start verification.");
    } finally {
      setStarting(false);
    }
  }

  return (
    <li className="text-sm">
      <div className="flex items-center gap-2.5 text-ink-faint">
        <span className="h-4 w-4 shrink-0 rounded-full border border-line" />
        <span>Identity verification: optional, ₱60 for the check</span>
      </div>

      {qr ? (
        <div className="mt-3 rounded-xl bg-paper p-4">
          {qr.qrImageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element -- external PayMongo QR, not an asset
            <img
              src={qr.qrImageUrl}
              alt="QR Ph code for the ₱60 verification payment"
              className="mx-auto h-44 w-44 rounded-lg bg-white p-2"
            />
          ) : qr.qrData ? (
            <p className="break-all font-mono text-xs text-ink-soft">{qr.qrData}</p>
          ) : (
            <p className="text-xs text-ink-soft">
              We couldn&rsquo;t render the QR code — contact support@shortlisted.ph.
            </p>
          )}
          <p className="mt-3 flex items-start gap-1.5 text-xs leading-relaxed text-ink-faint">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
            <span>
              Scan with GCash, Maya, or your bank app to pay ₱{qr.amountPhp}. Verification pending —
              it confirms automatically once payment clears.
            </span>
          </p>
        </div>
      ) : (
        <button
          type="button"
          onClick={startCheckout}
          disabled={starting}
          className="mt-3 inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-brand px-5 text-sm font-medium text-white transition-colors hover:bg-brand-dark disabled:opacity-60"
        >
          {starting && <Loader2 className="h-4 w-4 animate-spin" />}
          {starting ? "Preparing…" : "Verify my identity — ₱60"}
        </button>
      )}

      {error && <p className="mt-2 text-xs text-ember">{error}</p>}
    </li>
  );
}

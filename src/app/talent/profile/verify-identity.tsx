"use client";

import { useState } from "react";
import { BadgeCheck, Clock3, Loader2, ShieldCheck, XCircle } from "lucide-react";
import { api } from "@/lib/auth-client";

type Qr = {
  intentId: string;
  qrImageUrl: string | null;
  qrData: string | null;
  amountPhp: string;
};

/**
 * The ₱60 identity-verification purchase. The checkout route returns a QR Ph
 * code to render in-app (no hosted page, no returnUrl).
 *
 * Paying queues a REVIEW, it does not verify anyone — this screen used to
 * promise it "confirms automatically once payment clears" while nothing in the
 * codebase could ever confirm it. An admin decides, and a rejection re-opens
 * the checkout so the attempt can be made again.
 */
export function VerifyIdentity({
  status,
  note,
}: {
  status: "none" | "pending" | "verified" | "rejected";
  note: string | null;
}) {
  const [qr, setQr] = useState<Qr | null>(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (status === "verified") {
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

  if (status === "pending" && !qr) {
    return (
      <li className="text-sm">
        <div className="flex items-center gap-2.5 text-ink">
          <Clock3 className="h-4 w-4 shrink-0 text-ember" strokeWidth={1.75} />
          <span>Identity verification</span>
          <span className="inline-flex items-center gap-1 rounded-full bg-ember-soft px-2.5 py-1 text-xs font-medium text-ember">
            Under review
          </span>
        </div>
        <p className="mt-2 text-xs leading-relaxed text-ink-faint">
          Your attempt is queued. A person checks it by hand — we&rsquo;ll notify you either way,
          and nothing else is charged.
        </p>
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

  const rejected = status === "rejected";

  return (
    <li className="text-sm">
      <div className={`flex items-center gap-2.5 ${rejected ? "text-ink" : "text-ink-faint"}`}>
        {rejected ? (
          <XCircle className="h-4 w-4 shrink-0 text-ember" strokeWidth={1.75} />
        ) : (
          <span className="h-4 w-4 shrink-0 rounded-full border border-line" />
        )}
        <span>
          {rejected
            ? "Identity verification: not approved"
            : "Identity verification: optional, ₱60 for the check"}
        </span>
      </div>

      {rejected && (
        <p className="mt-2 rounded-xl bg-ember-soft p-3.5 text-xs leading-relaxed text-ember">
          {note ?? "The reviewer could not confirm your identity from what was submitted."}
        </p>
      )}

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
              Scan with GCash, Maya, or your bank app to pay ₱{qr.amountPhp}. Paying puts your
              attempt in the review queue — it does not verify you. A person checks it and we
              notify you either way.
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
          {starting ? "Preparing…" : rejected ? "Try again — ₱60" : "Verify my identity — ₱60"}
        </button>
      )}

      {error && <p className="mt-2 text-xs text-ember">{error}</p>}
    </li>
  );
}

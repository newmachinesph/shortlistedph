"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { api } from "@/lib/auth-client";

/**
 * Sends the buyer to PayPal. They return to /employer/billing?paid=1, where
 * the capture step runs — and the webhook covers them if they never return.
 */
export function BuyButton({
  productId,
  label,
  variant = "primary",
}: {
  productId: "single" | "three_pack";
  label: string;
  variant?: "primary" | "ghost";
}) {
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleBuy() {
    setError(null);
    setIsBusy(true);
    try {
      const { approveUrl, orderId } = await api<{ approveUrl: string | null; orderId: string }>(
        "/api/paypal/order",
        { method: "POST", body: JSON.stringify({ productId }) },
      );
      if (!approveUrl) throw new Error("PayPal did not return an approval link");
      sessionStorage.setItem("pendingOrder", JSON.stringify({ orderId, productId }));
      window.location.href = approveUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start checkout");
      setIsBusy(false);
    }
  }

  const cls =
    variant === "primary"
      ? "w-full rounded-xl bg-brand px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-dark disabled:opacity-60"
      : "w-full rounded-xl px-4 py-2.5 text-sm font-medium text-brand ring-1 ring-inset ring-brand/30 transition-colors hover:bg-brand-soft disabled:opacity-60";

  return (
    <>
      <button type="button" onClick={handleBuy} disabled={isBusy} className={cls}>
        {isBusy ? (
          <span className="inline-flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" /> Redirecting…
          </span>
        ) : (
          label
        )}
      </button>
      {error && <p className="mt-2 text-xs text-ember">{error}</p>}
    </>
  );
}

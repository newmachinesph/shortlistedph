"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { api } from "@/lib/auth-client";

/**
 * Drives the interview payment through PayPal, mirroring the credit BuyButton:
 * ask the server for an order, stash the id, hand off to PayPal, and let the
 * capture-on-return finish it. priceUsd here is only the button label — the pay
 * route re-locks the real amount from the interview row.
 */
export function InterviewPayButton({
  interviewId,
  priceUsd,
}: {
  interviewId: string;
  priceUsd: number;
}) {
  const [isBusy, setIsBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handlePay() {
    setError(null);
    setIsBusy(true);
    try {
      const { approveUrl, orderId } = await api<{ approveUrl: string | null; orderId: string }>(
        `/api/interviews/${interviewId}/pay`,
        { method: "POST" },
      );
      if (!approveUrl) throw new Error("PayPal did not return an approval link");
      sessionStorage.setItem("pendingInterviewOrder", JSON.stringify({ orderId }));
      window.location.href = approveUrl;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start checkout");
      setIsBusy(false);
    }
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={handlePay}
        disabled={isBusy}
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-dark disabled:opacity-60"
      >
        {isBusy ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" /> Redirecting…
          </>
        ) : (
          `Pay $${priceUsd.toFixed(2)}`
        )}
      </button>
      {error && <span className="text-xs text-ember">{error}</span>}
    </span>
  );
}

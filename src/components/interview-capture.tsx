"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2 } from "lucide-react";
import { api } from "@/lib/auth-client";

/**
 * Finishes an interview payment when PayPal sends the employer back to
 * /employer/interviews?paid=1. Fulfillment is idempotent and the webhook is the
 * safety net, so this exists only to refresh the page while they watch.
 */
export function InterviewCapture({ shouldCapture }: { shouldCapture: boolean }) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "working" | "done" | "error">(
    shouldCapture ? "working" : "idle",
  );
  const [message, setMessage] = useState<string | null>(null);
  const hasRun = useRef(false);

  useEffect(() => {
    if (!shouldCapture || hasRun.current) return;
    hasRun.current = true;

    const pending = sessionStorage.getItem("pendingInterviewOrder");
    if (!pending) {
      // The webhook still settles it; nothing is lost.
      queueMicrotask(() => {
        setState("done");
        setMessage("Payment received. Your interview will be confirmed shortly.");
      });
      return;
    }

    // Only the order id — the server derives the interview from PayPal's record.
    const { orderId } = JSON.parse(pending) as { orderId: string };

    api("/api/paypal/capture", { method: "POST", body: JSON.stringify({ orderId }) })
      .then(() => {
        sessionStorage.removeItem("pendingInterviewOrder");
        setState("done");
        setMessage("Payment complete — the interview is confirmed.");
        router.refresh();
      })
      .catch((err: unknown) => {
        setState("error");
        setMessage(
          err instanceof Error
            ? `${err.message}. If you were charged, the interview will still be confirmed.`
            : "Could not confirm the payment.",
        );
      });
  }, [shouldCapture, router]);

  if (state === "idle") return null;

  return (
    <div
      className={`mb-5 flex items-center gap-2.5 rounded-2xl px-5 py-4 text-sm ${
        state === "error" ? "bg-ember-soft text-ember" : "bg-brand-soft text-brand"
      }`}
    >
      {state === "working" ? (
        <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
      ) : (
        <CheckCircle2 className="h-4 w-4 shrink-0" />
      )}
      <span>{state === "working" ? "Confirming your payment…" : message}</span>
    </div>
  );
}

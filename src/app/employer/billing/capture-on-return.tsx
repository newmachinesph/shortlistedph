"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, Loader2 } from "lucide-react";
import { api } from "@/lib/auth-client";

/**
 * Finishes the purchase when PayPal sends the buyer back.
 *
 * Fulfillment is idempotent, so it does not matter whether this or the webhook
 * lands first — this exists purely so the balance updates while they watch.
 */
export function CaptureOnReturn({ shouldCapture }: { shouldCapture: boolean }) {
  const router = useRouter();
  // Derived from the prop rather than set inside the effect — the effect only
  // touches state from async callbacks.
  const [state, setState] = useState<"idle" | "working" | "done" | "error">(
    shouldCapture ? "working" : "idle",
  );
  const [message, setMessage] = useState<string | null>(null);
  const hasRun = useRef(false);

  useEffect(() => {
    if (!shouldCapture || hasRun.current) return;
    hasRun.current = true;

    const pending = sessionStorage.getItem("pendingOrder");
    if (!pending) {
      // The webhook still credits them; nothing is lost.
      queueMicrotask(() => {
        setState("done");
        setMessage("Payment received. Your credits will appear shortly.");
      });
      return;
    }

    const { orderId, productId } = JSON.parse(pending) as {
      orderId: string;
      productId: "single" | "three_pack";
    };

    api<{ credited: boolean; alreadyProcessed: boolean }>("/api/paypal/capture", {
      method: "POST",
      body: JSON.stringify({ orderId, productId }),
    })
      .then(() => {
        sessionStorage.removeItem("pendingOrder");
        setState("done");
        setMessage("Payment complete — credits added.");
        router.refresh();
      })
      .catch((err: unknown) => {
        setState("error");
        setMessage(
          err instanceof Error
            ? `${err.message}. If you were charged, your credits will still arrive.`
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

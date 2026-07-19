"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { api } from "@/lib/auth-client";

export function RequestConnection({
  slateEntryId,
  alreadyRequested,
  size = "sm",
}: {
  slateEntryId: string;
  alreadyRequested: boolean;
  size?: "sm" | "lg";
}) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "sending" | "sent">(
    alreadyRequested ? "sent" : "idle",
  );
  const [error, setError] = useState<string | null>(null);

  const cls =
    size === "lg"
      ? "rounded-2xl px-6 py-3 text-sm font-semibold"
      : "rounded-xl px-4 py-2 text-sm font-medium";

  if (state === "sent") {
    return (
      <span className={`inline-flex items-center gap-1.5 bg-brand-soft text-brand ${cls}`}>
        <Check className="h-4 w-4" /> Connection requested
      </span>
    );
  }

  async function handleRequest() {
    setError(null);
    setState("sending");
    try {
      await api("/api/connections", {
        method: "POST",
        body: JSON.stringify({ slateEntryId }),
      });
      setState("sent");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send the request");
      setState("idle");
    }
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={handleRequest}
        disabled={state === "sending"}
        className={`inline-flex items-center gap-2 bg-brand text-white transition-colors hover:bg-brand-dark disabled:opacity-60 ${cls}`}
      >
        {state === "sending" && <Loader2 className="h-4 w-4 animate-spin" />}
        {state === "sending" ? "Sending…" : "Request connection"}
      </button>
      {error && <span className="text-xs text-ember">{error}</span>}
    </span>
  );
}

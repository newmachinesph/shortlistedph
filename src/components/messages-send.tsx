"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Send } from "lucide-react";
import { api } from "@/lib/auth-client";

/**
 * Post, then refresh. At one message every few hours a socket would be more
 * moving parts than the problem deserves.
 */
export function MessageSend({
  connectionId,
  placeholder,
  withLabel = false,
}: {
  connectionId: string;
  placeholder: string;
  withLabel?: boolean;
}) {
  const router = useRouter();
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const canSend = body.trim().length > 0 && !busy;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSend) return;
    setError(null);
    setBusy(true);
    try {
      await api("/api/messages", {
        method: "POST",
        body: JSON.stringify({ connectionId, body }),
      });
      setBody("");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not send that message");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="border-t border-line px-6 py-4">
      <div className="flex items-center gap-3">
        <input
          value={body}
          onChange={(e) => setBody(e.target.value)}
          maxLength={4000}
          placeholder={placeholder}
          aria-label="Message"
          className="flex-1 rounded-xl border border-line bg-paper px-4 py-2.5 text-sm text-ink placeholder:text-ink-faint focus:border-brand focus:outline-none"
        />
        {withLabel ? (
          <button
            type="submit"
            disabled={!canSend}
            className="inline-flex items-center gap-1.5 rounded-xl bg-brand px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-dark disabled:opacity-50"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.75} />
            ) : (
              <Send className="h-4 w-4" strokeWidth={1.75} />
            )}
            Send
          </button>
        ) : (
          <button
            type="submit"
            disabled={!canSend}
            aria-label="Send message"
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand text-white transition-colors hover:bg-brand-dark disabled:opacity-50"
          >
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.75} />
            ) : (
              <Send className="h-4 w-4" strokeWidth={1.75} />
            )}
          </button>
        )}
      </div>
      {error && <p className="mt-2 text-xs text-ember">{error}</p>}
    </form>
  );
}

"use client";

import { useEffect } from "react";
import { CircleAlert } from "lucide-react";

/**
 * The one error boundary for the whole app. Every page is an async server
 * component doing several DB reads, so a session hiccup or a dropped
 * connection used to surface as Next's stock error screen.
 *
 * `digest` is the only thing safe to show: the message of a server-thrown
 * error is redacted in production, and echoing a raw client-side one leaks
 * internals for no operator benefit. The digest is what correlates with the
 * server log.
 */
export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app] unhandled render error", error);
  }, [error]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-paper px-5">
      <div className="mx-auto max-w-md text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-ember-soft">
          <CircleAlert className="h-5 w-5 text-ember" strokeWidth={1.75} />
        </span>
        <h1 className="font-display mt-4 text-lg font-semibold text-ink">
          Something broke on our side
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">
          Nothing you did caused this and nothing was charged. Try again — if it keeps happening,
          send us the reference below.
        </p>
        {error.digest && (
          <p className="mt-3 font-mono text-xs text-ink-faint">Reference {error.digest}</p>
        )}
        <button
          type="button"
          onClick={reset}
          className="mt-6 inline-flex min-h-11 items-center rounded-2xl bg-brand px-6 text-sm font-semibold text-white transition-colors hover:bg-brand-dark"
        >
          Try again
        </button>
      </div>
    </div>
  );
}

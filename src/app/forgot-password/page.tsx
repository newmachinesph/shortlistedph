"use client";

import { useState } from "react";
import Link from "next/link";
import { MailCheck } from "lucide-react";
import { Logo } from "@/components/logo";
import { authClient } from "@/lib/auth-client";

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * requestPasswordReset — NOT forgetPassword.
   *
   * better-auth renamed this endpoint, and the client is a Proxy: any property
   * name returns a callable, so a stale name type-checks, compiles, and only
   * fails as a 404 at runtime. The route that exists in 1.6.23 is
   * POST /request-password-reset (see dist/api/routes/password).
   *
   * redirectTo is where the emailed link finally lands. The server sends the
   * user to /reset-password/<token> first, validates, then bounces here with
   * ?token=... (or ?error=INVALID_TOKEN).
   */
  async function submit() {
    const address = email.trim();
    if (!address || busy) return;

    setBusy(true);
    setError(null);
    const { error: err } = await authClient.requestPasswordReset({
      email: address,
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(false);

    // An unregistered address is deliberately NOT an error: the server answers
    // 200 with the same body either way. Anything that lands here is transport
    // or validation, never "no such account" — surfacing it differently would
    // turn this form into an account-existence oracle.
    if (err) {
      setError("We couldn't send that just now. Check the address and try again.");
      return;
    }
    setSent(true);
  }

  return (
    <div className="flex min-h-screen flex-col items-center bg-paper px-5 pt-14">
      <Link href="/">
        <Logo />
      </Link>
      <div className="mt-10 w-full max-w-sm rounded-2xl border border-line bg-white p-6 sm:p-7">
        {!sent ? (
          <>
            <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">
              Reset your password
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">
              Enter your email and we&rsquo;ll send you a reset link.
            </p>
            <label htmlFor="email" className="mt-6 block text-sm font-medium text-ink">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && void submit()}
              placeholder="you@example.com"
              className="mt-1.5 w-full rounded-xl border border-line bg-paper px-4 py-3 text-base text-ink sm:text-sm placeholder:text-ink-faint focus:outline-2 focus:outline-brand"
            />
            {error && (
              <p role="alert" className="mt-2 text-sm text-red-600">
                {error}
              </p>
            )}
            <button
              onClick={() => void submit()}
              disabled={busy || !email.trim()}
              className="mt-5 w-full rounded-xl bg-brand px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50"
            >
              {busy ? "Sending…" : "Send reset link"}
            </button>
          </>
        ) : (
          <div className="text-center">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-soft">
              <MailCheck className="h-5 w-5 text-brand" />
            </span>
            <h1 className="font-display mt-4 text-xl font-semibold text-ink">Check your email</h1>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">
              If an account exists for <span className="font-medium text-ink">{email}</span>,
              a reset link is on its way. It expires in an hour.
            </p>
          </div>
        )}
      </div>
      <p className="mt-6 text-sm text-ink-soft">
        Remembered it?{" "}
        <Link href="/login" className="font-medium text-brand hover:underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}

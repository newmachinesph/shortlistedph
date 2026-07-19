"use client";

import { Suspense, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { CheckCircle2 } from "lucide-react";
import { Logo } from "@/components/logo";
import { authClient } from "@/lib/auth-client";

function ResetPasswordForm() {
  const params = useSearchParams();
  // The emailed link points at /reset-password/<token>, which better-auth
  // validates and then redirects here with ?token=... on success, or
  // ?error=INVALID_TOKEN when it is expired or already spent.
  const token = params.get("token");
  const linkError = params.get("error");

  const [done, setDone] = useState(false);
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const mismatch = confirm.length > 0 && pw !== confirm;
  const canSubmit = pw.length >= 8 && pw === confirm && !busy;

  async function submit() {
    if (!canSubmit || !token) return;

    setBusy(true);
    setError(null);
    const { error: err } = await authClient.resetPassword({
      newPassword: pw,
      token,
    });
    setBusy(false);

    if (err) {
      setError(
        err.message ?? "That reset link is no longer valid. Request a new one.",
      );
      return;
    }
    setDone(true);
  }

  // No usable token: nothing on this page can work, so say so instead of
  // rendering a form that is guaranteed to fail on submit.
  if (!token || linkError) {
    return (
      <>
        <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">
          This link has expired
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">
          Reset links are single-use and expire after an hour. Request a fresh one
          and we&rsquo;ll send it right over.
        </p>
        <Link
          href="/forgot-password"
          className="mt-5 inline-block w-full rounded-xl bg-brand px-4 py-2.5 text-center text-sm font-medium text-white transition-colors hover:bg-brand-dark"
        >
          Send a new link
        </Link>
      </>
    );
  }

  if (done) {
    return (
      <div className="text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-soft">
          <CheckCircle2 className="h-5 w-5 text-brand" />
        </span>
        <h1 className="font-display mt-4 text-xl font-semibold text-ink">Password updated</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">
          You&rsquo;re all set. Sign in with your new password.
        </p>
        <Link
          href="/login"
          className="mt-5 inline-block w-full rounded-xl bg-brand px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-brand-dark"
        >
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <>
      <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">
        Choose a new password
      </h1>
      <label htmlFor="pw" className="mt-6 block text-sm font-medium text-ink">
        New password
      </label>
      <input
        id="pw"
        type="password"
        autoComplete="new-password"
        value={pw}
        onChange={(e) => setPw(e.target.value)}
        className="mt-1.5 w-full rounded-xl border border-line bg-paper px-4 py-3 text-base text-ink sm:text-sm focus:outline-2 focus:outline-brand"
      />
      <p className="mt-1.5 text-xs text-ink-faint">At least 8 characters.</p>
      <label htmlFor="confirm" className="mt-4 block text-sm font-medium text-ink">
        Confirm password
      </label>
      <input
        id="confirm"
        type="password"
        autoComplete="new-password"
        value={confirm}
        onChange={(e) => setConfirm(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && void submit()}
        className={`mt-1.5 w-full rounded-xl border bg-paper px-4 py-3 text-base text-ink sm:text-sm focus:outline-2 focus:outline-brand ${
          mismatch ? "border-red-300" : "border-line"
        }`}
      />
      {mismatch && <p className="mt-1.5 text-xs text-red-600">Passwords don&rsquo;t match.</p>}
      {error && (
        <p role="alert" className="mt-2 text-sm text-red-600">
          {error}
        </p>
      )}
      <button
        onClick={() => void submit()}
        disabled={!canSubmit}
        className="mt-5 w-full rounded-xl bg-brand px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? "Updating…" : "Reset password"}
      </button>
    </>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="flex min-h-screen flex-col items-center bg-paper px-5 pt-14">
      <Link href="/">
        <Logo />
      </Link>
      <div className="mt-10 w-full max-w-sm rounded-2xl border border-line bg-white p-6 sm:p-7">
        {/* useSearchParams needs a Suspense boundary or the route opts out of
            static rendering entirely. */}
        <Suspense fallback={null}>
          <ResetPasswordForm />
        </Suspense>
      </div>
    </div>
  );
}

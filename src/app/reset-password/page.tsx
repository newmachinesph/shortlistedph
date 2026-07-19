"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { Logo } from "@/components/logo";

export default function ResetPasswordPage() {
  const [done, setDone] = useState(false);
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");

  const mismatch = confirm.length > 0 && pw !== confirm;
  const canSubmit = pw.length >= 8 && pw === confirm;

  return (
    <div className="flex min-h-screen flex-col items-center bg-paper px-5 pt-14">
      <Link href="/">
        <Logo />
      </Link>
      <div className="mt-10 w-full max-w-sm rounded-2xl border border-line bg-white p-7">
        {!done ? (
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
              value={pw}
              onChange={(e) => setPw(e.target.value)}
              className="mt-1.5 w-full rounded-xl border border-line bg-paper px-4 py-3 text-sm text-ink focus:outline-2 focus:outline-brand"
            />
            <p className="mt-1.5 text-xs text-ink-faint">At least 8 characters.</p>
            <label htmlFor="confirm" className="mt-4 block text-sm font-medium text-ink">
              Confirm password
            </label>
            <input
              id="confirm"
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className={`mt-1.5 w-full rounded-xl border bg-paper px-4 py-3 text-sm text-ink focus:outline-2 focus:outline-brand ${
                mismatch ? "border-red-300" : "border-line"
              }`}
            />
            {mismatch && (
              <p className="mt-1.5 text-xs text-red-600">Passwords don&rsquo;t match.</p>
            )}
            <button
              onClick={() => canSubmit && setDone(true)}
              disabled={!canSubmit}
              className="mt-5 w-full rounded-xl bg-brand px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50"
            >
              Reset password
            </button>
          </>
        ) : (
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
              className="mt-5 inline-block w-full rounded-xl bg-brand px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-dark"
            >
              Back to sign in
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { MailCheck } from "lucide-react";
import { Logo } from "@/components/logo";

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [email, setEmail] = useState("");

  return (
    <div className="flex min-h-screen flex-col items-center bg-paper px-5 pt-14">
      <Link href="/">
        <Logo />
      </Link>
      <div className="mt-10 w-full max-w-sm rounded-2xl border border-line bg-white p-7">
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
              placeholder="you@example.com"
              className="mt-1.5 w-full rounded-xl border border-line bg-paper px-4 py-3 text-sm text-ink placeholder:text-ink-faint focus:outline-2 focus:outline-brand"
            />
            <button
              onClick={() => email.trim() && setSent(true)}
              className="mt-5 w-full rounded-xl bg-brand px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-dark"
            >
              Send reset link
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
              a reset link is on its way. It expires in 30 minutes.
            </p>
            <Link
              href="/reset-password"
              className="mt-5 inline-block text-sm font-medium text-brand hover:underline"
            >
              Demo: open the reset link
            </Link>
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

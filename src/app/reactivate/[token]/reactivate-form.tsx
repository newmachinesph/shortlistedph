"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";

// Mirrors ReactivationDecision in lib/reactivation.ts. Declared rather than
// imported: that module is "server-only", and the API route is what actually
// validates this value.
type ReactivationDecision = "publish" | "keep_private" | "delete";

/**
 * The three choices, weighted equally on purpose — no primary button, no
 * pre-selected option, no copy that makes "publish" the obvious answer.
 *
 * The done state is rendered here rather than by reloading the page: the POST
 * spends the token, so a refresh would show "this link is no longer valid" to
 * someone who just succeeded.
 */
const OPTIONS: { value: ReactivationDecision; label: string; detail: string }[] = [
  {
    value: "publish",
    label: "Publish my profile",
    detail:
      "You enter matching. Employers describe a role, we ask you first, and nothing about you is shared until you say yes to that specific job.",
  },
  {
    value: "keep_private",
    label: "Keep it private for now",
    detail:
      "We hold it, unpublished and unseen. You can publish it yourself later from your profile.",
  },
  {
    value: "delete",
    label: "Delete it",
    detail: "The profile and the account are removed for good. This cannot be undone.",
  },
];

export function ReactivateForm({ token }: { token: string }) {
  const [decision, setDecision] = useState<ReactivationDecision | null>(null);
  const [pw, setPw] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<ReactivationDecision | null>(null);

  const needsPassword = decision === "publish" || decision === "keep_private";
  const mismatch = confirm.length > 0 && pw !== confirm;
  const canSubmit =
    decision !== null && !busy && (!needsPassword || (pw.length >= 8 && pw === confirm));

  async function submit() {
    if (!canSubmit || !decision) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/reactivate/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(needsPassword ? { decision, password: pw } : { decision }),
      });
      const payload = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        setError(payload?.error ?? "Something went wrong — try again");
        return;
      }
      setDone(decision);
    } catch {
      setError("Network error — try again");
    } finally {
      setBusy(false);
    }
  }

  if (done === "delete") {
    return (
      <div className="mt-6 rounded-xl border border-line bg-paper p-5 text-center">
        <h2 className="font-display text-lg font-semibold text-ink">Your profile is deleted</h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink-soft">
          The profile and the account are gone. Nothing about you was ever shown
          to an employer, and there is nothing left for us to show. You can
          close this page.
        </p>
      </div>
    );
  }

  if (done) {
    return (
      <div className="mt-6 rounded-xl border border-line bg-paper p-5 text-center">
        <CheckCircle2 className="mx-auto h-8 w-8 text-brand" strokeWidth={1.5} />
        <h2 className="font-display mt-3 text-lg font-semibold text-ink">
          {done === "publish" ? "Your profile is published" : "Your profile stays private"}
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink-soft">
          {done === "publish"
            ? "You're in matching now. We'll email you when a role fits, and you decide each time — you're never put in front of an employer without saying yes first."
            : "Nobody can see it. Publish it whenever you want from your profile, or delete it there."}{" "}
          Your password is set — sign in with your email address.
        </p>
        <Link
          href="/login"
          className="mt-5 inline-flex min-h-11 items-center rounded-xl bg-brand px-5 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-dark"
        >
          Sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="mt-6">
      <h2 className="font-medium text-ink">What would you like to do?</h2>
      <fieldset className="mt-3 space-y-2.5">
        <legend className="sr-only">What happens to your imported profile</legend>
        {OPTIONS.map((o) => (
          <label
            key={o.value}
            className={`flex cursor-pointer gap-3 rounded-xl border p-4 transition-colors ${
              decision === o.value ? "border-brand bg-brand-soft" : "border-line hover:bg-paper"
            }`}
          >
            <input
              type="radio"
              name="decision"
              value={o.value}
              checked={decision === o.value}
              onChange={() => {
                setDecision(o.value);
                setError(null);
              }}
              className="mt-1 h-4 w-4 shrink-0 accent-brand"
            />
            <span>
              <span className="block text-sm font-medium text-ink">{o.label}</span>
              <span className="mt-1 block text-sm leading-relaxed text-ink-soft">{o.detail}</span>
            </span>
          </label>
        ))}
      </fieldset>

      {needsPassword && (
        <div className="mt-5">
          <p className="text-sm leading-relaxed text-ink-soft">
            Set a password so you can get back in. We never had one for you, so
            a password reset can&rsquo;t reach this account until you do.
          </p>
          <label htmlFor="pw" className="mt-4 block text-sm font-medium text-ink">
            Password
          </label>
          <input
            id="pw"
            type="password"
            autoComplete="new-password"
            value={pw}
            onChange={(e) => setPw(e.target.value)}
            className="mt-1.5 w-full rounded-xl border border-line bg-paper px-4 py-3 text-base text-ink focus:outline-2 focus:outline-brand sm:text-sm"
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
            className={`mt-1.5 w-full rounded-xl border bg-paper px-4 py-3 text-base text-ink focus:outline-2 focus:outline-brand sm:text-sm ${
              mismatch ? "border-red-300" : "border-line"
            }`}
          />
          {mismatch && <p className="mt-1.5 text-xs text-red-600">Passwords don&rsquo;t match.</p>}
        </div>
      )}

      {error && (
        <p role="alert" className="mt-4 text-sm text-red-600">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={() => void submit()}
        disabled={!canSubmit}
        className="mt-5 min-h-11 w-full rounded-xl bg-brand px-5 py-3 text-sm font-medium text-white transition-colors hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-50 sm:w-auto"
      >
        {busy ? "Saving…" : decision === "delete" ? "Delete my profile" : "Confirm"}
      </button>

      <p className="mt-4 text-xs leading-relaxed text-ink-faint">
        Nothing happens until you press the button. If you close this page
        without choosing, your profile stays unpublished and unseen, and this
        link keeps working.
      </p>
    </div>
  );
}

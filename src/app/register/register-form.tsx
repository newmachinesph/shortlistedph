"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, Loader2, MailCheck, UserRound } from "lucide-react";
import { Logo } from "@/components/logo";
import { api, signUp } from "@/lib/auth-client";

type Role = "talent" | "employer";

/**
 * Two jobs that used to be one: "sign me up" and "choose a role for the session
 * I already have". A Google sign-in creates the account but never a role, and
 * /api/onboarding/role is the only writer of TalentProfile/EmployerAccount — so
 * running signUp.email for someone already signed in built a SECOND account and
 * orphaned the first one forever. `signedIn` splits the two paths.
 */
export function RegisterForm({ signedIn }: { signedIn: boolean }) {
  const router = useRouter();
  const [role, setRole] = useState<Role | null>(null);
  const [form, setForm] = useState({ name: "", email: "", password: "", companyName: "" });
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const [awaitingEmail, setAwaitingEmail] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [k]: e.target.value });

  /** Writes the role onto the CURRENT session and lands them where it applies. */
  async function claimRole(picked: Role) {
    try {
      await api("/api/onboarding/role", {
        method: "POST",
        body: JSON.stringify(
          picked === "talent" ? { role: picked } : { role: picked, companyName: form.companyName },
        ),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not finish setup");
      setIsBusy(false);
      return;
    }

    router.push(picked === "talent" ? "/onboarding" : "/employer");
    router.refresh();
  }

  // A signed-in talent has nothing left to type, so the card IS the submit —
  // an extra screen with no fields on it only reads as a dead end.
  async function pickRole(picked: Role) {
    setError(null);
    setRole(picked);
    if (signedIn && picked === "talent") {
      setIsBusy(true);
      await claimRole(picked);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!role) return;
    setError(null);
    setIsBusy(true);

    if (!signedIn) {
      const { data, error: signUpError } = await signUp.email({
        email: form.email,
        password: form.password,
        name: form.name,
        // The verification link comes back HERE, to the role picker, because
        // the role is the one thing signup cannot finish on its own.
        callbackURL: "/register",
      });
      if (signUpError) {
        setError(signUpError.message ?? "Could not create your account");
        setIsBusy(false);
        return;
      }
      // Email verification is required, so signup issues no session and there
      // is nothing to claim a role against yet. The account is real — saying
      // "could not finish setup" here would be a lie about a signup that worked.
      if (!data?.token) {
        setAwaitingEmail(true);
        setIsBusy(false);
        return;
      }
    }

    await claimRole(role);
  }

  if (awaitingEmail) {
    return (
      <div className="flex min-h-screen flex-col items-center bg-paper px-5 pt-14">
        <Link href="/">
          <Logo />
        </Link>
        <div className="mt-10 w-full max-w-sm rounded-2xl border border-line bg-white p-6 text-center sm:p-7">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-soft">
            <MailCheck className="h-5 w-5 text-brand" strokeWidth={1.75} />
          </span>
          <h1 className="font-display mt-4 text-2xl font-semibold tracking-tight text-ink">
            Check your email
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-ink-soft">
            Your account exists — we sent a confirmation link to{" "}
            <span className="font-medium text-ink">{form.email}</span>. Open it and you land back
            here to finish setting up as {role === "talent" ? "talent" : "a hiring account"}.
          </p>
          <p className="mt-3 text-sm leading-relaxed text-ink-faint">
            Nothing else to do here. The link signs you in.
          </p>
        </div>
      </div>
    );
  }

  if (!role) {
    return (
      <div className="flex min-h-screen flex-col items-center bg-paper px-5 pt-14">
        <Link href="/">
          <Logo />
        </Link>
        <h1 className="font-display mt-10 text-3xl font-semibold tracking-tight text-ink">
          {signedIn ? "One thing left" : "Join shortlisted.ph"}
        </h1>
        <p className="mt-2 text-ink-soft">Pick your side of the table.</p>

        {error && (
          <p className="mt-6 rounded-xl bg-ember-soft px-4 py-3 text-sm text-ember">{error}</p>
        )}

        <div className="mt-8 grid w-full max-w-2xl gap-5 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => pickRole("employer")}
            className="rounded-2xl border border-line bg-white p-6 sm:p-7 text-left transition hover:ring-2 hover:ring-brand/30"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-soft">
              <Building2 className="h-5 w-5 text-brand" />
            </span>
            <span className="mt-4 block font-medium text-ink">I&rsquo;m hiring</span>
            <span className="mt-1 block text-sm leading-relaxed text-ink-soft">
              Post a hidden job description, see your ranked slate free. Pay only to unlock.
            </span>
          </button>

          <button
            type="button"
            onClick={() => pickRole("talent")}
            disabled={isBusy}
            className="rounded-2xl border border-line bg-white p-6 sm:p-7 text-left transition hover:ring-2 hover:ring-brand/30 disabled:opacity-60"
          >
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-ember-soft">
              <UserRound className="h-5 w-5 text-ember" />
            </span>
            <span className="mt-4 block font-medium text-ink">I&rsquo;m talent</span>
            <span className="mt-1 block text-sm leading-relaxed text-ink-soft">
              Upload your resume once and get shortlisted while you sleep. Free forever.
            </span>
          </button>
        </div>

        <p className="mt-8 max-w-md text-center text-xs leading-relaxed text-ink-faint">
          By joining you agree to our{" "}
          <Link href="/terms" className="text-brand hover:underline">Terms</Link>,{" "}
          <Link href="/privacy" className="text-brand hover:underline">Privacy Policy</Link>, and{" "}
          <Link href="/conduct" className="text-brand hover:underline">Code of Conduct</Link>.
        </p>
        {!signedIn && (
          <p className="mt-4 text-sm text-ink-soft">
            Already have an account?{" "}
            <Link href="/login" className="font-medium text-brand hover:underline">Sign in</Link>
          </p>
        )}
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center bg-paper px-5 pt-14">
      <Link href="/">
        <Logo />
      </Link>
      <form onSubmit={handleSubmit} className="mt-10 w-full max-w-sm rounded-2xl border border-line bg-white p-6 sm:p-7">
        <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">
          {signedIn
            ? role === "talent"
              ? "Setting up your talent profile"
              : "Tell us about your company"
            : role === "talent"
              ? "Create your talent account"
              : "Create your hiring account"}
        </h1>

        {error && <p className="mt-4 rounded-xl bg-ember-soft px-4 py-3 text-sm text-ember">{error}</p>}

        {!signedIn && (
          <>
            <label htmlFor="name" className="mt-6 block text-sm font-medium text-ink">Full name</label>
            <input
              id="name"
              required
              value={form.name}
              onChange={set("name")}
              className="mt-1.5 w-full rounded-xl border border-line bg-paper px-4 py-3 text-base text-ink sm:text-sm focus:outline-2 focus:outline-brand"
            />
          </>
        )}

        {role === "employer" && (
          <>
            <label htmlFor="companyName" className="mt-4 block text-sm font-medium text-ink">Company</label>
            <input
              id="companyName"
              required
              value={form.companyName}
              onChange={set("companyName")}
              className="mt-1.5 w-full rounded-xl border border-line bg-paper px-4 py-3 text-base text-ink sm:text-sm focus:outline-2 focus:outline-brand"
            />
          </>
        )}

        {!signedIn && (
          <>
            <label htmlFor="email" className="mt-4 block text-sm font-medium text-ink">Email</label>
            <input
              id="email"
              type="email"
              required
              value={form.email}
              onChange={set("email")}
              className="mt-1.5 w-full rounded-xl border border-line bg-paper px-4 py-3 text-base text-ink sm:text-sm focus:outline-2 focus:outline-brand"
            />

            <label htmlFor="password" className="mt-4 block text-sm font-medium text-ink">Password</label>
            <input
              id="password"
              type="password"
              required
              minLength={8}
              value={form.password}
              onChange={set("password")}
              className="mt-1.5 w-full rounded-xl border border-line bg-paper px-4 py-3 text-base text-ink sm:text-sm focus:outline-2 focus:outline-brand"
            />
            <p className="mt-1.5 text-xs text-ink-faint">At least 8 characters.</p>
          </>
        )}

        <button
          type="submit"
          disabled={isBusy}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-brand-dark disabled:opacity-60"
        >
          {isBusy && <Loader2 className="h-4 w-4 animate-spin" />}
          {isBusy ? "Setting up…" : signedIn ? "Continue" : "Create account"}
        </button>

        <button
          type="button"
          onClick={() => {
            setError(null);
            setRole(null);
          }}
          disabled={isBusy}
          className="mt-3 w-full rounded-xl px-4 py-3 text-sm font-medium text-ink-soft transition-colors hover:text-ink disabled:opacity-60"
        >
          ← Pick a different role
        </button>
      </form>
    </div>
  );
}

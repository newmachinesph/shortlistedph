"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, Loader2, UserRound } from "lucide-react";
import { Logo } from "@/components/logo";
import { api, signUp } from "@/lib/auth-client";

type Role = "talent" | "employer";

export default function RegisterPage() {
  const router = useRouter();
  const [role, setRole] = useState<Role | null>(null);
  const [form, setForm] = useState({ name: "", email: "", password: "", companyName: "" });
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [k]: e.target.value });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!role) return;
    setError(null);
    setIsBusy(true);

    const { error: signUpError } = await signUp.email({
      email: form.email,
      password: form.password,
      name: form.name,
    });
    if (signUpError) {
      setError(signUpError.message ?? "Could not create your account");
      setIsBusy(false);
      return;
    }

    try {
      await api("/api/onboarding/role", {
        method: "POST",
        body: JSON.stringify(role === "talent" ? { role } : { role, companyName: form.companyName }),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not finish setup");
      setIsBusy(false);
      return;
    }

    router.push(role === "talent" ? "/onboarding" : "/employer");
    router.refresh();
  }

  if (!role) {
    return (
      <div className="flex min-h-screen flex-col items-center bg-paper px-5 pt-14">
        <Link href="/">
          <Logo />
        </Link>
        <h1 className="font-display mt-10 text-3xl font-semibold tracking-tight text-ink">
          Join shortlisted.ph
        </h1>
        <p className="mt-2 text-ink-soft">Pick your side of the table.</p>

        <div className="mt-8 grid w-full max-w-2xl gap-5 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => setRole("employer")}
            className="rounded-2xl border border-line bg-white p-7 text-left transition hover:ring-2 hover:ring-brand/30"
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
            onClick={() => setRole("talent")}
            className="rounded-2xl border border-line bg-white p-7 text-left transition hover:ring-2 hover:ring-brand/30"
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
        <p className="mt-4 text-sm text-ink-soft">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-brand hover:underline">Sign in</Link>
        </p>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center bg-paper px-5 pt-14">
      <Link href="/">
        <Logo />
      </Link>
      <form onSubmit={handleSubmit} className="mt-10 w-full max-w-sm rounded-2xl border border-line bg-white p-7">
        <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">
          {role === "talent" ? "Create your talent account" : "Create your hiring account"}
        </h1>

        {error && <p className="mt-4 rounded-xl bg-ember-soft px-4 py-3 text-sm text-ember">{error}</p>}

        <label htmlFor="name" className="mt-6 block text-sm font-medium text-ink">Full name</label>
        <input
          id="name"
          required
          value={form.name}
          onChange={set("name")}
          className="mt-1.5 w-full rounded-xl border border-line bg-paper px-4 py-3 text-sm text-ink focus:outline-2 focus:outline-brand"
        />

        {role === "employer" && (
          <>
            <label htmlFor="companyName" className="mt-4 block text-sm font-medium text-ink">Company</label>
            <input
              id="companyName"
              required
              value={form.companyName}
              onChange={set("companyName")}
              className="mt-1.5 w-full rounded-xl border border-line bg-paper px-4 py-3 text-sm text-ink focus:outline-2 focus:outline-brand"
            />
          </>
        )}

        <label htmlFor="email" className="mt-4 block text-sm font-medium text-ink">Email</label>
        <input
          id="email"
          type="email"
          required
          value={form.email}
          onChange={set("email")}
          className="mt-1.5 w-full rounded-xl border border-line bg-paper px-4 py-3 text-sm text-ink focus:outline-2 focus:outline-brand"
        />

        <label htmlFor="password" className="mt-4 block text-sm font-medium text-ink">Password</label>
        <input
          id="password"
          type="password"
          required
          minLength={8}
          value={form.password}
          onChange={set("password")}
          className="mt-1.5 w-full rounded-xl border border-line bg-paper px-4 py-3 text-sm text-ink focus:outline-2 focus:outline-brand"
        />
        <p className="mt-1.5 text-xs text-ink-faint">At least 8 characters.</p>

        <button
          type="submit"
          disabled={isBusy}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-dark disabled:opacity-60"
        >
          {isBusy && <Loader2 className="h-4 w-4 animate-spin" />}
          {isBusy ? "Creating account…" : "Create account"}
        </button>

        <button
          type="button"
          onClick={() => setRole(null)}
          className="mt-3 w-full rounded-xl px-4 py-2.5 text-sm font-medium text-ink-soft transition-colors hover:text-ink"
        >
          ← Pick a different role
        </button>
      </form>
    </div>
  );
}

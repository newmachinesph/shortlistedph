"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Logo } from "@/components/logo";
import { authClient, signIn } from "@/lib/auth-client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function routeByRole() {
    const { data } = await authClient.getSession();
    const role = (data?.user as { role?: string } | undefined)?.role;
    router.push(role === "employer" ? "/employer" : role === "admin" ? "/admin" : "/talent");
    router.refresh();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const { error } = await signIn.email({ email, password });
    if (error) {
      setError(error.message ?? "Invalid email or password");
      setBusy(false);
      return;
    }
    await routeByRole();
  }

  return (
    <div className="flex min-h-screen flex-col items-center bg-paper px-5 pt-14">
      <Link href="/">
        <Logo />
      </Link>
      <form onSubmit={handleSubmit} className="mt-10 w-full max-w-sm rounded-2xl border border-line bg-white p-7">
        <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">Welcome back</h1>

        {error && (
          <p className="mt-4 rounded-xl bg-ember-soft px-4 py-3 text-sm text-ember">{error}</p>
        )}

        <label htmlFor="email" className="mt-6 block text-sm font-medium text-ink">Email</label>
        <input
          id="email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1.5 w-full rounded-xl border border-line bg-paper px-4 py-3 text-sm text-ink placeholder:text-ink-faint focus:outline-2 focus:outline-brand"
          placeholder="you@example.com"
        />

        <label htmlFor="password" className="mt-4 block text-sm font-medium text-ink">Password</label>
        <input
          id="password"
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1.5 w-full rounded-xl border border-line bg-paper px-4 py-3 text-sm text-ink focus:outline-2 focus:outline-brand"
        />

        <button
          type="submit"
          disabled={busy}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-dark disabled:opacity-60"
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          {busy ? "Signing in…" : "Sign in"}
        </button>

        <button
          type="button"
          onClick={() => signIn.social({ provider: "google", callbackURL: "/talent" })}
          className="mt-3 w-full rounded-xl px-4 py-2.5 text-sm font-medium text-ink-soft ring-1 ring-inset ring-line transition-colors hover:bg-paper"
        >
          Continue with Google
        </button>

        <div className="mt-4 text-center">
          <Link href="/forgot-password" className="text-sm font-medium text-brand hover:underline">
            Forgot password?
          </Link>
        </div>

        <div className="my-6 border-t border-line" />

        <p className="text-center text-sm text-ink-soft">
          New here?{" "}
          <Link href="/register" className="font-medium text-brand hover:underline">
            Create an account
          </Link>
        </p>
      </form>
    </div>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { authClient, signIn } from "@/lib/auth-client";

export function LoginForm({ showGoogle }: { showGoogle: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  function routeByRole(role: string | undefined) {
    router.push(role === "employer" ? "/employer" : role === "admin" ? "/admin" : "/talent");
    router.refresh();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsBusy(true);
    const { data, error } = await signIn.email({ email, password });
    if (error) {
      setError(error.message ?? "Invalid email or password");
      setIsBusy(false);
      return;
    }
    // The sign-in response already carries the user; only fall back to a
    // second getSession() roundtrip if role is somehow missing from it.
    let role = (data?.user as { role?: string } | undefined)?.role;
    if (!role) {
      const { data: session } = await authClient.getSession();
      role = (session?.user as { role?: string } | undefined)?.role;
    }
    routeByRole(role);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-10 w-full max-w-sm rounded-2xl border border-line bg-white p-6 sm:p-7"
    >
      <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">Welcome back</h1>

      {error && <p className="mt-4 rounded-xl bg-ember-soft px-4 py-3 text-sm text-ember">{error}</p>}

      <label htmlFor="email" className="mt-6 block text-sm font-medium text-ink">
        Email
      </label>
      <input
        id="email"
        type="email"
        required
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        placeholder="you@example.com"
        className="mt-1.5 w-full rounded-xl border border-line bg-paper px-4 py-3 text-base text-ink sm:text-sm placeholder:text-ink-faint focus:outline-2 focus:outline-brand"
      />

      <label htmlFor="password" className="mt-4 block text-sm font-medium text-ink">
        Password
      </label>
      <input
        id="password"
        type="password"
        required
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        className="mt-1.5 w-full rounded-xl border border-line bg-paper px-4 py-3 text-base text-ink sm:text-sm focus:outline-2 focus:outline-brand"
      />

      <button
        type="submit"
        disabled={isBusy}
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-brand px-4 py-3 text-sm font-medium text-white transition-colors hover:bg-brand-dark disabled:opacity-60"
      >
        {isBusy && <Loader2 className="h-4 w-4 animate-spin" />}
        {isBusy ? "Signing in…" : "Sign in"}
      </button>

      {showGoogle && (
        <button
          type="button"
          onClick={() => signIn.social({ provider: "google", callbackURL: "/talent" })}
          className="mt-3 w-full rounded-xl px-4 py-3 text-sm font-medium text-ink-soft ring-1 ring-inset ring-line transition-colors hover:bg-paper"
        >
          Continue with Google
        </button>
      )}

      <div className="mt-1 text-center">
        <Link
          href="/forgot-password"
          className="inline-flex min-h-[44px] items-center justify-center px-2 text-sm font-medium text-brand hover:underline"
        >
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
  );
}

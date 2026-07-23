"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { signIn } from "@/lib/auth-client";

export function AdminLoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isBusy, setIsBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setIsBusy(true);
    const { error } = await signIn.email({ email, password });
    if (error) {
      setError(error.message ?? "Invalid email or password");
      setIsBusy(false);
      return;
    }
    // The (panel) layout re-checks role + allowlist; a non-admin who signs in
    // here just bounces off the gate.
    router.push("/admin");
    router.refresh();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-10 w-full max-w-sm rounded-2xl border border-line bg-white p-6 sm:p-7"
    >
      <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">Admin sign-in</h1>

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
    </form>
  );
}

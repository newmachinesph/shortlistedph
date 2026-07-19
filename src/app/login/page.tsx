import Link from "next/link";
import { Logo } from "@/components/logo";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-paper px-5 py-12">
      <Link href="/" className="mb-8">
        <Logo />
      </Link>

      <div className="w-full max-w-sm rounded-2xl border border-line bg-white p-8">
        <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">Welcome back</h1>
        <p className="mt-1 text-sm text-ink-soft">Sign in to your shortlisted.ph workspace.</p>

        <div className="mt-6 space-y-4">
          <div>
            <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-ink">
              Email
            </label>
            <input
              id="email"
              type="email"
              placeholder="you@example.com"
              className="w-full rounded-xl border border-line bg-paper px-4 py-3 text-sm text-ink placeholder:text-ink-faint focus:outline-2 focus:outline-brand"
            />
          </div>
          <div>
            <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-ink">
              Password
            </label>
            <input
              id="password"
              type="password"
              placeholder="••••••••"
              className="w-full rounded-xl border border-line bg-paper px-4 py-3 text-sm text-ink placeholder:text-ink-faint focus:outline-2 focus:outline-brand"
            />
          </div>
        </div>

        <button className="mt-6 w-full rounded-xl bg-brand px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-dark">
          Sign in
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
      </div>

      <p className="mt-6 max-w-sm text-center text-xs leading-relaxed text-ink-faint">
        Demo: jump straight to the{" "}
        <Link href="/employer" className="text-brand hover:underline">
          employer workspace
        </Link>{" "}
        or{" "}
        <Link href="/talent" className="text-brand hover:underline">
          talent workspace
        </Link>
        .
      </p>
    </div>
  );
}

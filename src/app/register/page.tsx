import Link from "next/link";
import { Building2, UserRound } from "lucide-react";
import { Logo } from "@/components/logo";

export default function RegisterPage() {
  return (
    <div className="flex min-h-screen flex-col items-center bg-paper px-5 py-12">
      <Link href="/" className="mb-8">
        <Logo />
      </Link>

      <h1 className="font-display text-center text-2xl font-semibold tracking-tight text-ink">
        Join shortlisted.ph
      </h1>
      <p className="mt-1 text-center text-sm text-ink-soft">Pick your side of the table.</p>

      <div className="mt-8 grid w-full max-w-2xl gap-5 sm:grid-cols-2">
        <Link
          href="/employer"
          className="rounded-2xl border border-line bg-white p-7 transition hover:ring-2 hover:ring-brand/30"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-soft">
            <Building2 className="h-6 w-6 text-brand" />
          </span>
          <h2 className="mt-4 font-medium text-ink">I&rsquo;m hiring</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
            Post a hidden job description, see your ranked slate free. Pay only to unlock.
          </p>
        </Link>

        <Link
          href="/onboarding"
          className="rounded-2xl border border-line bg-white p-7 transition hover:ring-2 hover:ring-brand/30"
        >
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-ember-soft">
            <UserRound className="h-6 w-6 text-ember" />
          </span>
          <h2 className="mt-4 font-medium text-ink">I&rsquo;m talent</h2>
          <p className="mt-1.5 text-sm leading-relaxed text-ink-soft">
            Upload your resume once. Get shortlisted while you sleep. Free forever.
          </p>
        </Link>
      </div>

      <p className="mt-8 max-w-sm text-center text-xs leading-relaxed text-ink-faint">
        By continuing you agree to shortlisted.ph&rsquo;s{" "}
        <Link href="/terms" className="text-brand hover:underline">
          Terms
        </Link>{" "}
        and{" "}
        <Link href="/privacy" className="text-brand hover:underline">
          Privacy Policy
        </Link>
        , including our{" "}
        <Link href="/conduct" className="text-brand hover:underline">
          Code of Conduct
        </Link>
        .
      </p>
    </div>
  );
}

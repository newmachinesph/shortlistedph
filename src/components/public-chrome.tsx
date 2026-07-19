import Link from "next/link";
import { Logo } from "./logo";

export function PublicHeader() {
  return (
    <header className="mx-auto flex w-full max-w-6xl items-center justify-between px-5 py-5 sm:px-8">
      <Link href="/">
        <Logo />
      </Link>
      <nav className="hidden items-center gap-7 text-sm text-ink-soft sm:flex">
        <Link href="/for-employers" className="hover:text-ink">For employers</Link>
        <Link href="/for-talent" className="hover:text-ink">For talent</Link>
        <Link href="/why-it-works" className="hover:text-ink">Why it works</Link>
        <Link href="/pricing" className="hover:text-ink">Pricing</Link>
      </nav>
      <div className="flex items-center gap-4">
        <Link href="/login" className="text-sm text-ink-soft hover:text-ink">
          Sign in
        </Link>
        <Link
          href="/employer"
          className="rounded-xl bg-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-dark"
        >
          Get your shortlist
        </Link>
      </div>
    </header>
  );
}

/**
 * Standard frame for a public page. Owns the `<main>` landmark so screen
 * readers get a skip target and no page has to remember one.
 */
export function PublicPage({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-paper">
      <PublicHeader />
      <main>{children}</main>
      <PublicFooter />
    </div>
  );
}

export function PublicFooter() {
  return (
    <footer className="w-full border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-8 text-sm text-ink-faint sm:px-8">
        <Logo />
        <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
          <Link href="/for-employers" className="hover:text-ink">Employers</Link>
          <Link href="/for-talent" className="hover:text-ink">Talent</Link>
          <Link href="/why-it-works" className="hover:text-ink">Why it works</Link>
          <Link href="/pricing" className="hover:text-ink">Pricing</Link>
          <Link href="/conduct" className="hover:text-ink">Conduct</Link>
          <Link href="/terms" className="hover:text-ink">Terms</Link>
          <Link href="/privacy" className="hover:text-ink">Privacy</Link>
        </div>
        <p>© 2026 shortlisted.ph · Made for Filipino remote talent</p>
      </div>
    </footer>
  );
}

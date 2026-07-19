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

const FOOTER_LINKS: [string, [string, string][]][] = [
  [
    "Platform",
    [
      ["For employers", "/for-employers"],
      ["For talent", "/for-talent"],
      ["Why it works", "/why-it-works"],
      ["Pricing", "/pricing"],
    ],
  ],
  [
    "Legal",
    [
      ["Code of conduct", "/conduct"],
      ["Terms of service", "/terms"],
      ["Privacy policy", "/privacy"],
    ],
  ],
];

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden className="h-4 w-4">
      <path d="M22 12.06C22 6.5 17.52 2 12 2S2 6.5 2 12.06c0 5.02 3.66 9.18 8.44 9.94v-7.03H7.9v-2.91h2.54V9.85c0-2.52 1.5-3.91 3.77-3.91 1.09 0 2.24.2 2.24.2v2.46h-1.26c-1.24 0-1.63.78-1.63 1.57v1.89h2.78l-.45 2.91h-2.33V22c4.78-.76 8.44-4.92 8.44-9.94Z" />
    </svg>
  );
}

export function PublicFooter() {
  return (
    <footer className="w-full border-t border-line bg-white">
      <div className="mx-auto max-w-6xl px-5 py-14 sm:px-8">
        <div className="flex flex-col gap-10 lg:flex-row lg:justify-between">
          <div className="max-w-sm">
            <Logo />
            <p className="mt-4 text-sm leading-relaxed text-ink-soft">
              Sourcing for Philippine remote talent. Employers write a job description
              nobody can browse; we rank the market against it and return a shortlist.
            </p>
            <a
              href="https://www.facebook.com/phshortlisted/"
              target="_blank"
              rel="noopener noreferrer"
              className="mt-5 inline-flex items-center gap-2 rounded-xl border border-line px-3.5 py-2 text-sm font-medium text-ink-soft transition-colors hover:border-brand/40 hover:text-brand"
            >
              <FacebookIcon />
              Follow on Facebook
            </a>
          </div>

          <nav aria-label="Footer" className="grid grid-cols-2 gap-x-12 gap-y-8 sm:grid-cols-3">
            {FOOTER_LINKS.map(([heading, links]) => (
              <div key={heading}>
                <h2 className="text-xs font-medium uppercase tracking-[0.16em] text-ink-faint">
                  {heading}
                </h2>
                <ul className="mt-4 space-y-2.5">
                  {links.map(([label, href]) => (
                    <li key={href}>
                      <Link href={href} className="text-sm text-ink-soft hover:text-ink">
                        {label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
            <div>
              <h2 className="text-xs font-medium uppercase tracking-[0.16em] text-ink-faint">
                Get started
              </h2>
              <ul className="mt-4 space-y-2.5">
                <li>
                  <Link href="/employer/briefs/new" className="text-sm text-ink-soft hover:text-ink">
                    Write a job description
                  </Link>
                </li>
                <li>
                  <Link href="/onboarding" className="text-sm text-ink-soft hover:text-ink">
                    Upload your resume
                  </Link>
                </li>
                <li>
                  <Link href="/login" className="text-sm text-ink-soft hover:text-ink">
                    Sign in
                  </Link>
                </li>
              </ul>
            </div>
          </nav>
        </div>

        <div className="mt-12 flex flex-col gap-3 border-t border-line pt-6 text-sm text-ink-faint sm:flex-row sm:items-center sm:justify-between">
          <p>© 2026 shortlisted.ph · Made for Filipino remote talent</p>
          <p>
            Talent never pays to be listed, matched, or hired.{" "}
            <Link href="/conduct" className="font-medium text-brand hover:underline">
              Report anyone who asks
            </Link>
            .
          </p>
        </div>
      </div>
    </footer>
  );
}

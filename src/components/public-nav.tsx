"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Menu, X } from "lucide-react";
import { signOut } from "@/lib/auth-client";
import { Avatar } from "./avatar";
import { Logo } from "./logo";

const NAV_LINKS: [string, string][] = [
  ["For employers", "/for-employers"],
  ["For talent", "/for-talent"],
  ["Why it works", "/why-it-works"],
  ["Pricing", "/pricing"],
];

export type NavUser = { name: string; image: string | null; role: string };

const dashboardHref = (role: string) =>
  role === "employer" ? "/employer" : role === "admin" ? "/admin" : "/talent";

function AccountMenu({ user }: { user: NavUser }) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);

  async function handleSignOut() {
    await signOut();
    router.push("/");
    router.refresh();
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setIsOpen((v) => !v)}
        aria-expanded={isOpen}
        aria-label="Account menu"
        className="flex items-center rounded-lg transition-shadow hover:ring-2 hover:ring-brand/30"
      >
        <Avatar name={user.name} image={user.image} size="sm" />
      </button>
      {isOpen && (
        <div className="absolute right-0 top-full z-50 mt-2 w-48 rounded-2xl border border-line bg-white p-1.5 shadow-lg shadow-ink/5">
          <p className="truncate px-3 py-2 text-xs text-ink-faint">{user.name}</p>
          <Link
            href={dashboardHref(user.role)}
            onClick={() => setIsOpen(false)}
            className="block rounded-xl px-3 py-2 text-sm text-ink hover:bg-paper"
          >
            Dashboard
          </Link>
          <button
            type="button"
            onClick={handleSignOut}
            className="block w-full rounded-xl px-3 py-2 text-left text-sm text-ink-soft hover:bg-paper"
          >
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Public header. Below `md` the links collapse into a disclosure panel: at
 * 640px the four nav links plus "Sign in" plus the CTA are wider than the
 * viewport, so `sm` is too early to show the full row.
 *
 * The panel closes on any click inside it, which covers every link — no
 * pathname effect needed.
 */
export function PublicNav({ user = null }: { user?: NavUser | null }) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);

  return (
    <header className="relative">
      <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-3 px-5 py-4 sm:px-8 sm:py-5">
        <Link href="/" className="shrink-0 py-1">
          <Logo />
        </Link>

        <nav className="hidden items-center gap-7 text-sm text-ink-soft md:flex">
          {NAV_LINKS.map(([label, href]) => (
            <Link key={href} href={href} className="hover:text-ink">
              {label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-4 md:flex">
          {user ? (
            <>
              <Link
                href={dashboardHref(user.role)}
                className="rounded-xl bg-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-dark"
              >
                Dashboard
              </Link>
              <AccountMenu user={user} />
            </>
          ) : (
            <>
              <Link href="/login" className="text-sm text-ink-soft hover:text-ink">
                Sign in
              </Link>
              <Link
                href="/start"
                className="rounded-xl bg-brand px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-dark"
              >
                Get your shortlist
              </Link>
            </>
          )}
        </div>

        <button
          type="button"
          onClick={() => setIsOpen((v) => !v)}
          aria-expanded={isOpen}
          aria-controls="public-mobile-nav"
          aria-label={isOpen ? "Close menu" : "Open menu"}
          className="-mr-2 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-ink-soft transition-colors hover:bg-white hover:text-ink md:hidden"
        >
          {isOpen ? (
            <X className="h-5 w-5" strokeWidth={1.75} />
          ) : (
            <Menu className="h-5 w-5" strokeWidth={1.75} />
          )}
        </button>
      </div>

      {isOpen && (
        <div
          id="public-mobile-nav"
          onClick={() => setIsOpen(false)}
          className="absolute inset-x-0 top-full z-40 border-y border-line bg-white shadow-lg shadow-ink/5 md:hidden"
        >
          <nav className="mx-auto flex max-w-6xl flex-col px-5 py-2">
            {NAV_LINKS.map(([label, href]) => (
              <Link
                key={href}
                href={href}
                className="flex min-h-[44px] items-center border-b border-line text-sm text-ink-soft hover:text-ink"
              >
                {label}
              </Link>
            ))}
            {user ? (
              <>
                <Link
                  href={dashboardHref(user.role)}
                  className="flex min-h-[44px] items-center gap-2.5 border-b border-line text-sm font-medium text-ink"
                >
                  <Avatar name={user.name} image={user.image} size="sm" /> Dashboard
                </Link>
                <button
                  type="button"
                  onClick={async () => {
                    await signOut();
                    router.push("/");
                    router.refresh();
                  }}
                  className="mb-2 flex min-h-[44px] items-center text-left text-sm text-ink-soft hover:text-ink"
                >
                  Sign out
                </button>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="flex min-h-[44px] items-center text-sm text-ink-soft hover:text-ink"
                >
                  Sign in
                </Link>
                <Link
                  href="/start"
                  className="mb-3 mt-1 rounded-xl bg-brand px-4 py-3 text-center text-sm font-medium text-white transition-colors hover:bg-brand-dark"
                >
                  Get your shortlist
                </Link>
              </>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}

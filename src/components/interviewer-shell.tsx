"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ClipboardList, LogOut, UserRound } from "lucide-react";
import { Logo } from "./logo";
import { signOut } from "@/lib/auth-client";

/**
 * The interviewer portal is its own surface, not the employer/talent workspace.
 * Minimal chrome on purpose: brand, two links, sign out.
 */
const NAV = [
  { label: "Assignments", href: "/interviewer", icon: ClipboardList },
  { label: "Profile", href: "/interviewer/profile", icon: UserRound },
];

export function InterviewerShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();

  return (
    <div className="min-h-screen bg-paper">
      <header className="sticky top-0 z-30 border-b border-line bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-3xl items-center gap-3 px-4 sm:px-6">
          <Link href="/interviewer" aria-label="Interviewer home">
            <Logo />
          </Link>

          <nav className="ml-2 flex items-center gap-1">
            {NAV.map((item) => {
              const active = item.href === "/interviewer"
                ? pathname === "/interviewer"
                : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm transition-colors ${
                    active ? "bg-brand text-white" : "text-ink-soft hover:bg-brand-soft hover:text-ink"
                  }`}
                >
                  <item.icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                  <span className="hidden sm:inline">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <button
            type="button"
            onClick={async () => {
              await signOut();
              router.push("/login");
              router.refresh();
            }}
            className="ml-auto flex min-h-11 items-center gap-2 rounded-lg px-3 text-sm text-ink-soft transition-colors hover:bg-brand-soft hover:text-ink"
          >
            <LogOut className="h-4 w-4" strokeWidth={1.75} />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-6 sm:px-6 sm:py-8">{children}</main>
    </div>
  );
}

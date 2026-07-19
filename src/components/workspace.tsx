"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  Users,
  FileSignature,
  Star,
  MessageSquare,
  LifeBuoy,
  Scale,
  Bell,
  Gift,
  CreditCard,
  User,
  LogOut,
  Search,
  type LucideIcon,
} from "lucide-react";
import { Logo } from "./logo";
import { signOut } from "@/lib/auth-client";

type NavItem = { label: string; icon: LucideIcon; href: string };

const employerNav: NavItem[] = [
  { label: "Dashboard", icon: LayoutDashboard, href: "/employer" },
  { label: "Job descriptions", icon: FileText, href: "/employer/briefs" },
  { label: "Connections", icon: Users, href: "/employer/connections" },
  { label: "Agreements", icon: FileSignature, href: "/employer/agreements" },
  { label: "Ratings", icon: Star, href: "/employer/ratings" },
  { label: "Messages", icon: MessageSquare, href: "/employer/messages" },
  { label: "Support", icon: LifeBuoy, href: "/employer/support" },
  { label: "Legal", icon: Scale, href: "/employer/legal" },
  { label: "Notifications", icon: Bell, href: "/employer/notifications" },
  { label: "Billing", icon: CreditCard, href: "/employer/billing" },
  { label: "Referrals", icon: Gift, href: "/referrals" },
  { label: "Profile", icon: User, href: "/employer/profile" },
];

const talentNav: NavItem[] = [
  { label: "Dashboard", icon: LayoutDashboard, href: "/talent" },
  { label: "Services", icon: FileText, href: "/talent/services" },
  { label: "Connections", icon: Users, href: "/talent/connections" },
  { label: "Agreements", icon: FileSignature, href: "/talent/agreements" },
  { label: "Ratings", icon: Star, href: "/talent/ratings" },
  { label: "Messages", icon: MessageSquare, href: "/talent/messages" },
  { label: "Support", icon: LifeBuoy, href: "/talent/support" },
  { label: "Legal", icon: Scale, href: "/talent/legal" },
  { label: "Notifications", icon: Bell, href: "/talent/notifications" },
  { label: "Referrals", icon: Gift, href: "/referrals" },
  { label: "Profile", icon: User, href: "/talent/profile" },
];

export type Persona = { name: string; sub: string; initials: string };

export function WorkspaceShell({
  role,
  persona,
  children,
}: {
  role: "employer" | "talent";
  persona: Persona;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [menuOpen, setMenuOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const nav = role === "employer" ? employerNav : talentNav;
  const base = role === "employer" ? "/employer" : "/talent";

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const closeMenu = () => setMenuOpen(false);

  return (
    <div className="min-h-screen bg-paper">
      <aside className="fixed inset-y-0 left-0 hidden w-60 flex-col border-r border-line bg-white lg:flex">
        <div className="px-5 pt-5 pb-4">
          <Link href="/">
            <Logo />
          </Link>
        </div>
        <p className="px-5 pb-2 text-[11px] font-medium uppercase tracking-wider text-ink-faint">
          Workspace
        </p>
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-3 pb-4">
          {nav.map((item) => {
            const active =
              item.href === pathname ||
              (item.href !== "/employer" &&
                item.href !== "/talent" &&
                pathname.startsWith(item.href));
            return (
              <Link
                key={item.label}
                href={item.href}
                className={`flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm transition-colors ${
                  active
                    ? "bg-brand text-white"
                    : "text-ink-soft hover:bg-brand-soft hover:text-ink"
                }`}
              >
                <item.icon className="h-4 w-4" strokeWidth={1.75} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="lg:pl-60">
        <header className="sticky top-0 z-20 flex h-16 items-center gap-4 border-b border-line bg-paper/85 px-5 backdrop-blur sm:px-8">
          <div className="relative max-w-md flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint" />
            <input
              ref={searchRef}
              type="search"
              placeholder={role === "employer" ? "Search candidates, job descriptions…" : "Search agreements, messages…"}
              className="w-full rounded-xl border border-line bg-white py-2 pl-10 pr-16 text-sm text-ink placeholder:text-ink-faint focus:outline-2 focus:outline-brand"
            />
            <kbd className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded-md border border-line bg-paper px-1.5 py-0.5 text-[10px] font-medium text-ink-faint">
              Ctrl K
            </kbd>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <Link
              href={`${base}/notifications`}
              aria-label="Notifications"
              className="relative flex h-9 w-9 items-center justify-center rounded-xl text-ink-soft transition-colors hover:bg-brand-soft hover:text-ink"
            >
              <Bell className="h-[18px] w-[18px]" strokeWidth={1.75} />
              <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-ember ring-2 ring-paper" />
            </Link>

            <div className="relative">
              <button
                onClick={() => setMenuOpen((o) => !o)}
                aria-label="Account menu"
                className="flex items-center gap-2 rounded-xl p-1 transition-colors hover:bg-brand-soft"
              >
                <span className="font-display flex h-8 w-8 items-center justify-center rounded-lg bg-brand-soft text-xs font-semibold text-brand">
                  {persona.initials}
                </span>
              </button>
              {menuOpen && (
                <>
                  <div className="fixed inset-0 z-20" onClick={() => setMenuOpen(false)} />
                  <div className="absolute right-0 z-30 mt-2 w-60 overflow-hidden rounded-2xl border border-line bg-white shadow-lg shadow-ink/5">
                    <div className="border-b border-line px-4 py-3">
                      <p className="truncate text-sm font-medium text-ink">{persona.name}</p>
                      <p className="truncate text-xs text-ink-faint">{persona.sub}</p>
                    </div>
                    <nav className="py-1.5">
                      <Link
                        href={`${base}/profile`}
                        onClick={closeMenu}
                        className="flex items-center gap-2.5 px-4 py-2 text-sm text-ink-soft hover:bg-paper hover:text-ink"
                      >
                        <User className="h-4 w-4" strokeWidth={1.75} /> Profile
                      </Link>
                      <Link
                        href={`${base}/notifications`}
                        onClick={closeMenu}
                        className="flex items-center gap-2.5 px-4 py-2 text-sm text-ink-soft hover:bg-paper hover:text-ink"
                      >
                        <Bell className="h-4 w-4" strokeWidth={1.75} /> Notifications
                      </Link>
                    </nav>
                    <div className="border-t border-line py-1.5">
                      <button
                        type="button"
                        onClick={async () => {
                          closeMenu();
                          await signOut();
                          router.push("/login");
                          router.refresh();
                        }}
                        className="flex w-full items-center gap-2.5 px-4 py-2 text-sm text-ink-soft hover:bg-paper hover:text-ink"
                      >
                        <LogOut className="h-4 w-4" strokeWidth={1.75} /> Sign out
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        <main className="mx-auto max-w-5xl px-5 py-8 sm:px-8">{children}</main>
      </div>
    </div>
  );
}

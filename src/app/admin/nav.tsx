"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BadgeCheck,
  Coins,
  Flag,
  Globe,
  LayoutDashboard,
  ListChecks,
  MailCheck,
  Menu,
  Settings,
  Share2,
  UserCheck,
  Users,
  Video,
  ExternalLink,
  X,
  type LucideIcon,
} from "lucide-react";
import { Logo } from "@/components/logo";

const nav: { label: string; icon: LucideIcon; href: string }[] = [
  { label: "Overview", icon: LayoutDashboard, href: "/admin" },
  { label: "Reports", icon: Flag, href: "/admin/reports" },
  { label: "Verifications", icon: BadgeCheck, href: "/admin/verifications" },
  { label: "Users", icon: Users, href: "/admin/users" },
  { label: "Re-activation", icon: MailCheck, href: "/admin/reactivation" },
  { label: "Slates", icon: ListChecks, href: "/admin/slates" },
  { label: "Openings", icon: Globe, href: "/admin/openings" },
  { label: "Interviewers", icon: UserCheck, href: "/admin/interviewers" },
  { label: "Interviews", icon: Video, href: "/admin/interviews" },
  { label: "Credits", icon: Coins, href: "/admin/credits" },
  { label: "Affiliates", icon: Share2, href: "/admin/affiliates" },
  { label: "Settings", icon: Settings, href: "/admin/settings" },
];

function isActive(href: string, pathname: string) {
  return href === pathname || (href !== "/admin" && pathname.startsWith(href));
}

function NavLinks({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <>
      {nav.map((item) => (
        <Link
          key={item.label}
          href={item.href}
          onClick={onNavigate}
          aria-current={isActive(item.href, pathname) ? "page" : undefined}
          className={`flex min-h-11 items-center gap-3 rounded-lg px-2.5 py-2 text-sm transition-colors lg:min-h-0 ${
            isActive(item.href, pathname)
              ? "bg-white/15 text-white"
              : "text-white/60 hover:bg-white/10 hover:text-white"
          }`}
        >
          <item.icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
          {item.label}
        </Link>
      ))}
    </>
  );
}

export function AdminNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // Escape closes the drawer, and the body must not scroll behind it.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <>
      {/* Phone: fixed top bar. The only navigation that exists below lg. */}
      <div className="fixed inset-x-0 top-0 z-40 flex h-14 items-center gap-3 border-b border-white/10 bg-ink px-4 lg:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open navigation"
          aria-expanded={open}
          className="-ml-2 inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-white/70 transition-colors hover:bg-white/10 hover:text-white"
        >
          <Menu className="h-5 w-5" strokeWidth={1.75} />
        </button>
        <Link href="/" className="min-w-0">
          <Logo className="[&_span]:text-white" />
        </Link>
        <span className="ml-auto truncate text-[11px] font-medium uppercase tracking-wider text-white/40">
          {nav.find((n) => isActive(n.href, pathname))?.label ?? "Back office"}
        </span>
      </div>

      {open && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Close navigation"
            onClick={() => setOpen(false)}
            className="absolute inset-0 h-full w-full bg-ink/60"
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Back office navigation"
            className="absolute inset-y-0 left-0 flex w-72 max-w-[85vw] flex-col border-r border-white/10 bg-ink"
          >
            <div className="flex items-start gap-3 px-5 pt-5 pb-1">
              <div className="min-w-0">
                <Link href="/" onClick={() => setOpen(false)}>
                  <Logo className="[&_span]:text-white" />
                </Link>
                <p className="mt-2 text-[11px] font-medium uppercase tracking-wider text-white/40">
                  Back office
                </p>
              </div>
              <button
                type="button"
                autoFocus
                onClick={() => setOpen(false)}
                aria-label="Close navigation"
                className="-mr-2 ml-auto inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-white/70 transition-colors hover:bg-white/10 hover:text-white"
              >
                <X className="h-5 w-5" strokeWidth={1.75} />
              </button>
            </div>
            <nav className="mt-4 flex-1 space-y-0.5 overflow-y-auto px-3">
              <NavLinks pathname={pathname} onNavigate={() => setOpen(false)} />
            </nav>
            <div className="border-t border-white/10 p-4">
              <Link
                href="/employer"
                onClick={() => setOpen(false)}
                className="inline-flex min-h-11 items-center gap-2 text-xs text-white/50 hover:text-white"
              >
                <ExternalLink className="h-3.5 w-3.5" /> Back to app
              </Link>
            </div>
          </div>
        </div>
      )}

      <aside className="fixed inset-y-0 left-0 hidden w-56 flex-col border-r border-line bg-ink lg:flex">
        <div className="px-5 pt-5 pb-1">
          <Link href="/">
            <Logo className="[&_span]:text-white" />
          </Link>
          <p className="mt-2 text-[11px] font-medium uppercase tracking-wider text-white/40">
            Back office
          </p>
        </div>
        <nav className="mt-4 flex-1 space-y-0.5 px-3">
          <NavLinks pathname={pathname} />
        </nav>
        <div className="border-t border-white/10 p-4">
          <Link href="/employer" className="flex items-center gap-2 text-xs text-white/50 hover:text-white">
            <ExternalLink className="h-3.5 w-3.5" /> Back to app
          </Link>
        </div>
      </aside>
    </>
  );
}

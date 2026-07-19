"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Flag,
  LayoutDashboard,
  ListChecks,
  Share2,
  Users,
  ExternalLink,
  type LucideIcon,
} from "lucide-react";
import { Logo } from "@/components/logo";

const nav: { label: string; icon: LucideIcon; href: string }[] = [
  { label: "Overview", icon: LayoutDashboard, href: "/admin" },
  { label: "Reports", icon: Flag, href: "/admin/reports" },
  { label: "Users", icon: Users, href: "/admin/users" },
  { label: "Slates", icon: ListChecks, href: "/admin/slates" },
  { label: "Affiliates", icon: Share2, href: "/admin/affiliates" },
];

export function AdminNav() {
  const pathname = usePathname();
  return (
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
        {nav.map((item) => {
          const active =
            item.href === pathname ||
            (item.href !== "/admin" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.label}
              href={item.href}
              className={`flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm transition-colors ${
                active ? "bg-white/15 text-white" : "text-white/60 hover:bg-white/10 hover:text-white"
              }`}
            >
              <item.icon className="h-4 w-4" strokeWidth={1.75} />
              {item.label}
            </Link>
          );
        })}
      </nav>
      <div className="border-t border-white/10 p-4">
        <Link href="/employer" className="flex items-center gap-2 text-xs text-white/50 hover:text-white">
          <ExternalLink className="h-3.5 w-3.5" /> Back to app
        </Link>
      </div>
    </aside>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ExternalLink, LogOut } from "lucide-react";
import { Avatar } from "@/components/avatar";
import { signOut } from "@/lib/auth-client";

/** Same account-menu pattern as the workspace shell, sized for the back office. */
export function AccountMenu({
  name,
  email,
  image = null,
}: {
  name: string;
  email: string;
  image?: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label="Account menu"
        aria-expanded={open}
        className="flex h-11 w-11 items-center justify-center rounded-xl transition-colors hover:bg-brand-soft"
      >
        <Avatar name={name} image={image} size="sm" />
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-20" onClick={() => setOpen(false)} />
          <div className="absolute right-0 z-30 mt-2 w-60 overflow-hidden rounded-2xl border border-line bg-white shadow-lg shadow-ink/5">
            <div className="border-b border-line px-4 py-3">
              <p className="truncate text-sm font-medium text-ink">{name}</p>
              <p className="truncate text-xs text-ink-faint">{email}</p>
            </div>
            <nav className="py-1.5">
              <Link
                href="/employer"
                onClick={() => setOpen(false)}
                className="flex items-center gap-2.5 px-4 py-2 text-sm text-ink-soft hover:bg-paper hover:text-ink"
              >
                <ExternalLink className="h-4 w-4" strokeWidth={1.75} /> Back to app
              </Link>
            </nav>
            <div className="border-t border-line py-1.5">
              <button
                type="button"
                onClick={async () => {
                  setOpen(false);
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
  );
}

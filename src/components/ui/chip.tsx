import Link from "next/link";
import type { ReactNode } from "react";

/**
 * Two small pieces the Workze-style board leans on: a filter Chip (a link that
 * toggles active) and a static Tag pill for categories on a listing row.
 *
 * Chip is a link, not a button, so a filtered board stays server-rendered and
 * shareable — the active filter lives in the URL, not client state.
 */
export function Chip({
  href,
  active = false,
  children,
}: {
  href: string;
  active?: boolean;
  children: ReactNode;
}) {
  const style = active
    ? "bg-brand text-white"
    : "bg-[var(--color-surface)] text-ink-soft ring-1 ring-inset ring-line hover:text-ink hover:ring-brand/30";
  return (
    <Link
      href={href}
      aria-current={active ? "true" : undefined}
      className={`inline-flex items-center [border-radius:var(--radius-pill)] px-3.5 py-1.5 text-sm font-medium transition-colors ${style}`}
    >
      {children}
    </Link>
  );
}

export function Tag({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center [border-radius:var(--radius-pill)] bg-brand-soft px-2.5 py-1 text-xs font-medium text-brand">
      {children}
    </span>
  );
}

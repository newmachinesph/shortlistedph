import type { ReactNode } from "react";

/**
 * A raised surface card. `interactive` adds the hover-lift used on clickable
 * rows and tiles; leave it off for static content panels.
 *
 * The radius and shadow come from the token ladder in globals.css, not
 * per-instance rounded-2xl / shadow guesses.
 */
export function Card({
  interactive = false,
  className,
  children,
}: {
  interactive?: boolean;
  className?: string;
  children: ReactNode;
}) {
  const lift = interactive
    ? "transition-shadow transition-transform hover:-translate-y-0.5 hover:[box-shadow:var(--shadow-lift)]"
    : "";
  return (
    <div
      className={`border border-line bg-[var(--color-surface)] [border-radius:var(--radius-card)] [box-shadow:var(--shadow-card)] ${lift} ${className ?? ""}`.trim()}
    >
      {children}
    </div>
  );
}

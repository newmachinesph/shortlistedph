import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

/**
 * The three button shapes already copy-pasted across the public pages: a solid
 * brand fill, a ring outline, and a ghost text-link with a trailing arrow.
 * Named here so a page stops re-deriving the exact padding and hover each time.
 *
 * Renders an <a> (via next/link) when `href` is set, a <button> otherwise —
 * one call site for both the "go somewhere" and "do something" cases.
 */
type Variant = "solid" | "outline" | "ghost";
type Size = "md" | "lg";

const base =
  "inline-flex items-center justify-center gap-2 font-semibold transition-all disabled:opacity-50 disabled:pointer-events-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/40 focus-visible:ring-offset-2 focus-visible:ring-offset-paper";

const variants: Record<Variant, string> = {
  solid:
    "rounded-2xl bg-brand text-white shadow-lg shadow-brand/25 hover:bg-brand-dark hover:shadow-brand/30",
  outline:
    "rounded-2xl text-brand ring-1 ring-inset ring-brand/30 hover:bg-brand-soft",
  ghost: "text-brand hover:underline underline-offset-4",
};

const sizes: Record<Size, string> = {
  md: "px-5 py-3 text-sm",
  lg: "px-6 py-3.5 text-sm",
};

type CommonProps = {
  variant?: Variant;
  size?: Size;
  children: ReactNode;
  className?: string;
};

// Ghost is a text link, so it carries no box padding — the size map only
// applies to the two filled shapes.
function classesFor(variant: Variant, size: Size, className?: string): string {
  const box = variant === "ghost" ? "" : sizes[size];
  return `${base} ${variants[variant]} ${box} ${className ?? ""}`.trim();
}

export function Button({
  variant = "solid",
  size = "lg",
  className,
  children,
  ...rest
}: CommonProps & Omit<ComponentProps<"button">, "className" | "children">) {
  return (
    <button className={classesFor(variant, size, className)} {...rest}>
      {children}
    </button>
  );
}

export function ButtonLink({
  href,
  variant = "solid",
  size = "lg",
  className,
  children,
  ...rest
}: CommonProps & { href: string } & Omit<ComponentProps<typeof Link>, "href" | "className" | "children">) {
  return (
    <Link href={href} className={classesFor(variant, size, className)} {...rest}>
      {children}
    </Link>
  );
}

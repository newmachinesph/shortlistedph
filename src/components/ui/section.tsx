import type { ReactNode } from "react";

/**
 * A page band and its header. `tone` picks the surface from the ladder — paper
 * (default), white, sunk, or the dark brand band for CTA/stat sections — so
 * pages stop alternating bg-white by hand and gain real depth between sections.
 *
 * SectionHeader is the eyebrow + heading + lede triple every band repeats.
 */
type Tone = "paper" | "white" | "sunk" | "band";

const tones: Record<Tone, string> = {
  paper: "bg-paper text-ink",
  white: "bg-[var(--color-surface)] text-ink border-y border-line",
  sunk: "bg-[var(--color-surface-sunk)] text-ink",
  band: "bg-[var(--color-band)] text-white",
};

export function Section({
  tone = "paper",
  id,
  className,
  children,
}: {
  tone?: Tone;
  id?: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <section
      id={id}
      className={`w-full [padding-block:var(--space-section)] ${tones[tone]} ${id ? "scroll-mt-16" : ""} ${className ?? ""}`.trim()}
    >
      <div className="mx-auto w-full max-w-6xl px-5 sm:px-8">{children}</div>
    </section>
  );
}

export function SectionHeader({
  eyebrow,
  title,
  lede,
  align = "left",
  accent = "brand",
}: {
  eyebrow?: string;
  title: ReactNode;
  lede?: ReactNode;
  align?: "left" | "center";
  accent?: "brand" | "ember";
}) {
  const alignment = align === "center" ? "mx-auto max-w-2xl text-center" : "max-w-2xl";
  const eyebrowColor = accent === "ember" ? "text-ember" : "text-brand";
  return (
    <header className={alignment}>
      {eyebrow && (
        <p className={`text-xs font-medium uppercase tracking-[0.2em] ${eyebrowColor}`}>
          {eyebrow}
        </p>
      )}
      <h2 className="font-display mt-3 font-semibold tracking-tight [font-size:var(--text-h2)]">
        {title}
      </h2>
      {lede && <p className="mt-3 [font-size:var(--text-lead)] leading-relaxed opacity-80">{lede}</p>}
    </header>
  );
}

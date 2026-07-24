import type { ReactNode } from "react";

/**
 * The stat strip on the homepage (value + label, in a bordered row),
 * generalized so any band can use it. `tone` inverts the colours for the dark
 * brand band. Renders as a <dl> for the same semantics the homepage already had.
 */
export type StatItem = { value: ReactNode; label: string };

export function StatStrip({
  items,
  tone = "light",
}: {
  items: StatItem[];
  tone?: "light" | "dark";
}) {
  const border = tone === "dark" ? "border-white/15" : "border-line";
  const value = tone === "dark" ? "text-white" : "text-ink";
  const label = tone === "dark" ? "text-white/60" : "text-ink-faint";
  return (
    <dl className={`flex flex-wrap gap-x-12 gap-y-6 border-t ${border} pt-8`}>
      {items.map((s) => (
        <div key={s.label}>
          <dt className="sr-only">{s.label}</dt>
          <dd className={`font-display text-3xl font-semibold ${value}`}>{s.value}</dd>
          <dd className={`mt-1 text-sm ${label}`}>{s.label}</dd>
        </div>
      ))}
    </dl>
  );
}

/** Presentation helpers. Pure — safe to import from server or client. */

/** "Kristine Bautista" -> "KB". Used for every avatar in the app. */
export function initials(name: string | null | undefined): string {
  if (!name?.trim()) return "??";
  return name
    .trim()
    .split(/\s+/)
    // [...part][0] takes the first Unicode code point, so an astral first
    // character (emoji, rare CJK) yields a whole glyph, not a broken surrogate.
    .map((part) => [...part][0]?.toUpperCase() ?? "")
    .slice(0, 2)
    .join("");
}

/** "$8–11/hr", "$9/hr", or null when the employer left the band open. */
export function rateBand(min: number | null, max: number | null): string | null {
  if (min == null && max == null) return null;
  if (min != null && max != null) return min === max ? `$${min}/hr` : `$${min}–${max}/hr`;
  return `$${min ?? max}/hr`;
}

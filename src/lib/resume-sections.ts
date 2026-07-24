/**
 * Reads the shortlisted.ph standard resume format. Pure — no db, no network —
 * so the tests import the exact logic extraction runs.
 *
 * docs/engine/shortlisted-resume-template.md tells every candidate: "Use the
 * exact section headings below — They are the anchors our parser looks for."
 * Until this file existed that was not true; the whole document went to the
 * model as one blob and following the template changed nothing. This makes the
 * promise real for the fields that have somewhere to land today.
 *
 * Two jobs:
 *   splitSections    — cut the document at its headings, or return null when
 *                      it does not follow the template at all.
 *   readTemplateFacts — read the fields the template formats for machines
 *                      ("Rate: USD 8 / hour"), deterministically. These beat
 *                      the model's guess at the same fact, because they are
 *                      not a guess.
 *
 * Deliberately not here yet: per-tool years and last-used year, and per-role
 * client country and industry. The template states both in a fixed format, but
 * there is nowhere on TalentProfile to put them (gap analysis P1-2, P1-3), so
 * they wait for the schema work rather than being parsed and discarded.
 */

export const SECTIONS = [
  "CONTACT",
  "AVAILABILITY & RATE",
  "HEADLINE",
  "SUMMARY",
  "WORK EXPERIENCE",
  "TOOLS & PLATFORMS",
  "FUNCTIONS I CAN OWN",
  "WORK SETUP",
  "LANGUAGE & COMMUNICATION",
  "EDUCATION & CERTIFICATIONS",
  "PORTFOLIO & REFERENCES",
] as const;

export type Section = (typeof SECTIONS)[number];
export type Sections = Partial<Record<Section, string>>;

/**
 * A resume needs this many headings before we treat it as template-following.
 * One or two matches is a coincidence — plenty of ordinary resumes have a line
 * reading "SUMMARY" — and acting on a coincidence would apply the template's
 * strict field parsing to a document that never opted into it.
 */
const MIN_ANCHORS = 4;

/** Longest heading is 26 chars; a body line this short that matches is a heading. */
const MAX_HEADING_LENGTH = 40;

const canonical = (line: string): string =>
  line
    .toUpperCase()
    .replace(/\bAND\b/g, "&")
    .replace(/[^A-Z& ]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const HEADINGS = new Map<string, Section>(SECTIONS.map((s) => [canonical(s), s]));

/**
 * Splits a resume at its section headings. Returns null when the document does
 * not follow the template, which is the signal to fall back to whole-document
 * extraction — the path every migrated profile takes.
 */
export function splitSections(text: string): Sections | null {
  const out: Sections = {};
  let current: Section | null = null;
  let found = 0;

  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    const heading =
      trimmed.length > 0 && trimmed.length <= MAX_HEADING_LENGTH
        ? HEADINGS.get(canonical(trimmed))
        : undefined;

    if (heading) {
      // A repeated heading appends rather than replaces, so a stray duplicate
      // cannot silently delete the first section's content.
      if (out[heading] === undefined) {
        out[heading] = "";
        found++;
      }
      current = heading;
      continue;
    }
    if (current) out[current] += `${line}\n`;
  }

  if (found < MIN_ANCHORS) return null;
  for (const key of Object.keys(out) as Section[]) out[key] = out[key]?.trim();
  return out;
}

/** Facts read straight off the page, with no model in the loop. */
export type TemplateFacts = {
  rateUsd: number | null;
  hoursPerWeek: number | null;
  shiftWindows: string | null;
  earliestStartDays: number | null;
  headline: string | null;
  summary: string | null;
  city: string | null;
  tools: string | null;
};

/** `Label: value` on its own line, anywhere in the section. */
function labelled(block: string | undefined, label: RegExp): string | null {
  if (!block) return null;
  for (const line of block.split(/\r?\n/)) {
    const m = line.match(label);
    if (m?.[1]) {
      const value = m[1].trim().replace(/\s+/g, " ");
      // The template ships as a fillable skeleton; an unfilled "[ ]" is not an
      // answer, and treating it as one would write "[ ]" into a live profile.
      if (value && !/^\[.*\]$/.test(value)) return value;
    }
  }
  return null;
}

const firstNumber = (v: string | null): number | null => {
  const m = v?.match(/\d+(?:\.\d+)?/);
  return m ? Number(m[0]) : null;
};

/**
 * "immediate" → 0, "2 weeks" → 14, "30 days" → 30, "1 month" → 30.
 * Anything it cannot read stays null rather than becoming a guessed number a
 * hard filter would later act on.
 */
function startDays(value: string | null): number | null {
  if (!value) return null;
  const v = value.toLowerCase();
  if (/\b(immediate|immediately|now|asap)\b/.test(v)) return 0;
  const n = firstNumber(v);
  if (n == null) return null;
  if (/week/.test(v)) return Math.round(n * 7);
  if (/month/.test(v)) return Math.round(n * 30);
  if (/day/.test(v)) return Math.round(n);
  return null;
}

export function readTemplateFacts(sections: Sections): TemplateFacts {
  const availability = sections["AVAILABILITY & RATE"];

  // "Cebu City, Cebu, Philippines" — the city is the first field on the line.
  const cityLine = sections.CONTACT?.split(/\r?\n/).find((l) => /philippines/i.test(l));
  const city = cityLine?.split(",")[0]?.trim() || null;

  const firstLine = (block: string | undefined): string | null => {
    const line = block
      ?.split(/\r?\n/)
      .map((l) => l.trim())
      .find(Boolean);
    return line && !/^\[.*\]$/.test(line) ? line : null;
  };

  return {
    rateUsd: firstNumber(labelled(availability, /^\s*rate\s*:\s*(.+)$/i)),
    hoursPerWeek: firstNumber(labelled(availability, /^\s*hours\s+available\s*:\s*(.+)$/i)),
    shiftWindows: labelled(availability, /^\s*shift\s+windows?[^:]*:\s*(.+)$/i),
    earliestStartDays: startDays(labelled(availability, /^\s*earliest\s+start\s*:\s*(.+)$/i)),
    headline: firstLine(sections.HEADLINE),
    // The summary is prose across several lines, unlike every other field here.
    summary: sections.SUMMARY?.replace(/\s+/g, " ").trim() || null,
    city,
    tools: sections["TOOLS & PLATFORMS"]?.replace(/\s*\n\s*/g, "; ").trim() || null,
  };
}

/**
 * Re-serialises the split document as labelled blocks for the extractor.
 *
 * Same content, explicit structure: the model is told which block is work
 * experience rather than inferring it from layout, which is the layout
 * sensitivity the template exists to remove.
 */
export function labelledBlocks(sections: Sections): string {
  return SECTIONS.filter((s) => sections[s])
    .map((s) => `## ${s}\n${sections[s]}`)
    .join("\n\n");
}

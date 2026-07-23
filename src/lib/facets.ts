/**
 * Facet text builders — pure, no db, no network, no server-only — so the
 * backfill script and eval harness can import the exact text production embeds.
 *
 * One profile becomes three embeddings instead of one blended blob: a JD's
 * skill requirements compare against the skills facet, not a summary paragraph
 * that happens to mention a city. Everything builds from the DB row shape
 * (Skill/Engagement rows + scalar columns), never the resume file, so migrated
 * profiles with no resume backfill identically.
 */

type FacetProfile = {
  yearsExperience?: number | null;
  education?: string | null;
  certifications?: string | null;
  tools?: string | null;
  englishLevel?: string | null;
  availability?: string | null;
  committedHours?: number | null;
  preferredOverlap?: string | null;
  noticePeriodDays?: number | null;
  skills: { name: string; confirmed?: boolean }[];
  engagements: { role: string; company: string; span?: string | null; highlights?: string[] }[];
};

export function buildFacetTexts(p: FacetProfile): {
  skills: string;
  experience: string;
  prefs: string;
} {
  const confirmed = p.skills.filter((s) => s.confirmed).map((s) => s.name);
  const skills = [
    `Skills: ${p.skills.map((s) => s.name).join(", ")}`,
    confirmed.length ? `Confirmed skills: ${confirmed.join(", ")}` : "",
    p.tools ? `Tools: ${p.tools}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  // Education folds in here — too thin to carry a vector of its own.
  const experience = [
    `Experience: ${p.engagements
      .map((e) =>
        [
          `${e.role} at ${e.company}`,
          e.span ? `(${e.span})` : "",
          e.highlights?.length ? `— ${e.highlights.join("; ")}` : "",
        ]
          .filter(Boolean)
          .join(" "),
      )
      .join("; ")}`,
    p.education ? `Education: ${p.education}` : "",
    p.certifications ? `Certifications: ${p.certifications}` : "",
    p.yearsExperience ? `${p.yearsExperience} years experience` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const prefs = [
    p.availability ? `Availability: ${p.availability}` : "",
    p.committedHours ? `${p.committedHours} hours per week already committed` : "",
    p.preferredOverlap ? `Timezone overlap: ${p.preferredOverlap}` : "",
    p.noticePeriodDays != null ? `Notice period: ${p.noticePeriodDays} days` : "",
    p.englishLevel ? `English: ${p.englishLevel}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  return { skills, experience, prefs };
}

/**
 * The JD side. `role` is the whole-JD text — the hnsw pool cut AND the query
 * vector for the experience and prefs facets. `skills` is the dedicated query
 * for the skills facet. Rates are never embedded — scoreRate is numeric.
 */
export function jdFacetTexts(jd: {
  title: string;
  mustHaves: string[];
  niceToHaves?: string[];
  hoursPerWeek?: number | null;
  overlap?: string | null;
}): { skills: string; role: string } {
  const nice = jd.niceToHaves ?? [];
  const skills =
    [
      jd.mustHaves.length ? `Must have: ${jd.mustHaves.join(", ")}` : "",
      nice.length ? `Nice to have: ${nice.join(", ")}` : "",
    ]
      .filter(Boolean)
      .join("\n") || jd.title; // requirement-less JD (admin rematch edge): title is the query
  const role = [
    jd.title,
    `Must have: ${jd.mustHaves.join(", ")}`,
    nice.length ? `Nice to have: ${nice.join(", ")}` : "",
    jd.hoursPerWeek ? `${jd.hoursPerWeek} hours per week` : "",
    jd.overlap ? `Timezone overlap: ${jd.overlap}` : "",
  ]
    .filter(Boolean)
    .join("\n");
  return { skills, role };
}

/**
 * Blend facet cosine distances into one similarity. Skills dominate because
 * they carry the hiring decision; prefs is a light nudge. For a profile whose
 * facet columns are NULL, all three distances COALESCE to the whole-profile
 * distance and this reduces to the old 1 - d — the upgrade is invisible until
 * the backfill runs.
 */
export const FACET_BLEND = { skills: 0.5, experience: 0.35, prefs: 0.15 } as const;

export function blendSimilarity(dskills: number, dexp: number, dprefs: number): number {
  return (
    1 -
    (FACET_BLEND.skills * dskills + FACET_BLEND.experience * dexp + FACET_BLEND.prefs * dprefs)
  );
}

import "server-only";
import { z } from "zod";
import { HttpError } from "./session";
import { MODELS, openai } from "./openai";

/**
 * The presigned PUT carries no length condition, so the size declared when
 * requesting the URL is a claim, not a constraint. This is where it becomes one.
 */
export const MAX_RESUME_BYTES = 5 * 1024 * 1024;

export async function extractText(buf: Buffer, filename: string): Promise<string> {
  if (buf.byteLength > MAX_RESUME_BYTES) {
    throw new HttpError(413, "Resume must be under 5MB");
  }
  const ext = filename.toLowerCase().split(".").pop();
  if (ext === "pdf") {
    const { extractText: pdfText, getDocumentProxy } = await import("unpdf");
    const pdf = await getDocumentProxy(new Uint8Array(buf));
    const { text } = await pdfText(pdf, { mergePages: true });
    return text;
  }
  if (ext === "docx" || ext === "doc") {
    const mammoth = await import("mammoth");
    const { value } = await mammoth.extractRawText({ buffer: buf });
    return value;
  }
  if (ext === "txt") return buf.toString("utf8");
  throw new HttpError(415, "Resume must be PDF, DOC, DOCX, or TXT");
}

export const ParsedResume = z.object({
  headline: z.string().describe("One line, role + specialty. No fluff."),
  summary: z.string().describe("2-3 sentences, factual, first person avoided"),
  city: z.string().nullable(),
  yearsExperience: z.number().int().min(0).max(60),
  suggestedRateUsd: z.number().min(1).max(200).nullable(),
  skills: z.array(z.string()).max(20),
  engagements: z
    .array(
      z.object({
        role: z.string(),
        company: z.string(),
        span: z.string().describe('e.g. "2022 - 2025"'),
      }),
    )
    .max(12),
  // Everything below is what the gap step would otherwise have to ask for.
  // Extracting it here is how a rich resume gets a three-question wizard.
  portfolioUrl: z.string().nullable().describe("Personal site or portfolio, absolute http(s) URL"),
  linkedinUrl: z.string().nullable(),
  githubUrl: z.string().nullable(),
  education: z.string().nullable().describe('Highest attainment, e.g. "BS Nursing, UST"'),
  englishLevel: z
    .string()
    .nullable()
    .describe("native | fluent | conversational | basic, only if the resume states it"),
  tools: z.string().nullable().describe("Comma-separated software the resume names"),
  certifications: z.string().nullable().describe("Comma-separated, only real named certifications"),
});
export type ParsedResume = z.infer<typeof ParsedResume>;

/** Only http/https survive. Employers render these — javascript: and data: must not. */
export function isHttpUrl(value: string): boolean {
  try {
    const { protocol } = new URL(value);
    return protocol === "http:" || protocol === "https:";
  } catch {
    return false;
  }
}

const cleanUrl = (v: string | null): string | null => (v && isHttpUrl(v.trim()) ? v.trim() : null);

/** Model output is a guess, not input we trust — drop anything that isn't a real link. */
export function sanitizeParsedUrls(p: ParsedResume): ParsedResume {
  return {
    ...p,
    portfolioUrl: cleanUrl(p.portfolioUrl),
    linkedinUrl: cleanUrl(p.linkedinUrl),
    githubUrl: cleanUrl(p.githubUrl),
  };
}

export type GapKey =
  | "headline"
  | "summary"
  | "city"
  | "skills"
  | "engagements"
  | "links"
  | "tools"
  | "education"
  | "english"
  | "certifications"
  | "rate";

type GapProfile = {
  headline?: string | null;
  summary?: string | null;
  city?: string | null;
  rateUsd?: number | null;
  portfolioUrl?: string | null;
  linkedinUrl?: string | null;
  githubUrl?: string | null;
  education?: string | null;
  englishLevel?: string | null;
  tools?: string | null;
  certifications?: string | null;
};

const words = (s: string | null | undefined) => (s ?? "").trim().split(/\s+/).filter(Boolean).length;

/**
 * What the resume did NOT answer. The wizard asks for exactly this and nothing
 * else — a thin one-pager produces a long list, a rich CV produces almost none.
 *
 * "Weak" matters as much as "missing": a two-word headline parsed out of a
 * letterhead is not a headline, so it stays a gap and gets confirmed by hand.
 */
export function computeGaps(
  profile: GapProfile,
  skills: unknown[],
  engagements: unknown[],
): GapKey[] {
  const gaps: GapKey[] = [];
  if (words(profile.headline) < 3) gaps.push("headline");
  if (words(profile.summary) < 12) gaps.push("summary");
  if (!profile.city?.trim()) gaps.push("city");
  if (skills.length === 0) gaps.push("skills");
  if (engagements.length === 0) gaps.push("engagements");
  // Any one link answers this — we are asking for evidence, not a set.
  if (!profile.portfolioUrl && !profile.linkedinUrl && !profile.githubUrl) gaps.push("links");
  if (!profile.tools?.trim()) gaps.push("tools");
  if (!profile.education?.trim()) gaps.push("education");
  if (!profile.englishLevel?.trim()) gaps.push("english");
  if (!profile.certifications?.trim()) gaps.push("certifications");
  if (!profile.rateUsd) gaps.push("rate");
  return gaps;
}

const SYSTEM = `You build standing talent profiles for shortlisted.ph, a Philippine remote-hiring platform.

Extract ONLY what the resume actually supports. Rules:
- Never invent skills, employers, dates, or seniority. Omit rather than guess.
- Skills: concrete tools and capabilities (e.g. "Dentrix", "insurance verification"), not soft-skill filler.
- suggestedRateUsd: realistic USD/hour for this experience level in the PH remote market, or null if unclear.
- Links: copy them exactly as written, absolute http(s) only. Never reconstruct a URL from a name or handle.
- education, certifications, tools, englishLevel: null unless the resume states them. A degree is not implied by a job title, and English proficiency is not implied by the resume being in English.
- Everything you output is shown to employers as the candidate's claim, so accuracy beats flattery.`;

export async function parseResume(text: string): Promise<ParsedResume> {
  if (text.trim().length < 100) throw new HttpError(422, "Could not read enough text from that file");

  const res = await openai().responses.parse({
    model: MODELS.extract,
    input: [
      { role: "system", content: SYSTEM },
      { role: "user", content: text.slice(0, 20000) },
    ],
    text: { format: { type: "json_schema", name: "profile", schema: z.toJSONSchema(ParsedResume), strict: false } },
  });

  const raw = res.output_text;
  if (!raw) throw new HttpError(502, "Extraction returned nothing");
  return sanitizeParsedUrls(ParsedResume.parse(JSON.parse(raw)));
}

// Single owner is scoring.ts — profile writes and match scoring must normalize
// identically or skills silently stop matching.
export { normalizeSkill } from "./scoring";

/** One text blob per profile — what gets embedded for matching. */
export function profileEmbedText(p: {
  headline?: string | null;
  summary?: string | null;
  city?: string | null;
  yearsExperience?: number | null;
  skills: { name: string }[];
  engagements: { role: string; company: string }[];
}): string {
  return [
    p.headline ?? "",
    p.summary ?? "",
    p.city ? `Location: ${p.city}` : "",
    p.yearsExperience ? `${p.yearsExperience} years experience` : "",
    `Skills: ${p.skills.map((s) => s.name).join(", ")}`,
    `Experience: ${p.engagements.map((e) => `${e.role} at ${e.company}`).join("; ")}`,
  ]
    .filter(Boolean)
    .join("\n");
}

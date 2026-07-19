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
});
export type ParsedResume = z.infer<typeof ParsedResume>;

const SYSTEM = `You build standing talent profiles for shortlisted.ph, a Philippine remote-hiring platform.

Extract ONLY what the resume actually supports. Rules:
- Never invent skills, employers, dates, or seniority. Omit rather than guess.
- Skills: concrete tools and capabilities (e.g. "Dentrix", "insurance verification"), not soft-skill filler.
- suggestedRateUsd: realistic USD/hour for this experience level in the PH remote market, or null if unclear.
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
  return ParsedResume.parse(JSON.parse(raw));
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

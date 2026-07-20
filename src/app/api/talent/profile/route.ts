import { z } from "zod";
import { db } from "@/lib/db";
import { fail, ok, parseBody } from "@/lib/api";
import { isHttpUrl, normalizeSkill } from "@/lib/resume";
import { requireRole, requireTalentProfile } from "@/lib/session";

export async function GET() {
  try {
    const user = await requireRole("talent");
    const profile = await db.talentProfile.findUnique({
      where: { userId: user.id },
      include: {
        skills: true,
        engagements: true,
        rateChanges: { orderBy: { changedAt: "desc" }, take: 10 },
      },
    });
    return ok({ profile });
  } catch (e) {
    return fail(e);
  }
}

/**
 * These are rendered to employers as links, so only absolute http(s) survives.
 * Empty string is how the client says "clear this" — it stores as null.
 */
const webUrl = z
  .union([
    z.literal(""),
    z.string().trim().max(300).refine(isHttpUrl, "Links must start with http:// or https://"),
  ])
  .transform((v) => (v === "" ? null : v));

const optionalText = (max: number) =>
  z
    .union([z.literal(""), z.string().trim().max(max)])
    .transform((v) => (v === "" ? null : v))
    .optional();

const Patch = z.object({
  headline: z.string().max(160).optional(),
  summary: z.string().max(2000).optional(),
  city: z.string().max(120).optional(),
  yearsExperience: z.number().int().min(0).max(60).optional(),
  availability: z.enum(["open", "partial", "booked"]).optional(),
  committedHours: z.number().int().min(0).max(80).optional(),
  visibility: z.boolean().optional(),
  portfolioUrl: webUrl.optional(),
  linkedinUrl: webUrl.optional(),
  githubUrl: webUrl.optional(),
  education: optionalText(200),
  englishLevel: z.enum(["native", "fluent", "conversational", "basic"]).nullish(),
  tools: optionalText(400),
  certifications: optionalText(400),
  preferredOverlap: optionalText(80),
  skills: z.array(z.string().min(1).max(60)).max(20).optional(),
  engagements: z
    .array(z.object({ role: z.string().max(120), company: z.string().max(120), span: z.string().max(60) }))
    .max(12)
    .optional(),
});

/** Rate is deliberately NOT editable here — see /api/talent/rate for the 30-day lock. */
export async function PATCH(req: Request) {
  try {
    const user = await requireRole("talent");
    const profile = await requireTalentProfile(user.id);
    const body = await parseBody(req, Patch);
    const { skills, engagements, ...scalars } = body;

    await db.$transaction(async (tx) => {
      if (skills) {
        // Diff rather than replace: a wipe-and-recreate would silently drop the
        // confirmed flag off every surviving skill, and confirmation is evidence.
        const kept = new Map(skills.map((name) => [normalizeSkill(name), name]));
        const current = await tx.skill.findMany({ where: { profileId: profile.id } });
        const removed = current.filter(
          (s) => !kept.has(s.normalizedName) && !s.confirmed,
        );
        if (removed.length) {
          await tx.skill.deleteMany({ where: { id: { in: removed.map((s) => s.id) } } });
        }
        const have = new Set(current.map((s) => s.normalizedName));
        const added = [...kept].filter(([norm]) => norm && !have.has(norm));
        if (added.length) {
          await tx.skill.createMany({
            data: added.map(([normalizedName, name]) => ({
              profileId: profile.id,
              name,
              normalizedName,
            })),
          });
        }
      }
      if (engagements) {
        const key = (e: { role: string; company: string }) =>
          `${normalizeSkill(e.role)}|${normalizeSkill(e.company)}`;
        const kept = new Map(engagements.map((e) => [key(e), e]));
        const current = await tx.engagement.findMany({ where: { profileId: profile.id } });
        // A confirmed engagement is mutual evidence — the talent alone cannot delete it.
        const removed = current.filter(
          (e) => !kept.has(key(e)) && e.outcome !== "confirmed",
        );
        if (removed.length) {
          await tx.engagement.deleteMany({ where: { id: { in: removed.map((e) => e.id) } } });
        }
        const have = new Set(current.map(key));
        const added = [...kept].filter(([k]) => !have.has(k));
        if (added.length) {
          await tx.engagement.createMany({
            data: added.map(([, e]) => ({ ...e, profileId: profile.id })),
          });
        }
      }
      await tx.talentProfile.update({
        where: { id: profile.id },
        data: { ...scalars, lastEditedAt: new Date() },
      });
    });

    return ok({ updated: true });
  } catch (e) {
    return fail(e);
  }
}

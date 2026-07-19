import { z } from "zod";
import { db } from "@/lib/db";
import { fail, ok, parseBody } from "@/lib/api";
import { normalizeSkill } from "@/lib/resume";
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

const Patch = z.object({
  headline: z.string().max(160).optional(),
  summary: z.string().max(2000).optional(),
  city: z.string().max(120).optional(),
  yearsExperience: z.number().int().min(0).max(60).optional(),
  availability: z.enum(["open", "partial", "booked"]).optional(),
  committedHours: z.number().int().min(0).max(80).optional(),
  visibility: z.boolean().optional(),
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
        await tx.skill.deleteMany({ where: { profileId: profile.id } });
        await tx.skill.createMany({
          data: skills.map((name) => ({
            profileId: profile.id,
            name,
            normalizedName: normalizeSkill(name),
          })),
        });
      }
      if (engagements) {
        await tx.engagement.deleteMany({ where: { profileId: profile.id } });
        await tx.engagement.createMany({
          data: engagements.map((e) => ({ ...e, profileId: profile.id })),
        });
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

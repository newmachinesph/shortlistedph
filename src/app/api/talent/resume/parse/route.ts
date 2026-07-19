import { z } from "zod";
import { db } from "@/lib/db";
import { fail, ok, parseBody } from "@/lib/api";
import { getObjectBuffer } from "@/lib/r2";
import { extractText, normalizeSkill, parseResume } from "@/lib/resume";
import { HttpError, requireRole, requireTalentProfile } from "@/lib/session";

const Body = z.object({ key: z.string().min(1) });

/** Reads the uploaded resume, extracts a draft profile, saves it UNPUBLISHED. */
export async function POST(req: Request) {
  try {
    const user = await requireRole("talent");
    const profile = await requireTalentProfile(user.id);
    const { key } = await parseBody(req, Body);

    // Ownership check — the key must live under this profile's prefix.
    if (!key.startsWith(`resumes/${profile.id}/`)) {
      throw new HttpError(403, "That file does not belong to this profile");
    }

    const buf = await getObjectBuffer(key);
    const text = await extractText(buf, key);
    const parsed = await parseResume(text);

    await db.$transaction([
      db.skill.deleteMany({ where: { profileId: profile.id } }),
      db.engagement.deleteMany({ where: { profileId: profile.id } }),
      db.talentProfile.update({
        where: { id: profile.id },
        data: {
          headline: parsed.headline,
          summary: parsed.summary,
          city: parsed.city,
          yearsExperience: parsed.yearsExperience,
          rateUsd: profile.rateUsd ?? parsed.suggestedRateUsd,
          resumeKey: key,
          lastEditedAt: new Date(),
          skills: {
            create: parsed.skills.map((name) => ({ name, normalizedName: normalizeSkill(name) })),
          },
          engagements: { create: parsed.engagements },
        },
      }),
    ]);

    return ok({ parsed });
  } catch (e) {
    return fail(e);
  }
}

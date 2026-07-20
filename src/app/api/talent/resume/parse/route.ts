import { z } from "zod";
import { db } from "@/lib/db";
import { fail, ok, parseBody } from "@/lib/api";
import { getObjectBuffer } from "@/lib/r2";
import { extractText, normalizeSkill, parseResume } from "@/lib/resume";
import { HttpError, requireRole, requireTalentProfile } from "@/lib/session";

const Body = z.object({ key: z.string().min(1) });

/** Same shape the merge dedupes on, used for both stored and parsed rows. */
const engagementKey = (e: { role: string; company: string }) =>
  `${normalizeSkill(e.role)}|${normalizeSkill(e.company)}`;

/**
 * Reads the uploaded resume, extracts a draft profile, saves it UNPUBLISHED.
 *
 * Skills and engagements MERGE, they do not replace. A migrated profile can
 * carry years of imported history plus outcome-confirmed evidence, and a resume
 * is only ever a guess about the same person — re-uploading one must never be
 * able to delete a row the user did not ask to remove.
 */
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

    const [existingSkills, existingEngagements] = await Promise.all([
      db.skill.findMany({ where: { profileId: profile.id }, select: { normalizedName: true } }),
      db.engagement.findMany({
        where: { profileId: profile.id },
        select: { role: true, company: true },
      }),
    ]);

    const haveSkill = new Set(existingSkills.map((s) => s.normalizedName));
    const newSkills = parsed.skills
      .map((name) => ({ name, normalizedName: normalizeSkill(name) }))
      .filter((s) => s.normalizedName && !haveSkill.has(s.normalizedName))
      // A resume can name the same skill twice in different casing.
      .filter((s, i, all) => all.findIndex((o) => o.normalizedName === s.normalizedName) === i);

    const haveEngagement = new Set(existingEngagements.map(engagementKey));
    const newEngagements = parsed.engagements
      .filter((e) => !haveEngagement.has(engagementKey(e)))
      .filter((e, i, all) => all.findIndex((o) => engagementKey(o) === engagementKey(e)) === i);

    await db.talentProfile.update({
      where: { id: profile.id },
      data: {
        headline: parsed.headline,
        summary: parsed.summary,
        city: parsed.city,
        yearsExperience: parsed.yearsExperience,
        rateUsd: profile.rateUsd ?? parsed.suggestedRateUsd,
        // Parsed values only ever FILL a blank field here. Anything the user
        // already answered outranks a fresh guess about the same fact.
        portfolioUrl: profile.portfolioUrl ?? parsed.portfolioUrl,
        linkedinUrl: profile.linkedinUrl ?? parsed.linkedinUrl,
        githubUrl: profile.githubUrl ?? parsed.githubUrl,
        education: profile.education ?? parsed.education,
        englishLevel: profile.englishLevel ?? parsed.englishLevel,
        tools: profile.tools ?? parsed.tools,
        certifications: profile.certifications ?? parsed.certifications,
        resumeKey: key,
        lastEditedAt: new Date(),
        skills: { create: newSkills },
        engagements: { create: newEngagements },
      },
    });

    return ok({ parsed });
  } catch (e) {
    return fail(e);
  }
}

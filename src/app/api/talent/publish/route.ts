import { db } from "@/lib/db";
import { fail, ok } from "@/lib/api";
import { buildFacetTexts } from "@/lib/facets";
import { embedMany, toVectorLiteral } from "@/lib/openai";
import { profileEmbedText } from "@/lib/resume";
import { HttpError, requireRole, requireTalentProfile } from "@/lib/session";

/** Publishing = embedding. An unembedded profile can never appear in a slate. */
export async function POST() {
  try {
    const user = await requireRole("talent");
    const base = await requireTalentProfile(user.id);

    const profile = await db.talentProfile.findUniqueOrThrow({
      where: { id: base.id },
      include: { skills: true, engagements: true },
    });

    const missing: string[] = [];
    if (!profile.headline) missing.push("headline");
    if (!profile.rateUsd) missing.push("standing rate");
    if (profile.skills.length === 0) missing.push("at least one skill");
    if (missing.length) throw new HttpError(422, `Add ${missing.join(", ")} before publishing`);

    // One batch call: whole-profile vector (the hnsw pool cut) + three facets.
    const facets = buildFacetTexts(profile);
    const [whole, fSkills, fExp, fPrefs] = await embedMany([
      profileEmbedText(profile),
      facets.skills,
      facets.experience,
      facets.prefs,
    ]);

    await db.$executeRawUnsafe(
      `UPDATE "TalentProfile"
          SET embedding = $1::vector,
              "embeddingSkills" = $2::vector,
              "embeddingExperience" = $3::vector,
              "embeddingPrefs" = $4::vector,
              "publishedAt" = COALESCE("publishedAt", now())
        WHERE id = $5`,
      toVectorLiteral(whole),
      toVectorLiteral(fSkills),
      toVectorLiteral(fExp),
      toVectorLiteral(fPrefs),
      profile.id,
    );

    return ok({ published: true });
  } catch (e) {
    return fail(e);
  }
}

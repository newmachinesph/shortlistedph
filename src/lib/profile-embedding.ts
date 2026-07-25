import "server-only";
import { db } from "./db";
import { buildFacetTexts } from "./facets";
import { embedMany, toVectorLiteral } from "./openai";
import { profileEmbedText } from "./resume";

/**
 * (Re)computes a profile's four vectors — whole-profile plus the three facet
 * embeddings — from its CURRENT text. One owner for the embed block, shared by
 * publish (first embedding) and every later edit of a published profile, so a
 * talent who rewrites their headline or skills doesn't drift away from the
 * vector the matcher ranks them by.
 *
 * `markPublished` additionally stamps publishedAt on first publish; re-embeds
 * leave it untouched.
 */
export async function refreshProfileEmbeddings(
  profileId: string,
  { markPublished = false } = {},
) {
  const profile = await db.talentProfile.findUniqueOrThrow({
    where: { id: profileId },
    include: { skills: true, engagements: true },
  });

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
            "embeddingPrefs" = $4::vector
            ${markPublished ? `, "publishedAt" = COALESCE("publishedAt", now())` : ""}
      WHERE id = $5`,
    toVectorLiteral(whole),
    toVectorLiteral(fSkills),
    toVectorLiteral(fExp),
    toVectorLiteral(fPrefs),
    profile.id,
  );
}

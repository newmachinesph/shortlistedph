/**
 * Backfills facet embeddings: skills / experience / prefs vectors for
 * published talent profiles, plus the skills-facet vector for published JDs.
 *
 *   node --experimental-strip-types scripts/backfill-facet-embeddings.ts [--force] [--limit=N]
 *
 * Idempotent: rows missing any facet column are (re)computed; fully-populated
 * rows are skipped unless --force. Facet text builds from DB rows, never the
 * resume file, so migrated profiles that never uploaded one backfill the same
 * way (see src/lib/facets.ts).
 */
import { config } from "dotenv";
import OpenAI from "openai";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { buildFacetTexts, jdFacetTexts } from "../src/lib/facets.ts";

// No override: a shell-set DATABASE_URL (the prod run) must beat .env.local.
config({ path: ".env.local" });

const BATCH = 50;
const FORCE = process.argv.includes("--force");
const LIMIT = Number(process.argv.find((a) => a.startsWith("--limit="))?.split("=")[1] ?? 0);

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

const toVec = (v: number[]) => `[${v.join(",")}]`;

async function embedBatch(inputs: string[]): Promise<number[][]> {
  const res = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: inputs.map((t) => t.slice(0, 8000)),
  });
  return res.data.map((d) => d.embedding);
}

async function backfillProfiles() {
  const missing = FORCE
    ? ""
    : `AND ("embeddingSkills" IS NULL OR "embeddingExperience" IS NULL OR "embeddingPrefs" IS NULL)`;
  const pending = await db.$queryRawUnsafe<{ id: string }[]>(
    `SELECT id FROM "TalentProfile" WHERE "publishedAt" IS NOT NULL ${missing} ${LIMIT ? `LIMIT ${LIMIT}` : ""}`,
  );
  console.log(`${pending.length} profiles need facet embeddings`);

  let done = 0;
  for (let i = 0; i < pending.length; i += BATCH) {
    const ids = pending.slice(i, i + BATCH).map((p) => p.id);
    const rows = await db.talentProfile.findMany({
      where: { id: { in: ids } },
      include: { skills: true, engagements: true },
    });
    const facets = rows.map((p) => buildFacetTexts(p));
    const vecs = await embedBatch(facets.flatMap((f) => [f.skills, f.experience, f.prefs]));

    for (const [j, p] of rows.entries()) {
      await db.$executeRawUnsafe(
        `UPDATE "TalentProfile"
            SET "embeddingSkills" = $1::vector,
                "embeddingExperience" = $2::vector,
                "embeddingPrefs" = $3::vector
          WHERE id = $4`,
        toVec(vecs[j * 3]),
        toVec(vecs[j * 3 + 1]),
        toVec(vecs[j * 3 + 2]),
        p.id,
      );
      done++;
    }
    console.log(`  profiles ${done}/${pending.length}`);
  }
}

async function backfillJds() {
  const missing = FORCE ? "" : `AND "embeddingSkills" IS NULL`;
  const pending = await db.$queryRawUnsafe<{ id: string }[]>(
    `SELECT id FROM "JobDescription" WHERE "publishedAt" IS NOT NULL ${missing}`,
  );
  console.log(`${pending.length} JDs need a skills-facet embedding`);

  let done = 0;
  for (let i = 0; i < pending.length; i += BATCH) {
    const ids = pending.slice(i, i + BATCH).map((j) => j.id);
    const rows = await db.jobDescription.findMany({ where: { id: { in: ids } } });
    const vecs = await embedBatch(rows.map((j) => jdFacetTexts(j).skills));

    for (const [j, row] of rows.entries()) {
      await db.$executeRawUnsafe(
        `UPDATE "JobDescription" SET "embeddingSkills" = $1::vector WHERE id = $2`,
        toVec(vecs[j]),
        row.id,
      );
      done++;
    }
    console.log(`  JDs ${done}/${pending.length}`);
  }
}

async function main() {
  await backfillProfiles();
  await backfillJds();
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

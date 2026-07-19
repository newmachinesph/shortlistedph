/**
 * Backfills embeddings for migrated profiles.
 *
 *   node --experimental-strip-types scripts/embed-profiles.ts [--limit=N]
 *
 * Embeddings are derived data used for internal ranking only. Embedding a
 * profile does NOT publish it — the matching query still requires
 * publishedAt IS NOT NULL, so nobody appears in an employer slate until they
 * consent at re-activation. This exists so match quality can be measured
 * offline before anyone is exposed.
 */
import { config } from "dotenv";
import OpenAI from "openai";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

config({ path: ".env.local", override: true });

const BATCH = 100;
const LIMIT = Number(process.argv.find((a) => a.startsWith("--limit="))?.split("=")[1] ?? 0);

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

function embedText(p: {
  headline: string | null;
  summary: string | null;
  city: string | null;
  yearsExperience: number;
  skills: { name: string }[];
  engagements: { role: string; company: string }[];
}) {
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

async function main() {
  const pending = await db.$queryRawUnsafe<{ id: string }[]>(
    `SELECT id FROM "TalentProfile" WHERE embedding IS NULL ${LIMIT ? `LIMIT ${LIMIT}` : ""}`,
  );
  console.log(`${pending.length} profiles need embeddings`);

  let done = 0;
  for (let i = 0; i < pending.length; i += BATCH) {
    const ids = pending.slice(i, i + BATCH).map((p) => p.id);
    const profiles = await db.talentProfile.findMany({
      where: { id: { in: ids } },
      include: { skills: true, engagements: true },
    });

    const inputs = profiles.map((p) => embedText(p).slice(0, 8000));
    const res = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: inputs,
    });

    for (const [j, p] of profiles.entries()) {
      const vec = res.data[j]?.embedding;
      if (!vec) continue;
      await db.$executeRawUnsafe(
        `UPDATE "TalentProfile" SET embedding = $1::vector WHERE id = $2`,
        `[${vec.join(",")}]`,
        p.id,
      );
      done++;
    }
    console.log(`  ${done}/${pending.length}`);
  }

  console.log(`embedded ${done}`);
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

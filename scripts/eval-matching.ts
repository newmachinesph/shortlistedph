/**
 * Measures match quality against the real talent pool.
 *
 *   node --experimental-strip-types scripts/eval-matching.ts
 *
 * Read-only, writes nothing, publishes nobody. It deliberately ignores
 * publishedAt so the pool can be evaluated before anyone consents — the
 * product query in matching.ts still enforces it.
 *
 * Imports the real scorers so evaluation can never drift from production.
 */
import { config } from "dotenv";
import OpenAI from "openai";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  composite,
  scoreExperience,
  scoreOverlap,
  scoreRate,
  scoreSkills,
} from "../src/lib/scoring.ts";

config({ path: ".env.local", override: true });

const db = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

const JOBS = [
  {
    title: "Medical VA for a US dental group",
    mustHaves: ["US dental practice experience", "Insurance verification", "Patient scheduling"],
    budgetMin: 8,
    budgetMax: 11,
    hoursPerWeek: 40,
  },
  {
    title: "Senior React engineer, product team",
    mustHaves: ["React", "TypeScript", "PostgreSQL"],
    budgetMin: 18,
    budgetMax: 28,
    hoursPerWeek: 40,
  },
  {
    title: "Bookkeeper for US small businesses",
    mustHaves: ["QuickBooks", "Bank reconciliation", "Month-end close"],
    budgetMin: 8,
    budgetMax: 13,
    hoursPerWeek: 20,
  },
  {
    title: "Amazon PPC specialist",
    mustHaves: ["Amazon PPC", "Helium 10", "Keyword research"],
    budgetMin: 10,
    budgetMax: 16,
    hoursPerWeek: 30,
  },
];

async function main() {
  const [{ count }] = await db.$queryRawUnsafe<{ count: bigint }[]>(
    `SELECT count(*) FROM "TalentProfile" WHERE embedding IS NOT NULL`,
  );
  console.log(`Pool: ${count} embedded profiles\n`);

  for (const jd of JOBS) {
    const text = [jd.title, `Must have: ${jd.mustHaves.join(", ")}`, `${jd.hoursPerWeek} hours per week`].join("\n");
    const { data } = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: text,
    });
    const vec = `[${data[0].embedding.join(",")}]`;

    const pool = await db.$queryRawUnsafe<
      {
        id: string;
        headline: string | null;
        city: string | null;
        yearsExperience: number;
        rateUsd: number | null;
        availability: string;
        committedHours: number;
        similarity: number;
      }[]
    >(
      `SELECT id, headline, city, "yearsExperience", "rateUsd", availability,
              "committedHours", 1 - (embedding <=> $1::vector) AS similarity
         FROM "TalentProfile"
        WHERE embedding IS NOT NULL
        ORDER BY embedding <=> $1::vector
        LIMIT 50`,
      vec,
    );

    const ids = pool.map((p) => p.id);
    const [skills, engagements] = await Promise.all([
      db.skill.findMany({ where: { profileId: { in: ids } } }),
      db.engagement.findMany({ where: { profileId: { in: ids } } }),
    ]);

    const skillsBy = new Map<string, { normalizedName: string; confirmed: boolean }[]>();
    for (const s of skills) {
      const list = skillsBy.get(s.profileId) ?? [];
      list.push(s);
      skillsBy.set(s.profileId, list);
    }
    const engCount = new Map<string, number>();
    for (const e of engagements) {
      if (e.outcome === "confirmed") engCount.set(e.profileId, (engCount.get(e.profileId) ?? 0) + 1);
    }

    const ranked = pool
      .map((c) => {
        const dims = {
          skills: scoreSkills(jd.mustHaves, skillsBy.get(c.id) ?? [], c.similarity),
          rate: scoreRate(c.rateUsd, jd.budgetMin, jd.budgetMax),
          overlap: scoreOverlap(c.availability, c.committedHours, jd.hoursPerWeek),
          experience: scoreExperience(c.yearsExperience, engCount.get(c.id) ?? 0),
        };
        return { c, dims, score: composite(dims) };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    console.log(`━━━ ${jd.title}`);
    console.log(`    budget $${jd.budgetMin}-${jd.budgetMax}/hr · must: ${jd.mustHaves.join(", ")}`);
    for (const [i, r] of ranked.entries()) {
      const headline = (r.c.headline ?? "(no headline)").slice(0, 58);
      console.log(
        `  ${i + 1}. ${String(r.score).padStart(3)}  ${headline.padEnd(60)} ` +
          `$${r.c.rateUsd ?? "?"}/hr ${r.c.yearsExperience}y  ` +
          `[sk ${r.dims.skills} rt ${r.dims.rate} ov ${r.dims.overlap} ex ${r.dims.experience}] ` +
          `sim ${r.c.similarity.toFixed(3)}`,
      );
    }
    console.log();
  }

  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

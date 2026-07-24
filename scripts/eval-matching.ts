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
import { blendSimilarity, jdFacetTexts } from "../src/lib/facets.ts";
import {
  MIN_SLATE_SCORE,
  QUALIFY_SCORE,
  QUALIFY_SKILLS,
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
  {
    title: "Customer support agent for a US SaaS",
    mustHaves: ["Zendesk", "Live chat", "Refunds"],
    budgetMin: 8,
    budgetMax: 12,
    hoursPerWeek: 40,
  },
];

async function main() {
  const [{ count }] = await db.$queryRawUnsafe<{ count: bigint }[]>(
    `SELECT count(*) FROM "TalentProfile" WHERE embedding IS NOT NULL`,
  );
  console.log(`Pool: ${count} embedded profiles\n`);

  for (const jd of JOBS) {
    // Same two query vectors production uses: whole-role text + skills facet.
    const q = jdFacetTexts(jd);
    const { data } = await openai.embeddings.create({
      model: "text-embedding-3-small",
      input: [q.role, q.skills],
    });
    const roleVec = `[${data[0].embedding.join(",")}]`;
    const skillsVec = `[${data[1].embedding.join(",")}]`;

    const pool = await db.$queryRawUnsafe<
      {
        id: string;
        headline: string | null;
        city: string | null;
        yearsExperience: number;
        rateUsd: number | null;
        availability: string;
        committedHours: number;
        dskills: number;
        dexp: number;
        dprefs: number;
      }[]
    >(
      `SELECT id, headline, city, "yearsExperience", "rateUsd", availability,
              "committedHours",
              COALESCE("embeddingSkills" <=> $2::vector, embedding <=> $1::vector) AS dskills,
              COALESCE("embeddingExperience" <=> $1::vector, embedding <=> $1::vector) AS dexp,
              COALESCE("embeddingPrefs" <=> $1::vector, embedding <=> $1::vector) AS dprefs
         FROM "TalentProfile"
        WHERE embedding IS NOT NULL
        ORDER BY embedding <=> $1::vector
        LIMIT 50`,
      roleVec,
      skillsVec,
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
    const rolesBy = new Map<string, string[]>();
    for (const e of engagements) {
      if (e.outcome === "confirmed") engCount.set(e.profileId, (engCount.get(e.profileId) ?? 0) + 1);
      const list = rolesBy.get(e.profileId) ?? [];
      list.push(e.role);
      rolesBy.set(e.profileId, list);
    }

    const ranked = pool
      .map((c) => {
        const sim = blendSimilarity(c.dskills, c.dexp, c.dprefs);
        const dims = {
          skills: scoreSkills(jd.mustHaves, skillsBy.get(c.id) ?? [], sim, {
            headline: c.headline,
            roles: rolesBy.get(c.id) ?? [],
          }),
          rate: scoreRate(c.rateUsd, jd.budgetMin, jd.budgetMax),
          overlap: scoreOverlap(c.availability, c.committedHours, jd.hoursPerWeek),
          experience: scoreExperience(c.yearsExperience, engCount.get(c.id) ?? 0),
        };
        return { c, dims, sim, score: composite(dims) };
      })
      .sort((a, b) => b.score - a.score);

    const isQualified = (r: (typeof ranked)[number]) =>
      r.score >= QUALIFY_SCORE && r.dims.skills >= QUALIFY_SKILLS;
    const eligible = ranked.filter(isQualified);
    const qualified = eligible.slice(0, 5);
    const rejected = ranked.length - eligible.length;
    // Strong counts within the eligible set, mirroring buildSlate — a candidate
    // cannot be "strong" without first qualifying, so counting over all 50
    // produced the impossible "1 qualify, of which 5 strong".
    const strong = eligible.filter((r) => r.score >= MIN_SLATE_SCORE).length;

    console.log(`━━━ ${jd.title}`);
    console.log(`    budget $${jd.budgetMin}-${jd.budgetMax}/hr · must: ${jd.mustHaves.join(", ")}`);
    if (qualified.length === 0) {
      console.log(`    NO QUALIFIED CANDIDATES — ${rejected} below QUALIFY ${QUALIFY_SCORE} (top was ${ranked[0]?.score ?? 0})`);
      console.log();
      continue;
    }
    console.log(`    ${qualified.length} qualify (≥${QUALIFY_SCORE}), of which ${strong} strong (≥${MIN_SLATE_SCORE}); ${rejected} below`);
    for (const [i, r] of qualified.entries()) {
      const headline = (r.c.headline ?? "(no headline)").slice(0, 58);
      console.log(
        `  ${i + 1}. ${String(r.score).padStart(3)}  ${headline.padEnd(60)} ` +
          `$${r.c.rateUsd ?? "?"}/hr ${r.c.yearsExperience}y  ` +
          `[sk ${r.dims.skills} rt ${r.dims.rate} ov ${r.dims.overlap} ex ${r.dims.experience}] ` +
          `sim ${r.sim.toFixed(3)}`,
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

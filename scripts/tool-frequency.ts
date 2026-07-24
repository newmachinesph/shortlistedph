/**
 * Dumps the most common Skill.normalizedName values in the pool, flagging which
 * the alias table already knows. This is how src/lib/tools/aliases.ts gets
 * expanded from real data instead of memory (matching spec §9).
 *
 *   node --experimental-strip-types scripts/tool-frequency.ts        # dev DB
 *   $env:USE_PROD=1; node --experimental-strip-types scripts/tool-frequency.ts  # prod
 *
 * Read-only, writes nothing. Unknown high-frequency tools at the top of the
 * list are the ones worth curating into the table next.
 */
import { config } from "dotenv";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { canonicalizeTool } from "../src/lib/tools/aliases.ts";

config({ path: ".env.local" });

const url = process.env.USE_PROD ? process.env.PROD_DATABASE_URL : process.env.DATABASE_URL;
if (!url) throw new Error("no database url");
const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });

async function main() {
  const rows = await db.$queryRawUnsafe<{ normalizedName: string; n: bigint }[]>(
    `SELECT "normalizedName", count(*) AS n
       FROM "Skill"
      GROUP BY "normalizedName"
      ORDER BY n DESC
      LIMIT 200`,
  );

  let known = 0;
  console.log(`rank  count  known?  normalized`);
  for (const [i, r] of rows.entries()) {
    const canonical = canonicalizeTool(r.normalizedName);
    const isKnown = canonical !== r.normalizedName;
    if (isKnown) known++;
    const mark = isKnown ? `-> ${canonical}` : "  (unmapped)";
    console.log(`${String(i + 1).padStart(4)}  ${String(r.n).padStart(5)}  ${mark.padEnd(28)} ${r.normalizedName}`);
  }
  console.log(`\n${known}/${rows.length} of the top skills are in the alias table.`);
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

/**
 * Measures match quality against the real talent pool.
 *
 *   node --experimental-strip-types scripts/eval-matching.ts
 *
 * Read-only: it ranks, it prints, it writes nothing.
 *
 * Ranking runs through rankQualifiedForJd — the production function itself, not
 * a copy of it. The harness used to reimplement the pool query, the scoring and
 * the rotation, and the live thresholds were calibrated on that divergent
 * pipeline (system-audit P2-15). Importing the real path costs the module hooks
 * below; reimplementing it costs silent mis-calibration of the whole engine.
 */
import { config } from "dotenv";
import Module from "node:module";
import { existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { MIN_SLATE_SCORE, QUALIFY_SCORE, QUALIFY_SKILLS } from "../src/lib/scoring.ts";
import type { Jd } from "../src/lib/matching.ts";

config({ path: ".env.local", override: true });

// src/lib is written for the Next runtime: extensionless specifiers, the
// `server-only` marker, and lib/api reaching for next/server. None of that
// changes how ranking behaves, so it is resolved away here rather than forked.
// A future import in matching.ts's graph fails loudly instead of drifting.
const STUB_SERVER_ONLY = pathToFileURL(`${process.cwd()}/node_modules/server-only/empty.js`).href;
// requireEnv is the only thing the ranking path reaches lib/api for; the rest
// of that module is NextResponse plumbing a CLI has no use for.
const STUB_API =
  "data:text/javascript,export function requireEnv(n){const v=process.env[n];" +
  "if(!v)throw new Error(n+' is not configured');return v;}";

type ResolveContext = { parentURL: string };
type Resolved = { url: string; shortCircuit?: boolean };
type ResolveHook = (
  spec: string,
  ctx: ResolveContext,
  next: (spec: string, ctx: ResolveContext) => Resolved,
) => Resolved;

// @types/node 20 predates module.registerHooks (Node 22.15+); the runtime has it.
const nodeModule = Module as unknown as {
  registerHooks(hooks: { resolve: ResolveHook }): void;
};

nodeModule.registerHooks({
  resolve(spec, ctx, next) {
    if (spec === "server-only") return { url: STUB_SERVER_ONLY, shortCircuit: true };
    if (spec === "./api") return { url: STUB_API, shortCircuit: true };
    if (spec.startsWith("./") || spec.startsWith("../")) {
      const url = new URL(spec, ctx.parentURL);
      if (!/\.[a-z]+$/.test(url.pathname) && existsSync(fileURLToPath(`${url}.ts`))) {
        return next(`${spec}.ts`, ctx);
      }
    }
    return next(spec, ctx);
  },
});

// EVAL_DB=prod runs against the production pool (still read-only). The default
// DATABASE_URL in .env.local is the 2-profile dev DB, which tells you nothing.
const connectionString =
  process.env.EVAL_DB === "prod"
    ? process.env.PROD_DATABASE_URL!
    : process.env.DATABASE_URL!;

const db = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

// EVAL_HARD=1 previews Stage 0 before an operator flips hard_filters_enabled.
// The flag is a DB row and the harness never writes, so the single read the
// ranking path makes is answered here — blunt on purpose, it is the only
// AppSetting that path reads.
const forcedSettings = { findUnique: async () => ({ value: "on" }) };

// lib/db memoises its client on globalThis. Seeding it there is what points the
// production path at the pool under evaluation without lib/db knowing.
(globalThis as unknown as { prisma?: PrismaClient }).prisma =
  process.env.EVAL_HARD === "1"
    ? new Proxy({} as PrismaClient, {
        get: (_t, p) => (p === "appSetting" ? forcedSettings : Reflect.get(db, p, db)),
      })
    : db;

const { SLATE_SIZE, rankQualifiedForJd } = await import("../src/lib/matching.ts");

// Ids are inert here — rankQualifiedForJd never reads them; buildSlate does.
const JOBS: Jd[] = [
  {
    id: "eval-medical-va",
    title: "Medical VA for a US dental group",
    mustHaves: ["US dental practice experience", "Insurance verification", "Patient scheduling"],
    niceToHaves: [],
    budgetMin: 8,
    budgetMax: 11,
    hoursPerWeek: 40,
    overlap: null,
  },
  {
    id: "eval-react",
    title: "Senior React engineer, product team",
    mustHaves: ["React", "TypeScript", "PostgreSQL"],
    niceToHaves: [],
    budgetMin: 18,
    budgetMax: 28,
    hoursPerWeek: 40,
    overlap: null,
  },
  {
    id: "eval-bookkeeper",
    title: "Bookkeeper for US small businesses",
    mustHaves: ["QuickBooks", "Bank reconciliation", "Month-end close"],
    niceToHaves: [],
    budgetMin: 8,
    budgetMax: 13,
    hoursPerWeek: 20,
    overlap: null,
  },
  {
    id: "eval-ppc",
    title: "Amazon PPC specialist",
    mustHaves: ["Amazon PPC", "Helium 10", "Keyword research"],
    niceToHaves: [],
    budgetMin: 10,
    budgetMax: 16,
    hoursPerWeek: 30,
    overlap: null,
  },
  {
    id: "eval-support",
    title: "Customer support agent for a US SaaS",
    mustHaves: ["Zendesk", "Live chat", "Refunds"],
    niceToHaves: [],
    budgetMin: 8,
    budgetMax: 12,
    hoursPerWeek: 40,
    overlap: null,
  },
];

async function main() {
  // The same gates the ranking query applies, so the headline number is the
  // matchable pool rather than every row that happens to carry a vector.
  const [{ count }] = await db.$queryRawUnsafe<{ count: bigint }[]>(
    `SELECT count(*) FROM "TalentProfile" p
       JOIN "user" u ON u.id = p."userId"
      WHERE p."publishedAt" IS NOT NULL
        AND p.visibility = true
        AND p."dormantAt" IS NULL
        AND p.embedding IS NOT NULL
        AND u.status = 'active'`,
  );
  console.log(`Pool: ${count} matchable profiles\n`);

  for (const jd of JOBS) {
    const { scanned, eligible, eliminated } = await rankQualifiedForJd(jd);

    const byReason = new Map<string, number>();
    for (const e of eliminated) byReason.set(e.reason, (byReason.get(e.reason) ?? 0) + 1);
    const strong = eligible.filter((r) => r.score >= MIN_SLATE_SCORE);
    // buildSlate's tiering: strong first in rotation order, merely-eligible
    // only backfills. Showing anything else would show a slate that ships.
    const slate = [...strong, ...eligible.filter((r) => r.score < MIN_SLATE_SCORE)].slice(
      0,
      SLATE_SIZE,
    );

    console.log(`━━━ ${jd.title}`);
    console.log(`    budget $${jd.budgetMin}-${jd.budgetMax}/hr · must: ${jd.mustHaves.join(", ")}`);
    if (eliminated.length) {
      console.log(
        `    stage0: ${eliminated.length} eliminated (${[...byReason]
          .map(([k, n]) => `${k} ${n}`)
          .join(", ")})`,
      );
    }
    if (eligible.length === 0) {
      console.log(
        `    NO QUALIFIED CANDIDATES — ${scanned} scanned, none cleared QUALIFY ${QUALIFY_SCORE} / skills ${QUALIFY_SKILLS}`,
      );
      console.log();
      continue;
    }
    console.log(
      `    ${scanned} scanned · ${eligible.length} qualify (≥${QUALIFY_SCORE}), of which ${strong.length} strong (≥${MIN_SLATE_SCORE})`,
    );
    // The full eligible spread — the calibration view. Sub-threshold scores are
    // no longer visible here: they never leave rankQualifiedForJd.
    console.log(`    eligible scores: ${eligible.map((r) => `${r.score}(sk${r.dims.skills})`).join(" ")}`);
    for (const [i, r] of slate.entries()) {
      const headline = (r.c.headline ?? "(no headline)").slice(0, 58);
      console.log(
        `  ${i + 1}. ${String(r.score).padStart(3)}  ${headline.padEnd(60)} ` +
          `$${r.c.rateUsd ?? "?"}/hr ${r.c.yearsExperience}y  ` +
          `[sk ${r.dims.skills} rt ${r.dims.rate} ov ${r.dims.overlap} ex ${r.dims.experience}] ` +
          `shown ${r.c.shortlistCount}${r.c.verifiedTier === "id_verified" ? " verified" : ""}`,
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

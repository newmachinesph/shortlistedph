/**
 * Runs a SQL file against the dev database, or prod with DB=prod — the same
 * env selection scripts/eval-matching.ts uses. Exists because `prisma db
 * execute` cannot target PROD_DATABASE_URL without exporting it into the
 * shell, and `prisma db push` is banned outright (it drops the hnsw indexes).
 *
 *   node --experimental-strip-types scripts/db-run.ts scripts/<file>.sql
 *   DB=prod node --experimental-strip-types scripts/db-run.ts scripts/<file>.sql
 */
import { readFileSync } from "node:fs";
import { config } from "dotenv";
import pg from "pg";

config({ path: ".env.local", override: true });

const file = process.argv[2];
if (!file || !file.endsWith(".sql")) {
  console.error("Usage: db-run.ts <path-to-sql-file>");
  process.exit(1);
}

const target = process.env.DB === "prod" ? "prod" : "dev";
const connectionString =
  target === "prod" ? process.env.PROD_DATABASE_URL : process.env.DATABASE_URL;
if (!connectionString) {
  console.error(`No ${target === "prod" ? "PROD_DATABASE_URL" : "DATABASE_URL"} in .env.local`);
  process.exit(1);
}

const sql = readFileSync(file, "utf8");
const client = new pg.Client({ connectionString });

try {
  await client.connect();
  await client.query(sql);
  console.log(`OK: ${file} applied to ${target}`);
} finally {
  await client.end();
}

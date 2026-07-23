/**
 * Copies remotetalentph avatars into R2 and points User.image at the CDN.
 *
 *   node --experimental-strip-types scripts/migrate-avatars.ts [--commit] [--force]
 *
 * Sources, in order: the local uploads/ mirror (avatar_<legacyUserId>_<ts>.webp,
 * newest wins), falling back to the uploadthing URL recorded in AvatarUpload.
 * Only avatars that were approved and current on the legacy platform move —
 * the legacy moderation decision is respected.
 *
 * Idempotent: users whose image is already set are skipped without --force.
 * Requires the legacy Postgres (docker) and .env.local R2 credentials.
 */
import "dotenv/config";
import { config } from "dotenv";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { Client } from "pg";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

config({ path: ".env.local" });

const LEGACY_URL =
  process.env.LEGACY_DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/shortlisted";
const UPLOADS_DIR = join(import.meta.dirname, "..", "..", "uploads");

const COMMIT = process.argv.includes("--commit");
const FORCE = process.argv.includes("--force");

const need = (k: string): string => {
  const v = process.env[k];
  if (!v) throw new Error(`${k} missing`);
  return v;
};

const s3 = new S3Client({
  region: "auto",
  endpoint: `https://${need("R2_ACCOUNT_ID")}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: need("R2_ACCESS_KEY_ID"),
    secretAccessKey: need("R2_SECRET_ACCESS_KEY"),
  },
});

/** Newest local mirror file per legacy user id. */
function localAvatars(): Map<string, string> {
  const byUser = new Map<string, { file: string; ts: number }>();
  for (const f of readdirSync(UPLOADS_DIR)) {
    const m = /^avatar_([a-z0-9]+)_(\d+)\.webp$/.exec(f);
    if (!m) continue;
    const ts = Number(m[2]);
    const prev = byUser.get(m[1]);
    if (!prev || ts > prev.ts) byUser.set(m[1], { file: f, ts });
  }
  return new Map([...byUser].map(([id, v]) => [id, v.file]));
}

async function main() {
  const legacy = new Client({ connectionString: LEGACY_URL });
  await legacy.connect();
  const target = new Client({ connectionString: need("DATABASE_URL") });
  await target.connect();

  const rows = (
    await legacy.query(`
      SELECT p.id AS legacy_id, u.id AS legacy_user_id, a."uploadUrl"
        FROM "JobSeekerProfile" p
        JOIN "User" u ON u.id = p."userId"
        JOIN "AvatarUpload" a ON a."userId" = u.id
       WHERE a."isCurrentAvatar" AND a.status = 'approved'`)
  ).rows as { legacy_id: string; legacy_user_id: string; uploadUrl: string }[];
  console.log(`${rows.length} legacy profiles with an approved current avatar`);

  const targets = (
    await target.query(
      `SELECT p."legacyId", p.id AS profile_id, u.id AS user_id, u.image
         FROM "TalentProfile" p JOIN "user" u ON u.id = p."userId"
        WHERE p."legacyId" IS NOT NULL`,
    )
  ).rows as { legacyId: string; profile_id: string; user_id: string; image: string | null }[];
  const byLegacy = new Map(targets.map((t) => [t.legacyId, t]));

  const local = localAvatars();
  const cdn = need("R2_PUBLIC_URL").replace(/\/$/, "");
  let done = 0, skipped = 0, missing = 0, fetched = 0;

  for (const row of rows) {
    const t = byLegacy.get(row.legacy_id);
    if (!t) { missing++; continue; }
    if (t.image && !FORCE) { skipped++; continue; }

    let body: Buffer;
    const file = local.get(row.legacy_user_id);
    if (file) {
      body = readFileSync(join(UPLOADS_DIR, file));
    } else {
      const res = await fetch(row.uploadUrl);
      if (!res.ok) { console.error(`  fetch failed ${row.uploadUrl} (${res.status})`); missing++; continue; }
      body = Buffer.from(await res.arrayBuffer());
      fetched++;
    }

    const key = `avatars/${t.profile_id}.webp`;
    if (COMMIT) {
      await s3.send(
        new PutObjectCommand({
          Bucket: need("R2_BUCKET"),
          Key: key,
          Body: body,
          ContentType: "image/webp",
        }),
      );
      await target.query(`UPDATE "user" SET image = $1 WHERE id = $2`, [
        `${cdn}/${key}`,
        t.user_id,
      ]);
    }
    done++;
    if (done % 100 === 0) console.log(`  ${done} uploaded`);
  }

  console.log(
    `${COMMIT ? "" : "[dry run] "}done=${done} skipped(existing)=${skipped} unmatched/missing=${missing} fetched-remote=${fetched}`,
  );
  await legacy.end();
  await target.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

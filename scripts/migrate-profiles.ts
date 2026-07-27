/**
 * Migrates remotetalentph job-seeker profiles into shortlisted.ph.
 *
 *   node --experimental-strip-types scripts/migrate-profiles.ts [--limit=N] [--commit]
 *
 * Without --commit it is a dry run and writes nothing.
 *
 * Profiles land UNPUBLISHED on purpose. These people signed up to a different
 * product; publishing them into employer slates without asking would be the
 * consent violation the whole platform is supposed to stand against. The
 * re-activation email (P5) is what flips publishedAt.
 *
 * Idempotent via TalentProfile.legacyId and User.email.
 */
import "dotenv/config";
import { randomBytes } from "node:crypto";
import { config } from "dotenv";
import { Client } from "pg";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

config({ path: ".env.local", override: true });

const LEGACY_URL =
  process.env.LEGACY_DATABASE_URL ?? "postgresql://postgres:postgres@localhost:5432/shortlisted";

const args = process.argv.slice(2);
const COMMIT = args.includes("--commit");
const LIMIT = Number(args.find((a) => a.startsWith("--limit="))?.split("=")[1] ?? 0);

const normalizeSkill = (s: string) =>
  s.toLowerCase().replace(/[^a-z0-9+#. ]/g, "").replace(/\s+/g, " ").trim();

/**
 * The legacy hourlyRate field collected monthly salaries and typos — the max in
 * the source data is 50,000. A wrong standing rate is worse than none: rate is
 * load-bearing in matching and shown to employers. Anything implausible becomes
 * null so the person sets it themselves at re-activation.
 */
const MAX_PLAUSIBLE_HOURLY = 60;
function cleanRate(raw: number | null): number | null {
  if (!raw || raw < 1) return null;
  return raw <= MAX_PLAUSIBLE_HOURLY ? raw : null;
}

/** "Jan 2022" - "Mar 2025", or "2022 - present" when still current. */
function span(start: Date | null, end: Date | null, isCurrent: boolean): string {
  const y = (d: Date | null) => (d ? String(d.getFullYear()) : "");
  if (!start) return isCurrent ? "present" : "";
  return `${y(start)} – ${isCurrent ? "present" : y(end) || "present"}`;
}

type LegacyRow = {
  id: string;
  userId: string;
  email: string;
  firstName: string;
  lastName: string;
  headline: string | null;
  bio: string | null;
  location: string | null;
  hourlyRate: number | null;
  experienceYears: number | null;
  availabilityStatus: string | null;
  updatedAt: Date | null;
};

async function main() {
  const legacy = new Client({ connectionString: LEGACY_URL });
  await legacy.connect();

  const db = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
  });

  // Only profiles with something to match on. A row with no headline and no
  // skills is noise that would pollute every slate.
  const { rows } = await legacy.query<LegacyRow>(
    `SELECT p.id, p."userId", u.email, p."firstName", p."lastName",
            p.headline, p.bio, p.location, p."hourlyRate", p."experienceYears",
            p."availabilityStatus", p."updatedAt"
       FROM "JobSeekerProfile" p
       JOIN "User" u ON u.id = p."userId"
      WHERE p."deletedAt" IS NULL
        AND u.email IS NOT NULL
        AND (
          (p.headline IS NOT NULL AND p.headline <> '')
          OR EXISTS (SELECT 1 FROM "JobSeekerSkill" s WHERE s."profileId" = p.id)
        )
      ORDER BY p."updatedAt" DESC NULLS LAST
      ${LIMIT ? `LIMIT ${LIMIT}` : ""}`,
  );

  const ids = rows.map((r) => r.id);
  const skills = await legacy.query<{ profileId: string; skillName: string }>(
    `SELECT "profileId", "skillName" FROM "JobSeekerSkill" WHERE "profileId" = ANY($1)`,
    [ids],
  );
  const work = await legacy.query<{
    profileId: string;
    company: string | null;
    position: string | null;
    startDate: Date | null;
    endDate: Date | null;
    isCurrent: boolean;
  }>(
    `SELECT "profileId", company, position, "startDate", "endDate", "isCurrent"
       FROM "JobSeekerWorkExperience" WHERE "profileId" = ANY($1) ORDER BY "order"`,
    [ids],
  );

  const skillsBy = new Map<string, string[]>();
  for (const s of skills.rows) {
    if (!s.skillName?.trim()) continue;
    const list = skillsBy.get(s.profileId) ?? [];
    if (list.length < 20 && !list.some((x) => normalizeSkill(x) === normalizeSkill(s.skillName)))
      list.push(s.skillName.trim());
    skillsBy.set(s.profileId, list);
  }

  const workBy = new Map<string, { role: string; company: string; span: string }[]>();
  for (const w of work.rows) {
    if (!w.position?.trim() || !w.company?.trim()) continue;
    const list = workBy.get(w.profileId) ?? [];
    if (list.length < 12)
      list.push({
        role: w.position.trim(),
        company: w.company.trim(),
        span: span(w.startDate, w.endDate, w.isCurrent),
      });
    workBy.set(w.profileId, list);
  }

  const stats = {
    seen: rows.length,
    imported: 0,
    skipped: 0,
    updated: 0,
    noEmail: 0,
    ratesDropped: 0,
  };

  console.log(
    `${COMMIT ? "MIGRATING" : "DRY RUN"} — ${rows.length} candidate profiles ` +
      `(${skills.rows.length} skills, ${work.rows.length} work rows)`,
  );

  for (const r of rows) {
    const email = r.email?.trim().toLowerCase();
    if (!email) {
      stats.noEmail++;
      continue;
    }
    const name = `${r.firstName ?? ""} ${r.lastName ?? ""}`.trim() || email.split("@")[0];
    const profileSkills = skillsBy.get(r.id) ?? [];
    const engagements = workBy.get(r.id) ?? [];
    const rateUsd = cleanRate(r.hourlyRate);
    if (r.hourlyRate && !rateUsd) stats.ratesDropped++;

    if (!COMMIT) {
      stats.imported++;
      if (stats.imported <= 3) {
        console.log(
          `  · ${name} — ${r.headline ?? "(no headline)"} — ` +
            `$${rateUsd ?? "unset"}/hr — ${profileSkills.length} skills, ${engagements.length} roles`,
        );
      }
      continue;
    }

    const existing = await db.talentProfile.findUnique({ where: { legacyId: r.id } });
    if (existing) {
      stats.updated++;
      continue;
    }

    try {
      await db.$transaction(async (tx) => {
        const user = await tx.user.upsert({
          where: { email },
          create: {
            // Reuse the legacy id so re-runs and support lookups stay traceable.
            id: r.userId,
            email,
            name,
            emailVerified: false,
            role: "talent",
            status: "active",
          },
          update: {},
        });

        await tx.talentProfile.create({
          data: {
            userId: user.id,
            legacyId: r.id,
            headline: r.headline?.trim() || null,
            summary: r.bio?.trim() || null,
            city: r.location?.trim() || null,
            yearsExperience: r.experienceYears ?? 0,
            rateUsd,
            availability: r.availabilityStatus === "not_available" ? "booked" : "open",
            visibility: true,
            // publishedAt stays null — no consent, no matching.
            publishedAt: null,
            // Minted at import, not at send time, so every imported profile is
            // invitable from the moment it exists. Without it the re-activation
            // send has nothing to address and the whole pool is unreachable —
            // which is exactly the state this migration used to leave behind.
            reactivationToken: randomBytes(16).toString("hex"),
            lastEditedAt: r.updatedAt ?? new Date(),
            skills: {
              create: profileSkills.map((n) => ({ name: n, normalizedName: normalizeSkill(n) })),
            },
            engagements: {
              // Everything imported is self-reported: nobody has confirmed an
              // outcome on this platform yet.
              create: engagements.map((e) => ({ ...e, outcome: "reported" })),
            },
          },
        });
      });
      stats.imported++;
      if (stats.imported % 100 === 0) console.log(`  ${stats.imported} imported…`);
    } catch (e) {
      stats.skipped++;
      console.error(`  ! ${email}: ${e instanceof Error ? e.message : e}`);
    }
  }

  console.log(JSON.stringify(stats, null, 2));
  if (!COMMIT) console.log("\nDry run — nothing written. Re-run with --commit.");

  await legacy.end();
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

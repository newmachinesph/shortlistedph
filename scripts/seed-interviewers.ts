/**
 * Seeds a few sample interviewers so the pool and the employer picker are not
 * empty in a fresh environment.
 *
 *   node --experimental-strip-types scripts/seed-interviewers.ts
 *
 * Creates real accounts through BetterAuth (so they can actually sign in) and
 * gives each an ACTIVE Interviewer row — skipping the normal
 * apply-then-admin-approve path on purpose, because the point is a
 * ready-to-use pool. Idempotent: an interviewer whose email already exists is
 * left alone.
 *
 * Password for every seeded account is INTERVIEWER_SEED_PASSWORD from
 * .env.local, or a default that must be changed before anyone signs in.
 */
import { config } from "dotenv";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import prismaPkg from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const { PrismaClient } = prismaPkg;

config({ path: ".env.local" });

function required(key: string): string {
  const value = process.env[key];
  if (!value) {
    console.error(`\n  ${key} is not set in .env.local — nothing to seed.\n`);
    process.exit(1);
  }
  return value;
}

// Sample roster. Emails are on the app's own domain so they read as internal
// seed data, not impersonations of real people.
const SAMPLE = [
  {
    name: "Marites Villanueva",
    email: "interviewer.marites@shortlisted.ph",
    bio: "Ten years hiring customer-support and virtual-assistant teams for US SaaS. Runs a calm, structured conversation and probes for real ownership, not rehearsed answers.",
    expertise: ["customer support", "virtual assistant", "operations"],
    languages: ["English", "Filipino"],
    yearsExperience: 10,
    rateUsd: 8,
  },
  {
    name: "Daniel Ocampo",
    email: "interviewer.daniel@shortlisted.ph",
    bio: "Senior full-stack engineer who has interviewed for React and Node roles at two Manila dev shops. Digs into how someone actually debugs, not just what they can name.",
    expertise: ["react", "node", "typescript", "software engineering"],
    languages: ["English", "Filipino"],
    yearsExperience: 9,
    rateUsd: 10,
  },
  {
    name: "Grace Fernandez",
    email: "interviewer.grace@shortlisted.ph",
    bio: "Former BPO team lead turned bookkeeping and admin specialist. Assesses accuracy, follow-through, and how a candidate handles being corrected.",
    expertise: ["bookkeeping", "accounting", "admin", "data entry"],
    languages: ["English", "Filipino", "Cebuano"],
    yearsExperience: 7,
    rateUsd: 6,
  },
  {
    name: "Julius Ramos",
    email: "interviewer.julius@shortlisted.ph",
    bio: "Performance-marketing manager who has hired media buyers and content people. Checks whether a candidate can reason about numbers, not just recite tactics.",
    expertise: ["digital marketing", "media buying", "content", "seo"],
    languages: ["English", "Filipino"],
    yearsExperience: 8,
    rateUsd: 9,
  },
  {
    name: "Aileen Santos",
    email: "interviewer.aileen@shortlisted.ph",
    bio: "Registered nurse who screens for US healthcare VA and medical-billing roles. Careful about credentials and about how someone handles patient-facing pressure.",
    expertise: ["healthcare", "medical billing", "virtual assistant"],
    languages: ["English", "Filipino"],
    yearsExperience: 11,
    rateUsd: 10,
  },
];

async function main() {
  const password = process.env.INTERVIEWER_SEED_PASSWORD || "ChangeMe-seed-2026";

  const db = new PrismaClient({
    adapter: new PrismaPg({ connectionString: required("DATABASE_URL") }),
  });

  const auth = betterAuth({
    baseURL: process.env.BETTER_AUTH_URL,
    secret: required("BETTER_AUTH_SECRET"),
    database: prismaAdapter(db, { provider: "postgresql" }),
    emailAndPassword: { enabled: true, minPasswordLength: 8 },
    user: {
      additionalFields: {
        role: { type: "string", required: false, defaultValue: "talent", input: false },
        status: { type: "string", required: false, defaultValue: "active", input: false },
      },
    },
  });

  let created = 0;
  let skipped = 0;

  for (const person of SAMPLE) {
    const email = person.email.toLowerCase();
    const existing = await db.user.findUnique({ where: { email } });
    if (existing) {
      console.log(`  skip  ${email} (already exists)`);
      skipped++;
      continue;
    }

    await auth.api.signUpEmail({ body: { email, password, name: person.name } });
    // Role stays "talent". Interviewing is a capability carried by the
    // Interviewer row below, never a User.role — writing "interviewer" here
    // bricked the account: requirePageUser sends an unknown role to /talent,
    // whose layout re-runs the same check, so the person hit an infinite
    // redirect and every requireRole("talent") route 403'd.
    const user = await db.user.update({
      where: { email },
      data: { status: "active", emailVerified: true },
      select: { id: true },
    });

    await db.interviewer.create({
      data: {
        userId: user.id,
        bio: person.bio,
        expertise: person.expertise,
        languages: person.languages,
        yearsExperience: person.yearsExperience,
        rateUsd: person.rateUsd,
        status: "active",
      },
    });

    console.log(`  add   ${email} — $${person.rateUsd}/interview, ${person.expertise[0]}`);
    created++;
  }

  console.log(`\n  ${created} created, ${skipped} skipped.`);
  if (created > 0) {
    console.log(`  All seeded accounts share the password INTERVIEWER_SEED_PASSWORD.`);
    console.log(`  Change it, or reset these passwords, before production use.\n`);
  }

  await db.$disconnect();
}

main().catch(async (e) => {
  console.error("\n  Seed failed:", e instanceof Error ? e.message : e, "\n");
  process.exit(1);
});

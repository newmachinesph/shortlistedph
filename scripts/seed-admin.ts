/**
 * Creates (or repairs) the back-office admin account.
 *
 *   node --experimental-strip-types scripts/seed-admin.ts
 *
 * Reads ADMIN_EMAIL + ADMIN_PASSWORD from .env.local.
 *
 * Why it builds its own BetterAuth instance instead of importing src/lib/auth:
 * that module is marked "server-only" and throws outside a React Server
 * Component. The config below mirrors it in the parts that matter — same
 * adapter, same secret, default hasher — so the password hash this writes is
 * the one the running app will verify against.
 *
 * Idempotent: re-running on an existing account promotes it and leaves the
 * password alone. It never overwrites a password you may have since changed.
 */
import { config } from "dotenv";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
// @prisma/client is CommonJS; under node's ESM loader only the default export
// resolves, so the named import has to be unpacked by hand.
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

async function main() {
  const email = required("ADMIN_EMAIL").trim().toLowerCase();
  const password = required("ADMIN_PASSWORD");
  const name = process.env.ADMIN_NAME?.trim() || "Admin";

  if (password.length < 8) {
    console.error("\n  ADMIN_PASSWORD must be at least 8 characters.\n");
    process.exit(1);
  }

  // requireAdmin() demands the role AND an allowlisted email. Seeding the role
  // without the allowlist entry produces an account that still gets a 403,
  // which is a confusing way to find out.
  const allowlist = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  const allowlisted = allowlist.includes(email);

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

  const existing = await db.user.findUnique({ where: { email } });

  if (existing) {
    console.log(`  Account already exists (${email}) — password left untouched.`);
  } else {
    await auth.api.signUpEmail({ body: { email, password, name } });
    console.log(`  Created account ${email}`);
  }

  const admin = await db.user.update({
    where: { email },
    data: { role: "admin", status: "active", emailVerified: true },
    select: { id: true, email: true, role: true },
  });

  console.log(`  Promoted to admin (id ${admin.id})`);

  if (!allowlisted) {
    console.warn(
      `\n  WARNING: ${email} is not in ADMIN_EMAILS.\n` +
        `  /admin will still return 403 until you add it:\n` +
        `      ADMIN_EMAILS=${[...allowlist, email].join(",")}\n` +
        `  Set it in .env.local AND in the Vercel project env.\n`,
    );
  } else {
    console.log("  Email is allowlisted in ADMIN_EMAILS — back office is reachable.");
  }

  await db.$disconnect();
}

main().catch(async (e) => {
  console.error("\n  Seed failed:", e instanceof Error ? e.message : e, "\n");
  process.exit(1);
});

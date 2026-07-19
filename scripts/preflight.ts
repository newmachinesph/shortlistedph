/**
 * Deployment preflight. Run before pushing and after setting Vercel env vars:
 *   npm run preflight
 *
 * Catches the config mistakes that only surface as a 500 in production.
 */
import { config } from "dotenv";

config({ path: ".env.local" });

type Check = { name: string; ok: boolean; detail: string; fatal: boolean };
const checks: Check[] = [];

const env = (k: string) => process.env[k]?.trim() ?? "";

function require_(key: string, hint: string) {
  const v = env(key);
  checks.push({ name: key, ok: v.length > 0, detail: v ? "set" : hint, fatal: true });
}

/** `detail` describes the consequence of it being absent, so only show it when absent. */
function warn(name: string, ok: boolean, ifMissing: string) {
  checks.push({ name, ok, detail: ok ? "set" : ifMissing, fatal: false });
}

// ── Required to boot at all ──────────────────────────────────────────────
require_("DATABASE_URL", "Neon connection string");
require_("BETTER_AUTH_SECRET", "openssl rand -base64 32");
require_("BETTER_AUTH_URL", "must equal the deployed origin");
require_("NEXT_PUBLIC_APP_URL", "must equal the deployed origin");
require_("OPENAI_API_KEY", "resume extraction and matching need this");

// ── Required for a working product, but the app boots without them ───────
require_("R2_ACCOUNT_ID", "resume uploads fail without R2");
require_("R2_ACCESS_KEY_ID", "resume uploads fail without R2");
require_("R2_SECRET_ACCESS_KEY", "resume uploads fail without R2");
require_("R2_BUCKET", "resume uploads fail without R2");

// ── Optional: features degrade cleanly if absent ─────────────────────────
warn("GOOGLE_CLIENT_ID", !!env("GOOGLE_CLIENT_ID"), "Google sign-in disabled without it");
warn("RESEND_API_KEY", !!env("RESEND_API_KEY"), "no transactional email");
warn("PAYPAL_CLIENT_ID", !!env("PAYPAL_CLIENT_ID"), "employers cannot buy credits");
warn("PAYPAL_WEBHOOK_ID", !!env("PAYPAL_WEBHOOK_ID"), "PayPal webhooks will be rejected (fails closed)");
warn("PAYMONGO_SECRET_KEY", !!env("PAYMONGO_SECRET_KEY"), "talent verification payment disabled");
warn("PAYMONGO_WEBHOOK_SECRET", !!env("PAYMONGO_WEBHOOK_SECRET"), "PayMongo webhooks will be rejected (fails closed)");
warn("ADMIN_EMAILS", !!env("ADMIN_EMAILS"), "nobody can reach /admin");
warn("CRON_SECRET", !!env("CRON_SECRET"), "cron endpoints unprotected once they exist");

// ── Consistency checks — the ones that bite in production ────────────────
const appUrl = env("NEXT_PUBLIC_APP_URL");
const authUrl = env("BETTER_AUTH_URL");
checks.push({
  name: "APP_URL matches AUTH_URL",
  ok: appUrl === authUrl,
  detail: appUrl === authUrl ? "aligned" : `mismatch: ${appUrl} vs ${authUrl} — OAuth callbacks will fail`,
  fatal: true,
});

const isProdUrl = appUrl.startsWith("https://");
checks.push({
  name: "URLs are absolute https in prod",
  ok: process.env.VERCEL !== "1" || isProdUrl,
  detail: isProdUrl ? "https" : "localhost — fine locally, wrong on Vercel",
  fatal: false,
});

// Neon direct connections exhaust fast under serverless fan-out; the pooled
// host is the one that survives traffic.
const db = env("DATABASE_URL");
checks.push({
  name: "DATABASE_URL is pooled",
  ok: !db.includes("neon.tech") || db.includes("-pooler."),
  detail: db.includes("-pooler.")
    ? "pooled"
    : "NOT pooled — use the '-pooler' host from Neon for serverless, or connections will run out",
  fatal: false,
});

checks.push({
  name: "PayPal environment",
  ok: true,
  detail: env("PAYPAL_ENV") === "live" ? "LIVE — real money" : "sandbox",
  fatal: false,
});

// ── Report ───────────────────────────────────────────────────────────────
const pad = (s: string) => s.padEnd(28);
let fatalFailures = 0;

for (const c of checks) {
  const mark = c.ok ? "ok  " : c.fatal ? "FAIL" : "warn";
  if (!c.ok && c.fatal) fatalFailures++;
  console.log(`  ${mark}  ${pad(c.name)} ${c.detail}`);
}

console.log();
if (fatalFailures > 0) {
  console.log(`${fatalFailures} required setting(s) missing — the app will not work.`);
  process.exit(1);
}
console.log("Preflight passed. Warnings above are features that stay disabled.");

/**
 * Sends the re-activation invitation to the migrated remotetalentph pool.
 *
 *   node --experimental-strip-types scripts/send-reactivation.ts [--limit=N] [--commit]
 *
 * Without --commit it is a dry run: nothing is written and nothing is sent.
 *
 * This drives the app rather than sending directly. lib/email.ts is
 * "server-only" and throws under plain node (see scripts/seed-admin.ts for the
 * same constraint), and a second copy of the transport in a script is how the
 * outreach kill switch and the sending identity quietly stop applying to the
 * one email that goes to ~785 people who never signed up here.
 *
 * Resumable: a profile that already carries reactivationSentAt is never picked
 * up again, so re-running only reaches whoever is left. Run it in small
 * batches — --limit exists so a bad template is caught at 25 people, not 785.
 */
import { config } from "dotenv";

config({ path: ".env.local", override: true });

const args = process.argv.slice(2);
const COMMIT = args.includes("--commit");
const LIMIT = Number(args.find((a) => a.startsWith("--limit="))?.split("=")[1] ?? 25);

const BASE = (process.env.SEND_TARGET_URL ?? "http://localhost:3000").replace(/\/$/, "");
const SECRET = process.env.CRON_SECRET;

if (!SECRET) {
  console.error("\n  CRON_SECRET is not set in .env.local — the send route will reject this.\n");
  process.exit(1);
}
if (!Number.isInteger(LIMIT) || LIMIT < 1) {
  console.error("\n  --limit must be a positive integer.\n");
  process.exit(1);
}

type Result = {
  outreachOn: boolean;
  queued: number;
  preview: string[];
  sent: number;
  failed: number;
};

async function main() {
  console.log(`${COMMIT ? "SENDING" : "DRY RUN"} — up to ${LIMIT} invitations via ${BASE}`);

  const res = await fetch(`${BASE}/api/admin/reactivation/send`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${SECRET}` },
    body: JSON.stringify({ commit: COMMIT, limit: LIMIT }),
  });

  const payload = (await res.json().catch(() => null)) as (Result & { error?: string }) | null;
  if (!res.ok || !payload) {
    console.error(`  ! ${res.status} ${payload?.error ?? "no response body"}`);
    process.exit(1);
  }

  if (!payload.outreachOn) {
    console.warn("  Outreach emails are switched OFF — nothing was sent. Flip it in /admin/settings.");
  }

  console.log(`  ${payload.queued} profile(s) waiting in this batch`);
  for (const email of payload.preview) console.log(`    · ${email}`);
  if (payload.queued > payload.preview.length) {
    console.log(`    … and ${payload.queued - payload.preview.length} more`);
  }

  if (!COMMIT) {
    console.log("\nDry run — nothing written, nothing sent. Re-run with --commit.");
    return;
  }

  console.log(`  sent ${payload.sent}, failed ${payload.failed}`);
  if (payload.failed > 0) {
    console.warn("  Failed deliveries keep their place in the queue — re-run to retry them.");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

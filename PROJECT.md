# PROJECT.md — current status

Updated 2026-07-27.

## The decision that shapes everything

**We start with zero jobseekers.** No migration from remotetalentph. The ~785
imported profiles are deleted, not carried over and not merely unpublished — so
this platform holds no data on anyone who never agreed to be here, and
remotetalentph stays their system of record.

Consequences:
- `scripts/migrate-profiles.ts` and `scripts/embed-profiles.ts` are dormant.
  They still work and still import UNPUBLISHED, which remains correct if a bulk
  import is ever wanted again.
- The talent re-activation flow (`/reactivate/[token]`, `lib/reactivation.ts`,
  the invite email, the admin view, `scripts/send-reactivation.ts`) is built and
  **verified end to end against a running app** — page render, publish decision,
  password write, real sign-in, single-use token. It is dormant with nobody to
  invite. Do not delete it: it is the only way an imported account can ever be
  reached, since imports create no `Account` row and password reset cannot
  find them.
- The first real talent will sign up through onboarding like anyone else.

## Databases

- **Dev**: fresh from the full migration chain, admin-only. Verified: 39 tables,
  both hnsw indexes, `interview_one_live_per_entry`, 17 CHECK constraints.
- **Prod**: still holds the old patch-era schema and the 785 imported profiles.
  **It has never been on the migration chain** (no `_prisma_migrations` table).
  The reset sequence is in "Bringing prod up" below and needs a human — the
  agent harness blocks prod writes.

## Schema changes

`npx prisma migrate dev --create-only` → **delete the two hnsw `DROP INDEX`
lines it always emits** → `npx prisma migrate deploy` → verify against
`pg_indexes` *and* `pg_constraint WHERE contype='c'`. `db push` is banned.
Prisma's differ is blind to the vector indexes, the partial unique index, and
every CHECK — it will not drop them, but it will never recreate them either.
See MISTAKES.md.

## Bringing prod up (destructive, human-run)

```powershell
# 1. read-only sanity first — confirm what is about to go
$env:DATABASE_URL = "<PROD_DATABASE_URL from .env.local>"

# 2. wipe + rebuild on the migration chain
node --experimental-strip-types scripts/db-run.ts scripts/reset-schema.sql   # DB=prod
npx prisma migrate deploy
npm run seed:admin

# 3. verify
#    both hnsw indexes present, interview_one_live_per_entry present,
#    17 CHECK constraints, one admin user, zero talent profiles
Remove-Item Env:DATABASE_URL
```

## State of the code

Four audit rounds and five fix waves; `docs/system-audit-4.md` is the live open
list. Build, lint and typecheck green; 25 unit tests, all pure logic.

**Verified by execution** (2026-07-27, first time the app was ever run):

- The re-activation flow, start to finish including real sign-in.
- **The core loop**, via `npm run smoke` — 43 checks, green. Talent signs up,
  verifies, onboards, publishes (embeddings and canonical tools land); employer
  signs up, briefs, publishes; the pool is scanned, a slate is built and the
  candidate invited with score/dims/snapshot frozen at INVITE time; the slate
  stays hidden from the employer until an admin approves; the candidate accepts
  and the entry carries the frozen snapshot, not a fresh one. The consent page
  is checked for the employer's name and raw title — the hidden-JD principle
  asserted against what the candidate's browser actually receives.

`scripts/smoke-core-loop.ts` needs a running dev app and a dev database. It
purges its own accounts first, so runs are repeatable. `Slate` and
`ProfileSnapshot` have to be deleted explicitly in that purge — they are
`onDelete: Restrict` because they are delivered work, and having to name them
is the guard proving itself.

- **The refund ledger**, via `npm run test:money` — 10 tests against a real
  Postgres. Grants, idempotent redelivery, the catalog-price check, full
  refunds, already-spent credits, and partial refunds (proportional revocation,
  accumulation across events, replayed webhooks, commission survival).

## Testing the money paths

No Docker and no disposable Neon branch: `src/lib/*.dbtest.ts` import the real
modules and run against `DATABASE_URL`. Three things make that work, all in
`scripts/node-resolve.mjs`:

- `--conditions=react-server` makes `import "server-only"` resolve to the
  package's own empty module, exactly as the RSC build does;
- a resolve hook for `@/…` and extensionless imports, which tsconfig knows
  about and Node does not;
- a stub for `@/emails/templates`, the one `.tsx` file `lib/` pulls in — Node
  strips types but does not transform JSX.

The resolver is opt-in via `--import`, so nothing but the test runner sees it.

Still unexercised: interviews, ratings, referral payouts, and the two checkout
routes that talk to PayPal and PayMongo live. The webhooks either side of them
are covered.

# MISTAKES.md — pitfalls to not repeat

- **Never `prisma db push`** — silently drops the hnsw vector indexes. Migrations only.
- **Every generated migration tries to drop the hnsw indexes.** Prisma cannot see
  indexes on `Unsupported("vector")` columns, so each `migrate dev --create-only`
  emits `DROP INDEX jd_embedding_hnsw` + `talent_embedding_hnsw` as "drift". Delete
  those two lines by hand, every single time, before applying. Verify after with a
  query on `pg_indexes`.
- **The hnsw indexes are not the only thing Prisma's differ is blind to.** It cannot
  express, and therefore cannot see, any of:
  - `interview_one_live_per_entry` — a PARTIAL unique index, the only guard against
    double-booking one slate entry;
  - **every CHECK constraint** — 17 of them now, including `employer_credits_nonneg`
    and `entitlement_kind_check`.
  It does not try to drop these (it never learned they exist), but that cuts the
  other way: it will never recreate them either, and `db push` or a schema reset
  loses them silently. After ANY migration, verify against `pg_indexes` **and**
  `pg_constraint WHERE contype = 'c'`, not just the two vector indexes.
- **`SET LOCAL` needs an interactive transaction, and Prisma's default `maxWait` is
  too short for Neon.** A session GUC set by a bare `$executeRaw` is gone by the next
  call — Prisma takes a fresh pooled connection each time. It must be issued inside
  the same `db.$transaction(async (tx) => …)` as the query that depends on it.
  And pass `{ maxWait }`: the default 2s is beaten by a Neon cold start, and the
  P2028 it throws ("unable to start a transaction in the given time") fires *before*
  any query runs, so it reads like a query bug.
- **An ANN index cannot return more rows than it looked at.** `hnsw.ef_search`
  defaults to 40, so `ORDER BY embedding <=> $1 LIMIT 150` silently returned ~40 —
  a "3× deeper pool" that was in fact shallower than the 50 it replaced. Any change
  to a vector `LIMIT` must move `ef_search` with it (lib/matching.ts).
- **A JSON config column is read wholesale by someone eventually.** `hardRequirements`
  was written as `{rateMaxUsd, hoursPerWeekMin: jd.hoursPerWeek}` by the JD route and
  returned whole by the matcher, turning "the employer wants 40h covered" into "the
  candidate must have 40h spare" — Stage 0 then eliminated everyone with a single
  committed hour. Derive each field explicitly at the read site, and put the
  precedence rule in a pure module with a test. Twice-shipped bugs are twice-shipped
  because nothing could fail.
- **Cascade is the default and it is wrong on money and on delivered product.**
  `user → TalentProfile → ProfileSnapshot → …` destroyed an employer's paid shortlist
  and interviews an interviewer was owed for; `Payment`/`ReferralPayout` cascading
  from `user` erased the revenue trail. When adding a relation, ask what a future
  "delete my account" would take with it, and reach for `Restrict` on anything that
  is a receipt. Guarding one edge is not enough — `protect_commission_history` fixed
  `conversion → commission` and left the shorter `referral → commission` route open.
- **A column shipped without its writer is a lie with a migration behind it.**
  `sendAttempts` shipped with a schema comment describing parking behaviour nobody
  implemented, so the starvation bug it documented stayed reachable and looked fixed.
  Same class as the write-only tables below.
- **Never hand-name a migration folder with a future timestamp.** Prisma names them in
  UTC and replays the whole chain in *filename order* against a shadow database on the
  next `migrate dev`. A hand-picked name that sorts after the clock makes later
  migrations replay before the tables exist ("relation X does not exist"), and the
  error points at the wrong migration entirely.
- **Don't trust the eval harness as-is** — it ranks a different pipeline than
  production (pool gates, verified bonus, rotation all differ). Fix parity before
  trusting any threshold it produces (audit P2-15).
- **Two writers, one side effect**: `availability` via profile PATCH skips the
  `availabilityConfirmedAt` stamp the dedicated route sets. When adding a writer,
  grep the existing one for side effects first.
- **Swallowed try/catch around money**: commission accrual was silently lost when the
  receipt email threw first (audit P0-2). Money operations get their own error
  handling, never share a catch with cosmetics.
- **Unconditional role flips break accounts** — interviewer approval sets `User.role`
  and strands the person's talent/employer surface (audit P0-8).
- **Copy ships promises code doesn't keep** (re-slate guarantee, hiring desk,
  auto-verification). Before writing marketing/UI copy, verify the code path exists.
- **Write-only tables rot** — MatchElimination, ProfileTool. A new table needs its
  reader and its runtime writer in the same phase, or a dated TODO naming the phase.
- **Backfills are not sync** — a backfill script covers the pool once; without a
  runtime writer the table drifts stale immediately.
- **A running dev server keeps the OLD Prisma client.** After `migrate deploy` +
  `prisma generate`, `next dev` still holds the previously generated client, so
  writing a brand-new column throws and the route 500s. The smoke test failed at
  "fill the profile" with the code entirely correct — restarting the server was
  the whole fix. Restart `next dev` after every schema change before believing a
  runtime failure.
- **Deriving a column silently destroys what a user typed into it.** Making
  `committedHours` a derived total would have erased the hours a talent reported
  for work done off this platform. The fix was a second column
  (`selfCommittedHours`) holding their own answer, with the derived total built
  on top — and prefill switched to the baseline, or the next save folds the
  platform's hours into the talent's own figure and every save after that adds
  them again. Before deriving an existing column, ask who else writes it and
  what happens to their value.

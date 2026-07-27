# DECISIONS.md — why we chose things

- **Snapshot is the product.** Slates reference frozen ProfileSnapshots, never live
  profiles — anti-tailoring is the core promise. (Audit P0-4: freeze point must move to
  invite time, but the snapshot principle itself stands.)
- **Consent-first matching.** Nobody appears on a slate without accepting; slate is
  born empty behind admin review.
- **Publish = the consent/embed boundary.** Resume upload alone never embeds a profile.
- **Credits are the money.** PayPal purchase → credit balance → unlock/interview spend.
  `Payment.providerRef` unique = webhook-replay safety.
- **Prisma migrations, not SQL patches** (2026-07-26). Baseline
  `20260726000000_init` carries pgvector, hnsw, partial unique, CHECKs. `db push`
  banned — drops hnsw indexes.
- **Alias table over embeddings for tools.** Hand-seeded `lib/tools/aliases.ts`;
  a wrong merge is worse than a miss — never guess unmapped names into canonicals.
- **Referrals: recurring $9 per shortlist-credit purchase**, lifetime of referred
  company; conversions = attribution only, commissions = money
  (`ReferralCommission.paymentId` unique).
- **requireAdmin = role AND env allowlist**, not role alone.
- **In-repo markdown memory** (this file + PROJECT/MISTAKES) over external tools.

## The interview assessment stays human-only (2026-07-28)

A paid interviewer's assessment — recommendation, four scores, strengths,
concerns — is read by the employer, the candidate and admin, and feeds nothing
in the engine. That is deliberate, not an omission.

**Why.** One interviewer's judgment of one 30-minute call would otherwise follow
a person across every future brief. A "no" becomes a permanent, invisible
penalty they cannot see, question or appeal, applied to jobs the interviewer
never saw. Ranking is built from what a candidate can inspect and correct — the
snapshot is the product — and a hidden reputation score is the opposite of that.

**What this rules out.** Adding `assessment` as a scoring dimension, or as a
capped tie-breaker bonus. Both were considered and declined.

**What is still allowed.** Surfacing the assessment wherever a HUMAN is already
deciding: the employer's shortlist view, the candidate's own page, admin review.
Evidence for people, never a coefficient.

## Feature work stops here (2026-07-28)

The audit-4 backlog is closed — all seventeen items verified against the code
rather than the doc. The remaining synergy gaps (ratings have no aggregate
consumer; ProfileTool and requiredTools are written and never read) are left
open on purpose: both change how the product behaves, and neither has real usage
to justify a direction yet. Revisit them when there are users to learn from.

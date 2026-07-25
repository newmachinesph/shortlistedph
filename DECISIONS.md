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

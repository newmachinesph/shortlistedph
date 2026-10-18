# shortlisted.ph

A reverse-hiring platform for Philippine remote talent. Employers post a hidden job description; a matching engine ranks standing talent profiles against it and returns a shortlist of at most five people. Talent upload a resume once, never apply, never tailor and never pay to be listed. The platform is a sourcing tool only: it does not hold or take a cut of salaries.

## Stack

Next.js 16 (App Router), React 19, Tailwind v4, Prisma 7 on Postgres (Neon, pgvector), BetterAuth, OpenAI (resume extraction and embeddings), PayPal and PayMongo payments, Cloudflare R2 storage, Resend or SMTP email. Deployed on Vercel.

## How it works

- Employers write a job description candidates cannot see, so there is nothing to tailor a resume to.
- Talent upload a resume (PDF or DOCX, parsed with `unpdf` and `mammoth`). Publishing the profile is the consent and embedding boundary.
- Ranking combines skill evidence, experience, rate fit and availability overlap (`src/lib/matching.ts`, `src/lib/scoring.ts`), with optional hard filters.
- Slates reference frozen profile snapshots taken at invite time, so editing a profile later cannot change how it ranked. A slate stays hidden until an admin approves it.
- Candidates consent before any contact; nothing about a person is revealed without it.
- Employers buy credits (PayPal, PayMongo) that are spent on unlocking shortlists and paid interviews. Interviewers run paid interviews; their assessment is human-only and feeds nothing in the engine.
- Optional identity verification runs through Didit; the platform receives a pass or fail, not documents.
- Referral commissions, ratings, in-app messaging, notifications and an admin panel are included.
- Scheduled jobs (`vercel.json`): availability refresh, consent refresh and interview expiry.

Design decisions are recorded in `DECISIONS.md`, known pitfalls in `MISTAKES.md`, and current status in `PROJECT.md`.

## Local development

Requires Node.js and a Postgres database with the pgvector extension.

```bash
npm install            # also runs prisma generate
npx prisma migrate deploy
npm run seed:admin     # needs ADMIN_EMAIL and ADMIN_PASSWORD
npm run dev            # http://localhost:3000
```

Configuration is read from `.env.local`. The variables the code reads include `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `NEXT_PUBLIC_APP_URL`, `ADMIN_EMAILS`, `OPENAI_API_KEY`, `PAYMONGO_SECRET_KEY`, `PAYMONGO_WEBHOOK_SECRET`, `PAYPAL_ENV`, `R2_ACCOUNT_ID`, `R2_PUBLIC_URL`, `RESEND_API_KEY` (or `SMTP_*` with `EMAIL_PROVIDER`), `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `CRON_SECRET` and `NEXT_PUBLIC_GA_ID`. `npm run preflight` checks the environment.

Schema changes go through `prisma migrate`; `db push` is banned because it drops the hnsw vector indexes and the CHECK constraints (see `MISTAKES.md`). Other scripts: `seed:interviewers`, `backfill:facets`.

## Checks

```bash
npm run lint
npm run build
npm run test:unit      # pure-logic tests in src/lib
npm run test:money     # *.dbtest.ts against a real Postgres (DATABASE_URL)
npm run smoke          # end-to-end core loop; needs a running dev app and a dev database
```

## Deployment

Vercel, with the cron schedule in `vercel.json`. Run `prisma migrate deploy` against the target database before first use. `PROJECT.md` documents the destructive reset sequence used to bring a legacy database onto the migration chain.

## License

MIT. See [LICENSE](LICENSE).

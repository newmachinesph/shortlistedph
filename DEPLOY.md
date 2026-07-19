# Deploying to Vercel

Run `npm run preflight` first — it catches the config mistakes that only show up as a 500 in production.

## Before the first deploy

**1. Rotate the exposed credentials.** The Neon password, UploadThing token, and OpenAI key were all pasted in plaintext during development. Deploying puts them in Vercel's env store too — rotate first so production never runs on a known-compromised secret.

**2. Use Neon's pooled connection string.** The current `DATABASE_URL` points at the direct host. Under serverless fan-out each lambda opens its own TCP connection and Neon runs out fast. Take the host containing `-pooler` from the Neon dashboard. Preflight warns about this.

**3. Push to GitHub.** The repo has no remote yet:

```bash
gh repo create shortlistedph --private --source=. --push
```

## Deploy

```bash
npx vercel            # preview
npx vercel --prod     # production
```

Vercel auto-detects Next.js. `prisma generate` runs via `postinstall` — without it the build fails on a cached `node_modules`, since Prisma Client isn't regenerated between builds.

## Environment variables

Set every non-empty key from `.env.local` in the Vercel dashboard (Settings → Environment Variables), with these changed for production:

| Key | Production value |
|---|---|
| `NEXT_PUBLIC_APP_URL` | `https://<your-domain>` |
| `BETTER_AUTH_URL` | same as above — a mismatch breaks OAuth callbacks |
| `DATABASE_URL` | the **pooled** Neon host |
| `PAYPAL_ENV` | keep `sandbox` until you've tested a real capture |

## After the first deploy

These can only be done once a public URL exists:

**Google OAuth** — add `https://<domain>/api/auth/callback/google` to the authorised redirect URIs in Google Cloud Console. Sign-in fails silently until you do.

**Webhooks** — both providers validate that the endpoint resolves, so registration is impossible before deploy.
- PayPal: register `https://<domain>/api/paypal/webhook`, then put the returned webhook id in `PAYPAL_WEBHOOK_ID`.
- PayMongo: create via API (there is no dashboard form), subscribe to `qr.paid`, `payment.failed`, `payment.refunded`, `payment.refund.updated`. The response returns a `secret_key` → `PAYMONGO_WEBHOOK_SECRET`.

Both verifiers **fail closed**: until those secrets are set, every delivery is rejected 401 and nothing is granted. That's the safe direction, but it does mean payments won't fulfil until it's done.

Keep the pairs matched or every delivery 401s:
- `PAYMONGO_WEBHOOK_SECRET` must come from the same mode as `PAYMONGO_SECRET_KEY` — the verifier picks the test or live signature half based on whether the secret key starts with `sk_live`.
- `PAYPAL_WEBHOOK_ID` must belong to the same environment as `PAYPAL_ENV`.

**Resend** — verify the `shortlisted.ph` domain before any user-facing email. Sending from `newmachine.ph` while the mail claims to be shortlisted.ph reads as phishing and hurts deliverability. Until `RESEND_API_KEY` and `EMAIL_FROM` are both set, `lib/email.ts` logs each skipped send and carries on — password reset will appear to work and deliver nothing.

## Admin account

```
npm run seed:admin
```

Reads `ADMIN_EMAIL` / `ADMIN_PASSWORD` from `.env.local`, creates the account through BetterAuth so the hash matches what the app verifies, then promotes it. Idempotent — re-running an existing account promotes it without touching the password.

`requireAdmin()` demands **both** `role === "admin"` and the address listed in `ADMIN_EMAILS`. The seed warns when the second half is missing, because the symptom otherwise is a 403 on an account that looks correct in the database. Set `ADMIN_EMAILS` in Vercel too, not just locally.

## What a first deploy will and won't do

Works immediately: signup, login, talent onboarding (resume → profile → publish), job descriptions, matching, slate previews, connections, the admin pages.

Won't work until configured: Google sign-in (redirect URI), payment fulfilment (webhook secrets), any email (Resend domain verification).

**Identity verification is not built.** The ₱60 product and its checkout route exist but nothing links to them, and the Didit integration is a mockup. See [docs/VERIFICATION.md](docs/VERIFICATION.md) before wiring any entry point to it.

**Slates will come back empty or thin.** The 785 migrated profiles are unpublished pending the consent email — by design, they can't appear in anyone's shortlist until they agree. Publish a test talent account of your own to see a populated slate.

## Smoke test after deploying

```
/                       loads
/register               create an employer, then a talent account
/onboarding             upload a real resume — exercises R2 + OpenAI
/employer/briefs/new    post a job description, confirm a slate returns
```

Then check the Vercel function logs for anything failing quietly.

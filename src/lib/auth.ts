import "server-only";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { db } from "./db";
import { mail } from "./email";

const googleId = process.env.GOOGLE_CLIENT_ID;
const googleSecret = process.env.GOOGLE_CLIENT_SECRET;

/**
 * Vercel won't store an empty env var, so optional keys arrive as undefined.
 * Registering a provider with undefined credentials can break sign-in
 * entirely — including email/password — so it's registered only when both
 * halves are actually present.
 */
export const isGoogleEnabled = Boolean(googleId && googleSecret);

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  database: prismaAdapter(db, { provider: "postgresql" }),
  // ponytail: session.cookieCache would drop the per-request DB hit entirely,
  // but role/status are mutated directly in the DB (onboarding role-set, admin
  // suspend) and the cached cookie would serve a stale role for up to maxAge —
  // breaking the post-onboarding redirect. Enable only once those mutations
  // refresh/invalidate the session cookie. React cache() (lib/session.ts)
  // already dedupes the lookup within a request, which is the bulk of the win.
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    /**
     * sendOnSignUp alone sent the mail and enforced nothing: an unverified
     * account was fully usable, so an address could be squatted and every
     * per-user rate limit was really limit × (accounts you can make in a
     * minute). With this, no session is issued until the link is clicked.
     *
     * Only the credential path is gated. Google users arrive already verified
     * from the provider; the migrated pool has no Account row and never signs
     * in with a password at all, so the emailed consent link — deliberately
     * session-free — is untouched; and scripts/seed-admin.ts sets
     * emailVerified explicitly, so the admin is not locked out.
     */
    requireEmailVerification: true,
    // Without this, better-auth still answers "check your email" and sends
    // nothing — the reset flow looks fine and silently dead-ends.
    sendResetPassword: async ({ user, url }) => {
      await mail.resetPassword(user.email, user.name, url);
    },
  },
  emailVerification: {
    sendOnSignUp: true,
    // The 403 on an unverified sign-in is only a dead end if nothing re-sends
    // the link. Any account that already exists unverified — or whose first
    // mail was lost — gets a fresh one from the attempt itself.
    sendOnSignIn: true,
    autoSignInAfterVerification: true,
    sendVerificationEmail: async ({ user, url }) => {
      await mail.verifyEmail(user.email, user.name, url);
    },
  },
  socialProviders: isGoogleEnabled
    ? { google: { clientId: googleId!, clientSecret: googleSecret! } }
    : {},
  user: {
    additionalFields: {
      // Set server-side after signup (see /api/onboarding/role); never client input.
      role: { type: "string", required: false, defaultValue: "talent", input: false },
      status: { type: "string", required: false, defaultValue: "active", input: false },
    },
  },
  plugins: [nextCookies()],
});

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
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    // Without this, better-auth still answers "check your email" and sends
    // nothing — the reset flow looks fine and silently dead-ends.
    sendResetPassword: async ({ user, url }) => {
      await mail.resetPassword(user.email, user.name, url);
    },
  },
  emailVerification: {
    sendOnSignUp: true,
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

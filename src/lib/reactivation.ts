import "server-only";
import { randomBytes } from "node:crypto";
import { auth } from "./auth";
import { db } from "./db";
import { mail } from "./email";
import { HttpError } from "./session";
import { outreachEmailsEnabled } from "./settings";

/**
 * Re-activation of the remotetalentph pool, candidate side.
 *
 * scripts/migrate-profiles.ts imports these people unpublished on purpose:
 * they signed up to a different product, and putting them in front of
 * employers without asking is the consent violation this platform exists to
 * prevent. Nothing here publishes anyone — `publish` is a decision a person
 * makes on the page, and it is the only path that ever sets publishedAt.
 *
 * The import also creates no Account row, so BetterAuth's reset-password
 * writes to a credential that does not exist and cannot reach them. The
 * emailed token is therefore the whole credential and nothing in this file
 * requires a session — same discipline as lib/consent.ts.
 */

/** 32 hex chars (128 bits) — the re-activation link credential. */
export function newReactivationToken(): string {
  return randomBytes(16).toString("hex");
}

export type ReactivationDecision = "publish" | "keep_private" | "delete";

/**
 * What the page needs to show someone what was imported about them.
 *
 * Deliberately the whole imported record, not a summary: nobody can judge
 * "publish this or delete it" against a name and a promise.
 */
export async function getProfileByReactivationToken(token: string) {
  return db.talentProfile.findUnique({
    where: { reactivationToken: token },
    select: {
      headline: true,
      summary: true,
      city: true,
      yearsExperience: true,
      rateUsd: true,
      user: { select: { name: true, email: true } },
      skills: { select: { id: true, name: true } },
      engagements: { select: { id: true, role: true, company: true, span: true } },
    },
  });
}

/**
 * The one write path for a re-activation answer.
 *
 * Idempotent and race-safe the same way respondToConsent is: the token is
 * claimed by a conditional updateMany, so a second tab matches 0 rows and is
 * told the link is spent instead of publishing or deleting anyone twice.
 *
 * Spending the token clears it, so the link in the inbox stops being a live
 * credential the moment it has been used.
 */
export async function reactivate({
  token,
  password,
  decision,
}: {
  token: string;
  password?: string;
  decision: ReactivationDecision;
}): Promise<{ status: ReactivationDecision | "deleted" }> {
  const profile = await db.talentProfile.findUnique({
    where: { reactivationToken: token },
    select: { id: true, userId: true },
  });
  if (!profile) throw new HttpError(404, "This link is no longer valid");

  if (decision === "delete") {
    // Claim the token BEFORE deleting: the tab that loses the race gets 0 rows
    // and a 409, rather than a 500 from deleting a User that is already gone.
    const { count } = await db.talentProfile.updateMany({
      where: { id: profile.id, reactivationToken: token },
      data: { reactivationToken: null },
    });
    if (count === 0) throw new HttpError(409, "This link has already been used");
    // Cascades to the profile and everything hanging off it.
    await db.user.delete({ where: { id: profile.userId } });
    return { status: "deleted" };
  }

  if (!password) throw new HttpError(400, "A password is required to keep your account");

  // Password BEFORE the token is spent, not after. This token is the ONLY way
  // into an account with no Account row; clearing it and then failing to write
  // the credential locks someone out of the profile they just asked to keep.
  await setInitialPassword(profile.userId, password);

  const { count } = await db.talentProfile.updateMany({
    where: { id: profile.id, reactivationToken: token },
    data: {
      reactivationToken: null,
      reactivatedAt: new Date(),
      // The only place publishedAt is set on this path — and matching reads
      // exactly this field, so nobody enters a slate without having chosen to.
      ...(decision === "publish" ? { publishedAt: new Date() } : {}),
    },
  });
  if (count === 0) throw new HttpError(409, "This link has already been used");

  return { status: decision };
}

/**
 * Gives a migrated user a credential the running app will actually verify.
 *
 * auth.api.setPassword does precisely this, but sits behind the session
 * middleware and this flow has no session by design. Going through
 * auth.$context runs the same three steps — configured hasher, linkAccount
 * under providerId "credential" with accountId = userId — so the hash written
 * here can never drift from the one sign-in checks against.
 */
async function setInitialPassword(userId: string, password: string) {
  const ctx = await auth.$context;
  const { minPasswordLength, maxPasswordLength } = ctx.password.config;
  if (password.length < minPasswordLength || password.length > maxPasswordLength) {
    throw new HttpError(
      422,
      `Password must be between ${minPasswordLength} and ${maxPasswordLength} characters`,
    );
  }

  const existing = await db.account.findFirst({
    where: { userId, providerId: "credential" },
    select: { id: true },
  });
  // Overwriting a password someone already set — by any route — would be an
  // account takeover dressed up as a migration step.
  if (existing) throw new HttpError(409, "This account already has a password — sign in instead");

  await ctx.internalAdapter.linkAccount({
    userId,
    providerId: "credential",
    accountId: userId,
    password: await ctx.password.hash(password),
  });

  // requireEmailVerification (lib/auth.ts) would refuse the sign-in they are
  // about to make. Clicking a link we mailed to this address is the same proof
  // the verification email asks for, so demanding a second one is only a way
  // to lose people between the decision and the account.
  await db.user.update({ where: { id: userId }, data: { emailVerified: true } });
}

/**
 * Emails the migrated pool, oldest import first.
 *
 * Resumable by construction: reactivationSentAt is stamped only after a
 * delivery succeeds and profiles carrying it are never selected again, so a
 * run that dies halfway costs nothing and a re-run continues where it stopped.
 *
 * `commit: false` writes nothing and sends nothing — it reports who the next
 * run would reach. This list is ~785 real people; the default has to be
 * "show me first".
 */
export async function sendReactivationInvites({
  limit,
  commit,
}: {
  limit: number;
  commit: boolean;
}): Promise<{
  outreachOn: boolean;
  queued: number;
  preview: string[];
  sent: number;
  failed: number;
}> {
  // Read once, here, rather than inferred from a false return inside the loop:
  // mail reports a kill-switch suppression and a real transport failure
  // identically, and counting the suppressed ones as failures would log a
  // pool-wide outage every time outreach is simply switched off.
  const outreachOn = await outreachEmailsEnabled();

  const pending = await db.talentProfile.findMany({
    where: {
      // The migrated pool only — legacyId is what the import stamps.
      legacyId: { not: null },
      reactivationSentAt: null,
      reactivatedAt: null,
      user: { status: "active" },
    },
    orderBy: { createdAt: "asc" },
    take: limit,
    select: { id: true, reactivationToken: true, user: { select: { name: true, email: true } } },
  });

  const preview = pending.slice(0, 5).map((p) => p.user.email);
  if (!commit || !outreachOn) {
    return { outreachOn, queued: pending.length, preview, sent: 0, failed: 0 };
  }

  let sent = 0;
  let failed = 0;
  for (const p of pending) {
    // A token is minted on first send and reused afterwards. Re-issuing one
    // for a profile whose email is already sitting in an inbox would silently
    // break the only link that person has.
    const token = p.reactivationToken ?? newReactivationToken();
    if (!p.reactivationToken) {
      await db.talentProfile.update({ where: { id: p.id }, data: { reactivationToken: token } });
    }

    const delivered = await mail.reactivationInvite(p.user.email, {
      name: p.user.name,
      token,
    });
    if (!delivered) {
      failed++;
      console.warn(`[reactivation] delivery failed for ${p.user.email} — left in the queue`);
      continue;
    }
    await db.talentProfile.update({
      where: { id: p.id },
      data: { reactivationSentAt: new Date() },
    });
    sent++;
  }

  return { outreachOn, queued: pending.length, preview, sent, failed };
}

/** Back-office counts for the migrated pool. */
export async function reactivationStats() {
  const migrated = { legacyId: { not: null } };
  const [imported, invited, reactivated, published, untouched] = await Promise.all([
    db.talentProfile.count({ where: migrated }),
    db.talentProfile.count({ where: { ...migrated, reactivationSentAt: { not: null } } }),
    db.talentProfile.count({ where: { ...migrated, reactivatedAt: { not: null } } }),
    db.talentProfile.count({
      where: { ...migrated, reactivatedAt: { not: null }, publishedAt: { not: null } },
    }),
    db.talentProfile.count({ where: { ...migrated, reactivationSentAt: null } }),
  ]);
  return { imported, invited, reactivated, published, untouched };
}

import "server-only";
import { Resend } from "resend";
import type { ReactElement } from "react";
import {
  ConnectionRequested,
  PaymentReceipt,
  PayoutSent,
  ReferralConverted,
  ResetPassword,
  SlateDelivered,
  VerifyEmail,
  WelcomeTalent,
} from "@/emails/templates";

/**
 * All outbound mail funnels through send().
 *
 * Delivery is best-effort by design: a failed receipt must not roll back a
 * payment that already cleared, and a failed notification email must not fail
 * the request that caused it. Failures are logged loudly and returned as
 * false so callers can react if they actually care.
 */

let client: Resend | null = null;

function resend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  client ??= new Resend(key);
  return client;
}

/**
 * Two sending identities, for deliverability rather than tidiness.
 *
 * Affiliate mail behaves like marketing — ignored, sometimes marked spam.
 * Password resets and receipts have to reach the inbox. Sharing one sending
 * reputation means program complaints eventually bury the auth mail, and the
 * user-visible symptom is "I never got the reset email".
 *
 * Worth knowing: a different From on the SAME domain shares reputation.
 * EMAIL_FROM_PROGRAM only buys isolation if it is on a separately verified
 * subdomain. Unset, it falls back to the transactional sender — same
 * behaviour as before, no isolation.
 */
type Stream = "transactional" | "program";

function sender(stream: Stream): string | undefined {
  if (stream === "program") {
    return process.env.EMAIL_FROM_PROGRAM || process.env.EMAIL_FROM;
  }
  return process.env.EMAIL_FROM;
}

async function send(
  to: string,
  subject: string,
  react: ReactElement,
  stream: Stream = "transactional",
): Promise<boolean> {
  const api = resend();
  const from = sender(stream);

  if (!api || !from) {
    // Local dev without keys: say so once, out loud, rather than pretending
    // the mail went out.
    console.warn(`[email] not configured — skipped "${subject}" to ${to}`);
    return false;
  }

  try {
    const { error } = await api.emails.send({ from, to, subject, react });
    if (error) {
      console.error(`[email] send failed "${subject}" to ${to}`, error);
      return false;
    }
    return true;
  } catch (e) {
    console.error(`[email] threw sending "${subject}" to ${to}`, e);
    return false;
  }
}

export const mail = {
  resetPassword: (to: string, name: string, url: string) =>
    send(to, "Reset your shortlisted.ph password", ResetPassword({ name, url })),

  verifyEmail: (to: string, name: string, url: string) =>
    send(to, "Confirm your email address", VerifyEmail({ name, url })),

  welcomeTalent: (to: string, name: string) =>
    send(to, "Welcome to shortlisted.ph", WelcomeTalent({ name })),

  connectionRequested: (
    to: string,
    args: { name: string; company: string; jobTitle: string },
  ) => send(to, `${args.company} asked to be introduced`, ConnectionRequested(args)),

  slateDelivered: (
    to: string,
    args: { company: string; jobTitle: string; count: number; jdId: string },
  ) => send(to, `Your shortlist for ${args.jobTitle} is ready`, SlateDelivered(args)),

  paymentReceipt: (
    to: string,
    args: {
      name: string;
      description: string;
      amount: number;
      currency: string;
      reference: string;
      date: string;
    },
  ) => send(to, "Your shortlisted.ph receipt", PaymentReceipt(args)),

  // Affiliate program mail rides the program sender — see Stream above.
  referralConverted: (
    to: string,
    args: { name: string; referredName: string; code: string },
  ) =>
    send(
      to,
      `${args.referredName} signed up through your link`,
      ReferralConverted(args),
      "program",
    ),

  payoutSent: (
    to: string,
    args: { name: string; amount: number; method: string; reference: string },
  ) => send(to, "Your referral payout is on its way", PayoutSent(args), "program"),
};

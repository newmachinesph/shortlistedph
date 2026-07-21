import "server-only";
import { Resend } from "resend";
import { render, toPlainText } from "@react-email/components";
import nodemailer from "nodemailer";
import type { ReactElement } from "react";
import {
  AvailabilityPrompt,
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

/**
 * Dev mail goes to Mailpit over SMTP; production goes to Resend over HTTPS.
 *
 * Keyed off SMTP_HOST rather than NODE_ENV so the local path can be exercised
 * deliberately — and so a stray NODE_ENV in a deployed environment can never
 * silently reroute real user mail into a container that isn't there.
 *
 * Mailpit accepts anything: no auth, no TLS. Sending credentials to it would
 * only mean shipping them somewhere they aren't needed.
 */
function smtp() {
  const host = process.env.SMTP_HOST;
  if (!host) return null;
  return nodemailer.createTransport({
    host,
    port: Number(process.env.SMTP_PORT ?? 1025),
    secure: false,
    ignoreTLS: true,
  });
}

async function sendViaSmtp(
  transport: nodemailer.Transporter,
  from: string,
  to: string,
  subject: string,
  react: ReactElement,
): Promise<boolean> {
  try {
    // render() is async in this version; toPlainText() takes the rendered HTML,
    // so the text alternative always matches what was actually sent.
    const html = await render(react);
    await transport.sendMail({ from, to, subject, html, text: toPlainText(html) });
    console.info(`[email:smtp] sent "${subject}" to ${to} via ${process.env.SMTP_HOST}`);
    return true;
  } catch (e) {
    console.error(`[email:smtp] failed "${subject}" to ${to}`, e);
    return false;
  }
}

async function send(
  to: string,
  subject: string,
  react: ReactElement,
  stream: Stream = "transactional",
): Promise<boolean> {
  const from = sender(stream);

  const transport = smtp();
  if (transport && from) {
    return sendViaSmtp(transport, from, to, subject, react);
  }

  const api = resend();

  if (!api || !from) {
    // Local dev without keys: say so once, out loud, rather than pretending
    // the mail went out.
    console.warn(`[email] not configured — skipped "${subject}" to ${to}`);
    return false;
  }

  try {
    const { error } = await api.emails.send({ from, to, subject, react });
    if (error) {
      console.error(`[email:resend] send failed "${subject}" to ${to}`, error);
      return false;
    }
    console.info(`[email:resend] sent "${subject}" to ${to}`);
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

  availabilityPrompt: (to: string, name: string) =>
    send(to, "Are you still open to work?", AvailabilityPrompt({ name })),

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
    args: { name: string; amount: number; currency: string; method: string; reference: string },
  ) => send(to, "Your referral payout is on its way", PayoutSent(args), "program"),
};

import "server-only";
import { Resend } from "resend";
import { render, toPlainText } from "@react-email/components";
import nodemailer from "nodemailer";
import type { ReactElement } from "react";
import {
  AvailabilityPrompt,
  ConnectionRequested,
  MatchConsentRequest,
  PaymentReceipt,
  PayoutSent,
  ReferralConverted,
  ResetPassword,
  SlateDelivered,
  VerifyEmail,
  WelcomeTalent,
} from "@/emails/templates";
import { outreachEmailsEnabled } from "@/lib/settings";

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
 * Which transport to use. EMAIL_PROVIDER picks it explicitly ("smtp" | "resend"),
 * defaulting to SMTP — that is the intended production path (PrivateEmail) and
 * the local one (Mailpit), both over SMTP. Keyed off an explicit variable, not
 * NODE_ENV, so a stray NODE_ENV can never silently reroute real user mail.
 */
function provider(): "smtp" | "resend" {
  if (process.env.EMAIL_PROVIDER === "resend") return "resend";
  if (process.env.EMAIL_PROVIDER === "smtp") return "smtp";
  // No explicit choice: Resend when its key exists, otherwise SMTP. Keyed on
  // the credential itself so a half-configured environment still routes to
  // whichever transport can actually send.
  return process.env.RESEND_API_KEY ? "resend" : "smtp";
}

/**
 * One transport for both Mailpit and PrivateEmail.
 *
 * Auth is attached only when SMTP_USER is set — Mailpit accepts anything and
 * wants no credentials, PrivateEmail requires them. TLS follows the port:
 * 465 is implicit SSL (secure=true), anything else is plain/STARTTLS, and the
 * local :1025 case additionally ignores TLS so Mailpit's bare socket is fine.
 */
function smtp() {
  const host = process.env.SMTP_HOST;
  if (!host) return null;
  const port = Number(process.env.SMTP_PORT ?? 1025);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  const secure = process.env.SMTP_SECURE === "true" || port === 465;

  return nodemailer.createTransport({
    host,
    port,
    secure,
    // Mailpit has no TLS; a real server negotiates it. Only ignore TLS when
    // talking to an unauthenticated local relay.
    ignoreTLS: !user && !secure,
    ...(user ? { auth: { user, pass } } : {}),
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

/**
 * Kill switch for testing with real data: when the outreach_emails setting is
 * "off", only auth mail (password reset, email verification) is delivered —
 * everything else is logged and dropped. In-app notifications are not gated.
 */
type Kind = "auth" | "outreach";

async function send(
  to: string,
  subject: string,
  react: ReactElement,
  opts: { stream?: Stream; kind?: Kind } = {},
): Promise<boolean> {
  const { stream = "transactional", kind = "outreach" } = opts;

  if (kind !== "auth") {
    try {
      if (!(await outreachEmailsEnabled())) {
        console.info(`[email] suppressed (outreach off): ${subject} to ${to}`);
        return false;
      }
    } catch (e) {
      // Same best-effort contract as the transports: a settings read that
      // fails must not throw out of send(). Fail open — mail still goes.
      console.error("[email] could not read outreach setting — sending anyway", e);
    }
  }

  const from = sender(stream);
  const which = provider();

  if (which === "smtp") {
    const transport = smtp();
    if (transport && from) {
      return sendViaSmtp(transport, from, to, subject, react);
    }
    console.warn(
      `[email] EMAIL_PROVIDER=smtp but SMTP_HOST/EMAIL_FROM missing — skipped "${subject}" to ${to}`,
    );
    return false;
  }

  const api = resend();

  if (!api || !from) {
    console.warn(
      `[email] EMAIL_PROVIDER=resend but RESEND_API_KEY/EMAIL_FROM missing — skipped "${subject}" to ${to}`,
    );
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
    send(to, "Reset your shortlisted.ph password", ResetPassword({ name, url }), { kind: "auth" }),

  verifyEmail: (to: string, name: string, url: string) =>
    send(to, "Confirm your email address", VerifyEmail({ name, url }), { kind: "auth" }),

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
  ) => send(to, `We found matches for ${args.jobTitle}`, SlateDelivered(args)),

  // Consent-first matching: the candidate's yes/no. The caller (lib/consent.ts)
  // stamps sentAt/expiresAt only when this returns true, so the kill switch
  // (send() suppresses non-auth mail) can never start a countdown for an email
  // nobody received.
  matchConsentRequest: (
    to: string,
    args: {
      token: string;
      title: string;
      budgetMin: number | null;
      budgetMax: number | null;
      hoursPerWeek: number | null;
      overlap: string | null;
      mustHaves: string[];
    },
  ) => send(to, "You've been shortlisted", MatchConsentRequest(args)),

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
      { stream: "program" },
    ),

  payoutSent: (
    to: string,
    args: { name: string; amount: number; currency: string; method: string; reference: string },
  ) => send(to, "Your referral payout is on its way", PayoutSent(args), { stream: "program" }),
};

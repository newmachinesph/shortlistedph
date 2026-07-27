import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "./db";

/**
 * Notifications are a side effect, never a precondition. Writing one must not
 * be able to fail the action that earned it — a candidate's consent is not
 * worth rolling back because a bell icon did not light up.
 */

export type Side = "talent" | "employer";

export async function notify(args: {
  userId: string;
  type: string;
  payload: Record<string, string | number>;
}): Promise<void> {
  try {
    await db.notification.create({
      data: { userId: args.userId, type: args.type, payload: args.payload },
    });
  } catch (e) {
    console.error(`[notify] failed to store "${args.type}" for ${args.userId}`, e);
  }
}

export async function listNotifications(userId: string) {
  const [rows, unread] = await Promise.all([
    db.notification.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 50 }),
    db.notification.count({ where: { userId, readAt: null } }),
  ]);
  return { rows, unread };
}

// ─── Messaging access control ────────────────────────────────────────────

/**
 * The single definition of "may this account see this conversation".
 *
 * Both sides reach a Connection through its SlateEntry, but by different
 * relations: talent owns the frozen snapshot's profile, the employer owns the
 * JD the slate was built for. Defined once and used by the API and both pages —
 * a second copy is a second chance to get it wrong.
 *
 * Used as a WHERE filter, never as a post-fetch check, so a non-participant's
 * query returns nothing at all. Callers turn "nothing" into 403 without ever
 * revealing whether the connection exists.
 */
export type Participant =
  | { side: "talent"; userId: string }
  | { side: "employer"; employerId: string };

export function participantWhere(p: Participant): Prisma.ConnectionWhereInput {
  return p.side === "talent"
    ? { slateEntry: { snapshot: { profile: { userId: p.userId } } } }
    : { slateEntry: { slate: { jd: { employerId: p.employerId } } } };
}

/**
 * Messaging opens on consent and never before. A candidate who declined must
 * stay unreachable, so the state gate lives in the same filter as the
 * participant check rather than in a separate branch someone can forget.
 */
export const CONSENTED = "consented";

export function openThreadWhere(p: Participant): Prisma.ConnectionWhereInput {
  return { ...participantWhere(p), state: CONSENTED };
}

/** Stored payloads are Json — read them defensively, never assume a shape. */
function field(payload: unknown, key: string): string {
  if (payload && typeof payload === "object" && !Array.isArray(payload)) {
    const value = (payload as Record<string, unknown>)[key];
    if (typeof value === "string") return value;
    if (typeof value === "number") return String(value);
  }
  return "";
}

export type RenderedNotification = { text: string; href: string | null };

/**
 * A notification row outlives the code that wrote it. Old rows with dropped
 * fields, and types this build has never heard of, must still render as a
 * readable line rather than take the page down.
 */
export function renderNotification(
  type: string,
  payload: unknown,
  side: Side,
): RenderedNotification {
  const company = field(payload, "company") || "An employer";
  const jobTitle = field(payload, "jobTitle") || "a role";
  const connectionId = field(payload, "connectionId");
  const jdId = field(payload, "jdId");
  const thread = connectionId ? `/${side}/messages?c=${connectionId}` : `/${side}/messages`;

  switch (type) {
    case "connection_requested":
      return { text: `${company} asked to be introduced for ${jobTitle}.`, href: "/talent/connections" };
    case "connection_accepted":
      return { text: `Your connection request for ${jobTitle} was accepted.`, href: "/employer/connections" };
    case "connection_declined":
      return { text: `Your connection request for ${jobTitle} was declined.`, href: "/employer/connections" };
    case "slate_delivered": {
      const count = field(payload, "count");
      const size = count ? `${count} matches` : "your matches";
      return {
        text: `We found ${size} for ${jobTitle} — confirming availability now.`,
        href: jdId ? `/employer/briefs/${jdId}` : "/employer/briefs",
      };
    }
    case "slate_candidate_confirmed": {
      // The slate fills one accept at a time; without this the employer had to
      // keep reloading to notice anyone had said yes.
      const total = field(payload, "total");
      const who = total ? `${total} confirmed so far` : "a candidate confirmed";
      return {
        text: `A candidate confirmed for ${jobTitle} — ${who}.`,
        href: jdId ? `/employer/briefs/${jdId}` : "/employer/briefs",
      };
    }
    case "counterparty_unavailable":
      return {
        text: `The other party for ${jobTitle} is no longer available on shortlisted.ph.`,
        href: `/${side}/connections`,
      };
    case "agreement_active":
      return { text: `The agreement for ${jobTitle} is active.`, href: `/${side}/agreements` };
    case "agreement_signed":
      return {
        text: `The other side signed the agreement for ${jobTitle} — your signature is pending.`,
        href: `/${side}/agreements`,
      };
    case "outcome_confirmed": {
      const period = field(payload, "period");
      return {
        text: `${period ? `The ${period} outcome` : "An outcome"} for ${jobTitle} was confirmed by both sides.`,
        href: `/${side}/agreements`,
      };
    }
    case "payment_received": {
      const amount = field(payload, "amount");
      const currency = field(payload, "currency") || "USD";
      const what = field(payload, "description") || "your payment";
      const money = amount ? `${currency} ${amount}` : "Payment";
      return {
        text: `${money} received for ${what}.`,
        href: side === "employer" ? "/employer/billing" : "/referrals",
      };
    }
    case "payment_refunded": {
      const amount = field(payload, "amount");
      const currency = field(payload, "currency") || "USD";
      const money = amount ? `${currency} ${amount}` : "Your payment";
      // "returned" read as returned TO THEM. Unspent credits are revoked —
      // the money went back, so the goods come back too.
      return {
        text: `${money} was refunded. Any credits from it that you had not spent were removed.`,
        href: side === "employer" ? "/employer/billing" : null,
      };
    }
    case "rating_received":
      return { text: `You have a new rating for ${jobTitle}.`, href: `/${side}/ratings` };
    case "referral_signup": {
      const who = field(payload, "name") || "Someone";
      return { text: `${who} signed up through your referral link.`, href: "/referrals" };
    }
    case "referral_commission": {
      // The recurring model's whole pitch is that earnings keep arriving. Being
      // silent about the money made it invisible.
      const amount = field(payload, "amount");
      const currency = field(payload, "currency") || "USD";
      const money = amount ? `${currency} ${amount}` : "A commission";
      return { text: `${money} earned — a company you referred bought a shortlist.`, href: "/referrals" };
    }
    case "payout_paid": {
      const amount = field(payload, "amount");
      const currency = field(payload, "currency") || "USD";
      return { text: `Payout sent: ${currency} ${amount || ""}`.trim() + ".", href: "/referrals" };
    }
    case "payout_rejected": {
      const note = field(payload, "note");
      return {
        text: `Your payout request was rejected${note ? ` — ${note}` : ""}. The balance is back in your account.`,
        href: "/referrals",
      };
    }
    case "verification_verified":
      return { text: `Your identity is verified — the badge is live on your profile.`, href: "/talent/profile" };
    case "verification_rejected": {
      const note = field(payload, "note");
      return {
        text: `Identity verification could not be completed${note ? ` — ${note}` : ""}.`,
        href: "/talent/profile",
      };
    }
    case "message_received": {
      const from = field(payload, "from") || "Someone";
      return { text: `${from} sent you a message.`, href: thread };
    }
    case "interview_requested":
      // The candidate is asked to consent to being interviewed and recorded.
      return { text: `${company} requested an interview with you.`, href: "/talent/interviews" };
    case "interview_consented":
      // Confirming spends an interview credit bought earlier — no charge happens
      // at this step, so the copy must not promise one.
      return {
        text: `Your candidate agreed to the interview — confirm it to spend one interview credit.`,
        href: "/employer/interviews",
      };
    case "interview_declined":
      return { text: `Your candidate declined the interview.`, href: "/employer/interviews" };
    case "interview_cancelled": {
      const reason = field(payload, "reason");
      return {
        text: `An interview was cancelled${reason ? ` — ${reason}` : ""}.`,
        href: side === "employer" ? "/employer/interviews" : "/talent/interviews",
      };
    }
    case "interview_credit_returned":
      return {
        text: `One interview credit was returned to your balance.`,
        href: "/employer/interviews",
      };
    // Vetting decisions. Every one of these used to be silent, while both the
    // application page and the portal promised "we'll be in touch" — so an
    // approved interviewer had no way to learn they could start.
    case "interviewer_approved":
      return {
        text: `You're approved to run interviews — assignments appear in your portal.`,
        href: "/interviewer",
      };
    case "interviewer_rejected":
      return { text: `Your interviewer application was not approved.`, href: "/apply/interviewer" };
    case "interviewer_paused":
      return {
        text: `Your interviewer account is paused. Existing assignments are still yours to finish.`,
        href: "/interviewer",
      };
    case "interviewer_activated":
      return { text: `Your interviewer account is active again.`, href: "/interviewer" };
    case "interviewer_revoked":
      return { text: `Your interviewer access has ended.`, href: null };
    case "interview_meeting_link":
      // Separate from interview_scheduled: the time and the joinable link
      // arrive as two different events, and "there is now a link" is the one
      // that decides whether the call can actually happen.
      return { text: `Your interview now has a join link.`, href: `/${side}/interviews` };
    case "interview_assigned":
      return { text: `You have a confirmed interview to run for ${company}.`, href: "/interviewer" };
    case "interview_booked":
      return { text: `Your interview with ${company} is booked.`, href: "/talent/interviews" };
    case "interview_scheduled": {
      const when = field(payload, "when");
      const at = when ? new Date(when) : null;
      const time =
        at && !Number.isNaN(at.getTime())
          ? ` for ${at.toLocaleString("en-PH", {
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
              timeZone: "Asia/Manila",
            })}`
          : "";
      return { text: `Your interview is scheduled${time}.`, href: `/${side}/interviews` };
    }
    case "interview_reported":
      // Both sides get this now, so neither the wording nor the link may assume
      // the employer. A talent following a hardcoded /employer/interviews would
      // have been bounced off a page their role cannot open.
      return side === "employer"
        ? { text: `The interview assessment is ready.`, href: "/employer/interviews" }
        : {
            text: `Your interview assessment is ready — you can read it and download your recording.`,
            href: "/talent/interviews",
          };
    case "availability_check":
      return { text: `Still open to work? Confirm your availability.`, href: "/talent/profile" };
    default:
      // Unknown type: show the event, not a crash. "some_new_event" reads as
      // "Some new event" — ugly but honest, and the row stays clickable-free.
      return { text: `${type.replace(/_/g, " ").replace(/^./, (c) => c.toUpperCase())}.`, href: null };
  }
}

/**
 * Formatted on the server and passed down as a string. Computing it inside a
 * client component would render one value on the server and another on the
 * client, which is a hydration mismatch.
 */
export function relTime(at: Date, now: Date = new Date()): string {
  const minutes = Math.floor((now.getTime() - at.getTime()) / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return at.toLocaleDateString("en-PH", { month: "short", day: "numeric", timeZone: "Asia/Manila" });
}

export function stamp(at: Date): string {
  return at.toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "Asia/Manila",
  });
}

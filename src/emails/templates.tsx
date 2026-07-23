import { Link, Section, Text } from "@react-email/components";
import { SITE_URL } from "@/lib/site";
import { Shell, styles as s } from "./layout";

/**
 * Every transactional template lives here — they share one shell and one set
 * of styles, so splitting them across files would only add imports.
 *
 * Each export pairs with an entry in lib/email.ts, which owns subjects.
 */

function Button({ href, children }: { href: string; children: string }) {
  return (
    <Section style={{ padding: "6px 0 18px" }}>
      <Link href={href} style={s.button}>
        {children}
      </Link>
    </Section>
  );
}

function Fallback({ url }: { url: string }) {
  return (
    <Text style={{ ...s.small, wordBreak: "break-all" }}>
      Button not working? Paste this into your browser:{" "}
      <Link href={url} style={s.link}>
        {url}
      </Link>
    </Text>
  );
}

export function ResetPassword({ name, url }: { name: string; url: string }) {
  return (
    <Shell
      preview="Reset your shortlisted.ph password"
      footnote="This link expires in one hour. If you didn't ask for it, ignore this email — your password stays as it is."
    >
      <Text style={s.heading}>Reset your password</Text>
      <Text style={s.text}>
        Hi {name}, someone asked to reset the password for this account. If that
        was you, pick a new one here.
      </Text>
      <Button href={url}>Choose a new password</Button>
      <Fallback url={url} />
    </Shell>
  );
}

export function VerifyEmail({ name, url }: { name: string; url: string }) {
  return (
    <Shell
      preview="Confirm your email address"
      footnote="If you didn't create a shortlisted.ph account, you can ignore this."
    >
      <Text style={s.heading}>Confirm your email</Text>
      <Text style={s.text}>
        Hi {name}, one click and your account is live.
      </Text>
      <Button href={url}>Confirm email address</Button>
      <Fallback url={url} />
    </Shell>
  );
}

export function WelcomeTalent({ name }: { name: string }) {
  return (
    <Shell preview="Your shortlisted.ph profile is next">
      <Text style={s.heading}>Welcome, {name}</Text>
      <Text style={s.text}>
        You don&apos;t apply to jobs here. Employers describe the role, and we put
        forward the people who actually fit. Your job is to make the profile
        accurate — the matching runs on it.
      </Text>
      <Text style={s.text}>Two things worth doing today:</Text>
      <Section style={s.card}>
        <Text style={{ ...s.text, margin: "0 0 10px" }}>
          <strong style={{ color: s.palette.ink }}>Upload your resume.</strong>{" "}
          We read it and fill in your skills and history so you aren&apos;t typing
          it all out.
        </Text>
        <Text style={{ ...s.text, margin: 0 }}>
          <strong style={{ color: s.palette.ink }}>Set your rate.</strong>{" "}
          Employers filter on it. An empty rate keeps you out of shortlists you
          would otherwise top.
        </Text>
      </Section>
      <Button href={`${SITE_URL}/talent/profile`}>Finish your profile</Button>
    </Shell>
  );
}

export function AvailabilityPrompt({ name }: { name: string }) {
  return (
    <Shell
      preview="Are you still open to work?"
      footnote="Two taps keeps your profile in front of employers. If nothing has changed, just confirm."
    >
      <Text style={s.heading}>Still open to work, {name}?</Text>
      <Text style={s.text}>
        Employers see how recently each candidate confirmed they are available,
        and they reach out to the fresh ones first. A quick update keeps you in
        that group — say whether you are open and how soon you could start.
      </Text>
      <Button href={`${SITE_URL}/talent/profile`}>Update my availability</Button>
    </Shell>
  );
}

export function ConnectionRequested({
  name,
  company,
  jobTitle,
}: {
  name: string;
  company: string;
  jobTitle: string;
}) {
  return (
    <Shell
      preview={`${company} wants to talk to you`}
      footnote="Nothing is shared until you accept. Decline and they never see your contact details."
    >
      <Text style={s.heading}>{company} asked to be introduced</Text>
      <Text style={s.text}>
        Hi {name} — you were shortlisted for {jobTitle}, and the employer wants
        to take it further. Your contact details stay sealed until you say yes.
      </Text>
      <Button href={`${SITE_URL}/talent/connections`}>
        Review the request
      </Button>
    </Shell>
  );
}

export function SlateDelivered({
  company,
  jobTitle,
  count,
  jdId,
}: {
  company: string;
  jobTitle: string;
  count: number;
  jdId: string;
}) {
  return (
    <Shell preview={`Your shortlist for ${jobTitle} is ready`}>
      <Text style={s.heading}>Your shortlist is ready</Text>
      <Text style={s.text}>
        {company} — we matched {count}{" "}
        {count === 1 ? "candidate" : "candidates"} against {jobTitle}. Each one
        cleared your must-haves, your budget band, and your overlap hours.
      </Text>
      <Text style={s.text}>
        Scores and reasoning are visible now. Names and contact details unlock
        when you are ready to reach out.
      </Text>
      <Button href={`${SITE_URL}/employer/briefs/${jdId}`}>
        See the shortlist
      </Button>
    </Shell>
  );
}

export function PaymentReceipt({
  name,
  description,
  amount,
  currency,
  reference,
  date,
}: {
  name: string;
  description: string;
  amount: number;
  currency: string;
  reference: string;
  date: string;
}) {
  const formatted =
    currency === "PHP"
      ? `₱${amount.toFixed(2)}`
      : `$${amount.toFixed(2)} ${currency}`;
  return (
    <Shell
      preview={`Receipt — ${formatted}`}
      footnote="Keep this for your records. Reply to this email if anything looks wrong."
    >
      <Text style={s.heading}>Payment received</Text>
      <Text style={s.text}>
        Thanks {name}. Here is what we charged and what it was for.
      </Text>
      <Section style={s.card}>
        <Text style={s.label}>Item</Text>
        <Text style={{ ...s.value, marginBottom: "14px" }}>{description}</Text>
        <Text style={s.label}>Amount</Text>
        <Text style={{ ...s.value, marginBottom: "14px" }}>{formatted}</Text>
        <Text style={s.label}>Date</Text>
        <Text style={{ ...s.value, marginBottom: "14px" }}>{date}</Text>
        <Text style={s.label}>Reference</Text>
        <Text style={{ ...s.value, fontSize: "13px", fontWeight: 500 }}>
          {reference}
        </Text>
      </Section>
    </Shell>
  );
}

export function ReferralConverted({
  name,
  referredName,
  code,
}: {
  name: string;
  referredName: string;
  code: string;
}) {
  return (
    <Shell preview={`${referredName} signed up through your link`}>
      <Text style={s.heading}>Someone joined through your link</Text>
      <Text style={s.text}>
        Hi {name} — {referredName} signed up using{" "}
        <strong style={{ color: s.palette.ink }}>{code}</strong>. It counts as a
        referral the moment they qualify, and your dashboard tracks it from
        here.
      </Text>
      <Button href={`${SITE_URL}/talent/payouts`}>See your referrals</Button>
    </Shell>
  );
}

export function PayoutSent({
  name,
  amount,
  currency,
  method,
  reference,
}: {
  name: string;
  amount: number;
  /** The currency the payout was REQUESTED in — not necessarily what was sent. */
  currency: string;
  method: string;
  reference: string;
}) {
  // Requests are recorded in the currency the reward was earned in; the actual
  // transfer is pesos at the operator's rate on the day. Naming the requested
  // currency and saying the peso figure is separate is the only honest wording
  // available without an FX rate in the system.
  const requested = new Intl.NumberFormat("en-PH", { style: "currency", currency }).format(amount);
  return (
    <Shell preview="Your referral payout is on its way">
      <Text style={s.heading}>Payout sent</Text>
      <Text style={s.text}>
        Hi {name}, we sent your {requested} payout to your{" "}
        {method === "paypal" ? "PayPal" : `${method} account`}
        {method === "paypal" || currency === "PHP"
          ? "."
          : ", converted to pesos at the rate on the day it was transferred."}
      </Text>
      <Section style={s.card}>
        <Text style={s.label}>Reference</Text>
        <Text style={{ ...s.value, fontSize: "13px", fontWeight: 500 }}>
          {reference}
        </Text>
      </Section>
      <Text style={s.small}>
        Transfers usually land the same day. Tell us if it hasn&apos;t arrived
        within three working days.
      </Text>
    </Shell>
  );
}

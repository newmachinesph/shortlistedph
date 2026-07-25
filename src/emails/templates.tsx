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

export function WelcomeEmployer({ name, company }: { name: string; company: string }) {
  return (
    <Shell preview="Your first job description is next">
      <Text style={s.heading}>Welcome, {name}</Text>
      <Text style={s.text}>
        {company} is set up. You don&apos;t browse candidates here — you describe
        the role, and we build a ranked shortlist of people who fit it and have
        agreed to be put forward for it.
      </Text>
      <Text style={s.text}>How it goes from here:</Text>
      <Section style={s.card}>
        <Text style={{ ...s.text, margin: "0 0 10px" }}>
          <strong style={{ color: s.palette.ink }}>Write the job description.</strong>{" "}
          Budget band, hours, and must-haves do most of the matching. It stays
          hidden — candidates never browse it.
        </Text>
        <Text style={{ ...s.text, margin: 0 }}>
          <strong style={{ color: s.palette.ink }}>See the slate before paying.</strong>{" "}
          Scores and match reasons are free to read. $49 unlocks names, dossiers
          and connection requests for one shortlist.
        </Text>
      </Section>
      <Button href={`${SITE_URL}/employer/briefs/new`}>Write a job description</Button>
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

export function ConnectionAccepted({
  name,
  jobTitle,
}: {
  name: string;
  jobTitle: string;
}) {
  return (
    <Shell preview={`Your introduction for ${jobTitle} was accepted`}>
      <Text style={s.heading}>They said yes</Text>
      <Text style={s.text}>
        Hi {name} — the candidate you asked to be introduced to for {jobTitle}{" "}
        accepted. Their contact details are now on the connection, and the
        message thread is open.
      </Text>
      <Button href={`${SITE_URL}/employer/connections`}>Open the connection</Button>
    </Shell>
  );
}

export function ConnectionDeclined({
  name,
  jobTitle,
}: {
  name: string;
  jobTitle: string;
}) {
  return (
    <Shell
      preview={`Your introduction for ${jobTitle} was declined`}
      footnote="We don't pass on a reason, and declining doesn't cost the candidate anything. The rest of your shortlist is unaffected."
    >
      <Text style={s.heading}>That introduction was declined</Text>
      <Text style={s.text}>
        Hi {name} — the candidate turned down the introduction for {jobTitle}.
        Nothing about them was shared. Everyone else on the shortlist you
        unlocked is still open to hear from you.
      </Text>
      <Button href={`${SITE_URL}/employer/connections`}>See your connections</Button>
    </Shell>
  );
}

export function AgreementSigned({
  name,
  jobTitle,
  side,
}: {
  name: string;
  jobTitle: string;
  side: "talent" | "employer";
}) {
  return (
    <Shell preview={`The other side signed the agreement for ${jobTitle}`}>
      <Text style={s.heading}>Your signature is the last one</Text>
      <Text style={s.text}>
        Hi {name} — the other party signed the agreement for {jobTitle}. It
        becomes active once you sign too, and the monthly outcome check starts
        from there.
      </Text>
      <Button href={`${SITE_URL}/${side}/agreements`}>Read and sign</Button>
    </Shell>
  );
}

export function AgreementActive({
  name,
  jobTitle,
  side,
}: {
  name: string;
  jobTitle: string;
  side: "talent" | "employer";
}) {
  return (
    <Shell
      preview={`The agreement for ${jobTitle} is active`}
      footnote="We are sourcing only — payment and the working relationship are between the two of you. We never hold or handle wages."
    >
      <Text style={s.heading}>Both sides have signed</Text>
      <Text style={s.text}>
        Hi {name} — the agreement for {jobTitle} is active. Each month both of
        you confirm the work happened; those confirmations are what build the
        track record on this platform.
      </Text>
      <Button href={`${SITE_URL}/${side}/agreements`}>See the agreement</Button>
    </Shell>
  );
}

export function OutcomeConfirmed({
  name,
  jobTitle,
  period,
  side,
}: {
  name: string;
  jobTitle: string;
  /** Already human-readable, e.g. "July 2026" — the caller formats it. */
  period: string;
  side: "talent" | "employer";
}) {
  return (
    <Shell preview={`${period} for ${jobTitle} is confirmed`}>
      <Text style={s.heading}>{period} is confirmed</Text>
      <Text style={s.text}>
        Hi {name} — both sides have now confirmed {period} on {jobTitle}. The
        engagement counts as confirmed work, and the skills it covered are
        marked confirmed on the candidate&apos;s profile.
      </Text>
      <Button href={`${SITE_URL}/${side}/agreements`}>See the agreement</Button>
    </Shell>
  );
}

export function RatingReceived({
  name,
  jobTitle,
  side,
}: {
  name: string;
  jobTitle: string;
  side: "talent" | "employer";
}) {
  return (
    <Shell
      preview={`You have a new rating for ${jobTitle}`}
      footnote="Ratings are double-blind: neither side sees the other's until both have rated, or until 14 days have passed."
    >
      <Text style={s.heading}>Someone rated you</Text>
      <Text style={s.text}>
        Hi {name} — you were rated on {jobTitle}. We are not showing you what
        they wrote yet. Rate them back and both ratings unlock at once.
      </Text>
      <Button href={`${SITE_URL}/${side}/ratings`}>Leave your rating</Button>
    </Shell>
  );
}

export function MatchConsentRequest({
  token,
  title,
  budgetMin,
  budgetMax,
  hoursPerWeek,
  overlap,
  mustHaves,
}: {
  token: string;
  title: string;
  budgetMin: number | null;
  budgetMax: number | null;
  hoursPerWeek: number | null;
  overlap: string | null;
  mustHaves: string[];
}) {
  // GENERIC role facts only — never the employer or company name. The JD stays
  // hidden; the candidate decides on the role, not the brand.
  const rate =
    budgetMin != null && budgetMax != null
      ? budgetMin === budgetMax
        ? `$${budgetMin}/hr`
        : `$${budgetMin}–${budgetMax}/hr`
      : null;
  const accept = `${SITE_URL}/consent/${token}?a=yes`;
  const decline = `${SITE_URL}/consent/${token}?a=no`;
  return (
    <Shell
      preview="You've been shortlisted — are you interested?"
      footnote="This request expires 48 hours after it was sent. If we don't hear from you, we'll assume you're not interested this time and pause matching you with new roles until you next log in."
    >
      <Text style={s.heading}>You&apos;ve been shortlisted</Text>
      <Text style={s.text}>
        An employer&apos;s role matched your profile, and we&apos;d like to put you on
        their shortlist. Before we do, we need your yes — nothing about you is
        shown until you accept.
      </Text>
      <Section style={s.card}>
        <Text style={s.label}>Role</Text>
        <Text style={{ ...s.value, marginBottom: "14px" }}>{title}</Text>
        {rate && (
          <>
            <Text style={s.label}>Pays within</Text>
            <Text style={{ ...s.value, marginBottom: "14px" }}>{rate}</Text>
          </>
        )}
        {hoursPerWeek != null && (
          <>
            <Text style={s.label}>Hours</Text>
            <Text style={{ ...s.value, marginBottom: "14px" }}>{hoursPerWeek}h/week</Text>
          </>
        )}
        {overlap && (
          <>
            <Text style={s.label}>Timezone overlap</Text>
            <Text style={{ ...s.value, marginBottom: "14px" }}>{overlap}</Text>
          </>
        )}
        {mustHaves.length > 0 && (
          <>
            <Text style={s.label}>Must-haves</Text>
            <Text style={{ ...s.value, fontWeight: 500 }}>{mustHaves.join(" · ")}</Text>
          </>
        )}
      </Section>
      {rate && (
        <Text style={s.small}>The rate shown is what this job pays within.</Text>
      )}
      <Section style={{ padding: "6px 0 4px" }}>
        <Link href={accept} style={s.button}>
          I&apos;m interested
        </Link>
      </Section>
      <Section style={{ padding: "0 0 18px" }}>
        <Link href={decline} style={s.link}>
          Not this one, thanks
        </Link>
      </Section>
      <Fallback url={accept} />
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
    <Shell preview={`We found matches for ${jobTitle}`}>
      <Text style={s.heading}>We found your matches</Text>
      <Text style={s.text}>
        {company} — we matched {count}{" "}
        {count === 1 ? "candidate" : "candidates"} against {jobTitle}. Each one
        cleared your must-haves, your budget band, and your overlap hours, and
        we&apos;re confirming availability with them now.
      </Text>
      <Text style={s.text}>
        Your shortlist fills in as candidates confirm — we&apos;re also sourcing
        from other channels in parallel. Names and contact details unlock when
        you are ready to reach out.
      </Text>
      <Button href={`${SITE_URL}/employer/briefs/${jdId}`}>
        See your shortlist
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

export function CommissionEarned({
  name,
  amount,
  currency,
  balance,
}: {
  name: string;
  amount: number;
  currency: string;
  /** Total unpaid balance after this commission, same currency. */
  balance: number;
}) {
  const money = (n: number) =>
    new Intl.NumberFormat("en-PH", { style: "currency", currency }).format(n);
  // The referred company is never named. The affiliate knows who they referred;
  // what that company spends is between them and us.
  return (
    <Shell
      preview={`${money(amount)} commission earned`}
      footnote="This is recurring: you earn again every time the same company buys another shortlist, for as long as they keep buying."
    >
      <Text style={s.heading}>You earned {money(amount)}</Text>
      <Text style={s.text}>
        Hi {name} — a company you referred bought a shortlist, so{" "}
        {money(amount)} was added to your balance. You are now at{" "}
        {money(balance)} unpaid.
      </Text>
      <Button href={`${SITE_URL}/referrals`}>See your earnings</Button>
    </Shell>
  );
}

export function PayoutRejected({
  name,
  amount,
  currency,
  note,
}: {
  name: string;
  amount: number;
  currency: string;
  /** Operator's reason. Optional — a rejection with no note still has to read sensibly. */
  note?: string | null;
}) {
  const requested = new Intl.NumberFormat("en-PH", { style: "currency", currency }).format(amount);
  return (
    <Shell
      preview="Your payout request was rejected"
      footnote="Reply to this email if you think this was a mistake."
    >
      <Text style={s.heading}>We could not send that payout</Text>
      <Text style={s.text}>
        Hi {name} — your {requested} payout request was rejected
        {note ? "" : " and we did not record a reason"}. The full amount is back
        in your balance, so nothing was lost and you can request it again.
      </Text>
      {note && (
        <Section style={s.card}>
          <Text style={s.label}>Reason</Text>
          <Text style={{ ...s.value, fontWeight: 500 }}>{note}</Text>
        </Section>
      )}
      <Button href={`${SITE_URL}/referrals`}>Request it again</Button>
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

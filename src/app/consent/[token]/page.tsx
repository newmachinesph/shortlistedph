import type { Metadata } from "next";
import { CalendarClock, CheckCircle2, Clock3, MailX, XCircle } from "lucide-react";
import { NOINDEX } from "@/lib/site";
import { getConsentByToken, isConsentExpired } from "@/lib/consent";
import { candidateRoleLabel } from "@/lib/openings-shape";
import { rateBand } from "@/lib/format";
import { RespondButtons } from "@/components/consent-respond-buttons";

export const metadata: Metadata = { title: "You've been shortlisted", ...NOINDEX };

/**
 * PUBLIC consent response page — no login. The migrated pool has no passwords,
 * so the emailed token is the whole credential. Shows GENERIC JD facts only;
 * the employer's name never appears anywhere on the consent path.
 *
 * The email's Accept/Decline buttons land here with ?a=yes|no, but the page
 * deliberately ignores that param: mail scanners prefetch links with GET, and
 * acting on page load would let a scanner accept on the candidate's behalf.
 * The real yes/no is a POST from the buttons below.
 */
export default async function ConsentPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const consent = await getConsentByToken(token);

  return (
    <main className="flex flex-1 items-center justify-center bg-paper px-4 py-12">
      <div className="w-full max-w-lg">
        <p className="font-display mb-4 text-center text-lg font-semibold text-ink">
          shortlisted<span className="text-ember">.ph</span>
        </p>

        {!consent ? (
          <StatusCard
            icon={<MailX className="mx-auto h-8 w-8 text-ember" strokeWidth={1.5} />}
            title="This link is no longer valid"
            body="Double-check you opened the most recent email from us. If the problem persists, the request may have been withdrawn."
          />
        ) : consent.status === "accepted" ? (
          <StatusCard
            icon={<CheckCircle2 className="mx-auto h-8 w-8 text-brand" strokeWidth={1.5} />}
            title="You're on the shortlist"
            body="You accepted this request. The employer sees your profile as it stood when you said yes — if they want to talk, we'll email you and nothing is shared until you agree."
          />
        ) : consent.status === "declined" ? (
          <StatusCard
            icon={<XCircle className="mx-auto h-8 w-8 text-ink-faint" strokeWidth={1.5} />}
            title="You passed on this one"
            body="No problem — declining never counts against you, and you stay in the running for future roles."
          />
        ) : isConsentExpired(consent) ? (
          <StatusCard
            icon={<Clock3 className="mx-auto h-8 w-8 text-ember" strokeWidth={1.5} />}
            title="This request has expired"
            body="Consent requests stay open for 48 hours so employers get timely shortlists. Because this one lapsed, we've paused matching you with new roles. There is no switch to flip: opening your talent workspace lifts the pause by itself, immediately."
          />
        ) : (
          <div className="rounded-2xl border border-line bg-white p-6 sm:p-8">
            <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">
              You&rsquo;ve been shortlisted
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">
              An employer&rsquo;s role matched your profile. Say yes and you go on
              their shortlist as your profile stands today — nothing about you is
              shown until you accept.
            </p>

            <div className="mt-5 rounded-xl border border-line bg-paper p-5">
              <h2 className="font-medium text-ink">{candidateRoleLabel(consent.jd)}</h2>
              <p className="mt-1 text-sm text-ink-soft">
                {rateBand(consent.jd.budgetMin, consent.jd.budgetMax)
                  ? `${rateBand(consent.jd.budgetMin, consent.jd.budgetMax)} · `
                  : ""}
                {consent.jd.hoursPerWeek ? `${consent.jd.hoursPerWeek}h/wk · ` : ""}
                {consent.jd.overlap ? `overlap ${consent.jd.overlap}` : "no overlap requirement"}
              </p>
              {consent.jd.mustHaves.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {consent.jd.mustHaves.map((m) => (
                    <span
                      key={m}
                      className="rounded-full bg-brand-soft px-2.5 py-1 text-xs font-medium text-brand"
                    >
                      {m}
                    </span>
                  ))}
                </div>
              )}
              {rateBand(consent.jd.budgetMin, consent.jd.budgetMax) && (
                <p className="mt-3 text-xs text-ink-faint">
                  The rate shown is what this job pays within.
                </p>
              )}
            </div>

            <RespondButtons token={token} />

            <p className="mt-4 flex items-start gap-1.5 text-xs leading-relaxed text-ink-faint">
              <CalendarClock className="mt-0.5 h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
              This request expires 48 hours after it was sent. If we don&rsquo;t
              hear from you, we&rsquo;ll pause matching you with new roles until
              you next log in. Declining costs you nothing.
            </p>
          </div>
        )}
      </div>
    </main>
  );
}

function StatusCard({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-6 text-center sm:p-10">
      {icon}
      <h1 className="font-display mt-4 text-lg font-semibold text-ink">{title}</h1>
      <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink-soft">{body}</p>
    </div>
  );
}

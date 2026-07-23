import type { Metadata } from "next";
import { Check, FileSignature } from "lucide-react";
import { NOINDEX } from "@/lib/site";
import { db } from "@/lib/db";
import { employerOrOnboard, requirePageUser } from "@/lib/queries";
import { rateBand } from "@/lib/format";
import { Avatar } from "@/components/avatar";
import { stamp } from "@/lib/notify";
import { currentPeriod, periodLabel, readTerms } from "@/lib/agreements";
import { ConfirmOutcomeButton, SignAgreementButton } from "@/components/agreement-actions";

export const metadata: Metadata = { title: "Agreements", ...NOINDEX };

export default async function EmployerAgreementsPage() {
  const user = await requirePageUser("employer");
  const employer = await employerOrOnboard(user.id);
  const period = currentPeriod();

  const agreements = await db.agreement.findMany({
    where: { connection: { slateEntry: { slate: { jd: { employerId: employer.id } } } } },
    orderBy: { createdAt: "desc" },
    include: {
      outcomes: true,
      connection: {
        select: {
          slateEntry: {
            select: {
              snapshot: {
                select: {
                  jd: { select: { title: true } },
                  profile: { select: { user: { select: { name: true } } } },
                },
              },
            },
          },
        },
      },
    },
  });

  return (
    <>
      <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">Agreements</h1>
      <p className="mt-1 text-sm text-ink-soft">
        E-signed engagement terms between you and the talent you&rsquo;ve connected with.
        shortlisted.ph never touches salary.
      </p>

      {agreements.length === 0 ? (
        <div className="mt-7 rounded-2xl border border-line bg-white p-6 text-center sm:p-10">
          <FileSignature className="mx-auto h-8 w-8 text-ink-faint" strokeWidth={1.75} />
          <h2 className="font-display mt-4 text-lg font-semibold text-ink">No agreements yet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink-soft">
            When a candidate accepts your connection request, a draft agreement appears here with
            the role&rsquo;s terms, ready for both of you to sign.
          </p>
        </div>
      ) : (
        <div className="mt-7 space-y-4">
          {agreements.map((a) => {
            const snap = a.connection.slateEntry.snapshot;
            const terms = readTerms(a.terms);
            const active = Boolean(a.talentSignedAt && a.employerSignedAt);
            const outcomes = [...a.outcomes].sort((x, y) => y.period.localeCompare(x.period));
            const confirmedOutcomes = outcomes.filter(
              (o) => o.talentConfirmedAt && o.employerConfirmedAt,
            );
            const thisMonth = outcomes.find((o) => o.period === period);
            const termsLine = [
              rateBand(terms.budgetMin, terms.budgetMax),
              terms.hoursPerWeek ? `${terms.hoursPerWeek}h/wk` : null,
              terms.overlap ? `overlap ${terms.overlap}` : null,
            ]
              .filter(Boolean)
              .join(" · ");

            return (
              <div key={a.id} className="rounded-2xl border border-line bg-white p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <Avatar name={snap.profile.user.name} size="md" />
                    <div>
                      <h2 className="font-medium text-ink">{snap.jd.title}</h2>
                      <p className="text-sm text-ink-soft">{snap.profile.user.name}</p>
                    </div>
                  </div>
                  <span
                    className={
                      active
                        ? "rounded-full border border-brand/30 bg-brand-soft px-2.5 py-1 text-[11px] font-medium text-brand"
                        : "rounded-full border border-line px-2.5 py-1 text-[11px] text-ink-faint"
                    }
                  >
                    {active ? "Active" : "Draft — awaiting signatures"}
                  </span>
                </div>

                {termsLine && <p className="mt-4 text-sm text-ink-soft">{termsLine}</p>}

                <p className="mt-4 text-xs text-ink-faint">
                  {a.employerSignedAt
                    ? `You signed ${stamp(a.employerSignedAt)}`
                    : "You have not signed"}
                  {" · "}
                  {a.talentSignedAt
                    ? `They signed ${stamp(a.talentSignedAt)}`
                    : "They have not signed"}
                </p>
                {!a.employerSignedAt && (
                  <div className="mt-3">
                    <SignAgreementButton agreementId={a.id} />
                  </div>
                )}

                {active && (
                  <div className="mt-5 border-t border-line pt-4">
                    <h3 className="text-xs font-medium uppercase tracking-wider text-ink-faint">
                      Monthly outcomes · {confirmedOutcomes.length} confirmed
                    </h3>
                    <div className="mt-3">
                      {thisMonth?.employerConfirmedAt && thisMonth?.talentConfirmedAt ? (
                        <p className="text-sm text-ink-soft">
                          {periodLabel(period)} confirmed by both sides.
                        </p>
                      ) : thisMonth?.employerConfirmedAt ? (
                        <p className="text-sm text-ink-soft">
                          You confirmed {periodLabel(period)} — waiting for {snap.profile.user.name}.
                        </p>
                      ) : (
                        <>
                          {thisMonth?.talentConfirmedAt && (
                            <p className="mb-2 text-sm text-ink-soft">
                              {snap.profile.user.name} already confirmed {periodLabel(period)}.
                            </p>
                          )}
                          <ConfirmOutcomeButton
                            agreementId={a.id}
                            period={period}
                            label={periodLabel(period)}
                          />
                        </>
                      )}
                    </div>
                    {confirmedOutcomes.length > 0 && (
                      <ul className="mt-4 space-y-1.5">
                        {confirmedOutcomes.map((o) => (
                          <li
                            key={o.id}
                            className="flex items-center gap-1.5 text-xs text-ink-soft"
                          >
                            <Check className="h-3.5 w-3.5 text-brand" strokeWidth={2} />
                            {periodLabel(o.period)} — delivered &amp; paid, confirmed by both sides
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-5 rounded-2xl border border-line bg-brand-soft/50 p-6">
        <h2 className="font-medium text-ink">How outcome confirmation works</h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-soft">
          Each month, both of you confirm whether the engagement was paid and delivered. Two matching
          confirmations build the payment-verified history employers and talent both rely on.
        </p>
      </div>

      <p className="mt-8 text-xs text-ink-faint">
        shortlisted.ph never processes salary or payroll — you pay the people you hire directly. We
        only ever charge for the shortlist.
      </p>
    </>
  );
}

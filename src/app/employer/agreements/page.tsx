import type { Metadata } from "next";
import { FileSignature } from "lucide-react";
import { NOINDEX } from "@/lib/site";
import { db } from "@/lib/db";
import { employerOrOnboard, requirePageUser } from "@/lib/queries";
import { initials } from "@/lib/format";
import { stamp } from "@/lib/notify";

export const metadata: Metadata = { title: "Agreements", ...NOINDEX };

export default async function EmployerAgreementsPage() {
  const user = await requirePageUser("employer");
  const employer = await employerOrOnboard(user.id);

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
        <div className="mt-7 rounded-2xl border border-line bg-white p-10 text-center">
          <FileSignature className="mx-auto h-8 w-8 text-ink-faint" strokeWidth={1.75} />
          <h2 className="font-display mt-4 text-lg font-semibold text-ink">No agreements yet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink-soft">
            An agreement records the terms you and a candidate settle on after a connection is
            accepted. Signing is not built yet — until it is, agree your terms directly with the
            candidate and nothing will appear here.
          </p>
        </div>
      ) : (
        <div className="mt-7 space-y-4">
          {agreements.map((a) => {
            const snap = a.connection.slateEntry.snapshot;
            const confirmed = a.outcomes.filter(
              (o) => o.talentConfirmedAt && o.employerConfirmedAt,
            ).length;

            return (
              <div key={a.id} className="rounded-2xl border border-line bg-white p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="font-display flex h-10 w-10 items-center justify-center rounded-xl bg-brand-soft font-semibold text-brand">
                      {initials(snap.profile.user.name)}
                    </span>
                    <div>
                      <h2 className="font-medium text-ink">{snap.jd.title}</h2>
                      <p className="text-sm text-ink-soft">{snap.profile.user.name}</p>
                    </div>
                  </div>
                  <span className="rounded-full border border-line px-2.5 py-1 text-[11px] text-ink-faint">
                    {confirmed} of {a.outcomes.length} outcomes confirmed
                  </span>
                </div>
                <p className="mt-5 text-xs text-ink-faint">
                  {a.employerSignedAt
                    ? `You signed ${stamp(a.employerSignedAt)}`
                    : "You have not signed"}
                  {" · "}
                  {a.talentSignedAt
                    ? `They signed ${stamp(a.talentSignedAt)}`
                    : "They have not signed"}
                </p>
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

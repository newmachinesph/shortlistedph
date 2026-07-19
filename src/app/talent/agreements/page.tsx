import type { Metadata } from "next";
import { FileSignature } from "lucide-react";
import { NOINDEX } from "@/lib/site";
import { db } from "@/lib/db";
import { requirePageUser, talentOrOnboard } from "@/lib/queries";
import { stamp } from "@/lib/notify";

export const metadata: Metadata = { title: "Agreements", ...NOINDEX };

export default async function TalentAgreementsPage() {
  const user = await requirePageUser("talent");
  await talentOrOnboard(user.id);

  const agreements = await db.agreement.findMany({
    where: { connection: { slateEntry: { snapshot: { profile: { userId: user.id } } } } },
    orderBy: { createdAt: "desc" },
    include: {
      outcomes: true,
      connection: {
        select: {
          slateEntry: {
            select: {
              snapshot: {
                select: {
                  jd: {
                    select: { title: true, employer: { select: { companyName: true } } },
                  },
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
        Signed, active, and past terms — your pay is agreed here, not negotiated in chat.
      </p>

      {agreements.length === 0 ? (
        <div className="mt-7 rounded-2xl border border-line bg-white p-10 text-center">
          <FileSignature className="mx-auto h-8 w-8 text-ink-faint" strokeWidth={1.75} />
          <h2 className="font-display mt-4 text-lg font-semibold text-ink">No agreements yet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink-soft">
            An agreement records the terms you and an employer settle on after you accept a
            connection. Signing is not built yet — until it is, agree your terms directly with the
            employer and nothing will appear here.
          </p>
        </div>
      ) : (
        <div className="mt-7 space-y-4">
          {agreements.map((a) => {
            const jd = a.connection.slateEntry.snapshot.jd;
            const confirmed = a.outcomes.filter(
              (o) => o.talentConfirmedAt && o.employerConfirmedAt,
            ).length;

            return (
              <section key={a.id} className="rounded-2xl border border-line bg-white p-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="font-medium text-ink">{jd.employer.companyName}</h2>
                    <p className="text-sm text-ink-soft">{jd.title}</p>
                  </div>
                  <span className="rounded-full border border-line px-2.5 py-1 text-[11px] text-ink-faint">
                    {confirmed} of {a.outcomes.length} outcomes confirmed
                  </span>
                </div>
                <p className="mt-5 text-xs text-ink-faint">
                  {a.talentSignedAt ? `You signed ${stamp(a.talentSignedAt)}` : "You have not signed"}
                  {" · "}
                  {a.employerSignedAt
                    ? `They signed ${stamp(a.employerSignedAt)}`
                    : "They have not signed"}
                </p>
              </section>
            );
          })}
        </div>
      )}

      <section className="mt-5 rounded-2xl border border-line bg-white p-6">
        <h2 className="text-sm font-medium uppercase tracking-wider text-ink-faint">
          How outcomes get confirmed
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-soft">
          Once a month, you and the employer both confirm the work was delivered and paid. Each
          matching confirmation adds one payment-verified engagement to your profile — proof
          employers can see, not just a claim.
        </p>
      </section>

      <p className="mt-5 text-xs leading-relaxed text-ink-faint">
        Your salary is paid directly to you by your employer. shortlisted.ph never holds or takes a
        cut of your pay.
      </p>
    </>
  );
}

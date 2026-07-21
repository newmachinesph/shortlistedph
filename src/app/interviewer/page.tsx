import { redirect } from "next/navigation";
import { ClipboardList, Wallet } from "lucide-react";
import { getSessionUser } from "@/lib/session";
import {
  getInterviewer,
  INTERVIEW_DURATION_MINUTES,
  RECOMMENDATIONS,
  RECOMMENDATION_LABEL,
} from "@/lib/interviews";
import type { FrozenProfile } from "@/lib/slate";
import { listAssignments, listEarnings } from "./queries";
import { InterviewerAssignment } from "@/components/interviewer-assignment";

const usd = (n: number) => `$${n.toFixed(2)}`;

export default async function InterviewerHome() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const interviewer = await getInterviewer(user.id);
  if (!interviewer) redirect("/apply/interviewer");

  const [assignments, earnings] = await Promise.all([
    listAssignments(interviewer.id),
    listEarnings(interviewer.id),
  ]);

  // RECOMMENDATIONS lives server-side (interviews.ts is server-only) — pass the
  // options down so the client form never imports it.
  const recommendationOptions = RECOMMENDATIONS.map((r) => ({ value: r, label: RECOMMENDATION_LABEL[r] }));

  const cards = assignments.map((a) => {
    const p = a.slateEntry.snapshot.frozenJson as FrozenProfile;
    return {
      id: a.id,
      status: a.status,
      scheduledAt: a.scheduledAt ? a.scheduledAt.toISOString() : null,
      hasRecording: Boolean(a.recordingKey),
      company: a.employer.companyName,
      candidate: {
        name: a.talent.name,
        headline: p.headline,
        city: p.city,
        yearsExperience: p.yearsExperience,
        skills: p.skills.map((s) => s.name),
      },
    };
  });

  return (
    <>
      <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">Assignments</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Interviews you&rsquo;ve been assigned. Schedule the call, run and upload the recording, then
        file the assessment.
      </p>

      {cards.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-line bg-white p-6 text-center sm:p-10">
          <ClipboardList className="mx-auto h-8 w-8 text-ink-faint" strokeWidth={1.5} />
          <h2 className="font-display mt-4 text-lg font-semibold text-ink">Nothing to run yet</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-ink-soft">
            When an employer books you for a candidate, the interview shows up here.
          </p>
        </div>
      ) : (
        <div className="mt-6 space-y-5">
          {cards.map((c) => (
            <InterviewerAssignment
              key={c.id}
              assignment={c}
              durationMinutes={INTERVIEW_DURATION_MINUTES}
              recommendationOptions={recommendationOptions}
            />
          ))}
        </div>
      )}

      <section className="mt-10">
        <div className="flex items-center gap-2">
          <Wallet className="h-5 w-5 text-ink-soft" strokeWidth={1.75} />
          <h2 className="font-display text-xl font-semibold tracking-tight text-ink">Earnings</h2>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-4">
          <div className="rounded-2xl border border-line bg-white p-5">
            <p className="text-xs font-medium uppercase tracking-wider text-ink-faint">Total earned</p>
            <p className="font-display mt-1 text-2xl font-semibold text-ink">{usd(earnings.totalEarned)}</p>
            <p className="mt-0.5 text-xs text-ink-faint">{earnings.reported.length} reported</p>
          </div>
          <div className="rounded-2xl border border-line bg-white p-5">
            <p className="text-xs font-medium uppercase tracking-wider text-ink-faint">Paid out</p>
            <p className="font-display mt-1 text-2xl font-semibold text-ink">{usd(earnings.totalPaid)}</p>
            <p className="mt-0.5 text-xs text-ink-faint">
              {usd(Math.max(0, earnings.totalEarned - earnings.totalPaid))} pending
            </p>
          </div>
        </div>

        {earnings.reported.length > 0 && (
          <div className="mt-4 overflow-hidden rounded-2xl border border-line bg-white">
            <p className="border-b border-line px-5 py-3 text-xs font-medium uppercase tracking-wider text-ink-faint">
              Completed interviews
            </p>
            <ul className="divide-y divide-line">
              {earnings.reported.map((r) => (
                <li key={r.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">{r.talent.name}</p>
                    <p className="truncate text-xs text-ink-faint">{r.employer.companyName}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-medium text-ink">{usd(r.interviewerPayoutUsd)}</p>
                    <p className="text-xs text-ink-faint">{r.payoutId ? "Settled" : "Awaiting payout"}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        )}

        {earnings.payouts.length > 0 && (
          <div className="mt-4 overflow-hidden rounded-2xl border border-line bg-white">
            <p className="border-b border-line px-5 py-3 text-xs font-medium uppercase tracking-wider text-ink-faint">
              Payout history
            </p>
            <ul className="divide-y divide-line">
              {earnings.payouts.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink">
                      {usd(p.amount)} <span className="font-normal text-ink-faint">{p.currency}</span>
                    </p>
                    <p className="truncate text-xs text-ink-faint">
                      {p.method}
                      {p.reference ? ` · ${p.reference}` : ""}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ${
                      p.status === "paid"
                        ? "bg-brand-soft text-brand"
                        : p.status === "rejected"
                          ? "bg-ember-soft text-ember"
                          : "border border-line text-ink-faint"
                    }`}
                  >
                    {p.status}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </>
  );
}

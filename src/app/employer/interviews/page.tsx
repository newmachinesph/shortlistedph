import type { Metadata } from "next";
import { Video } from "lucide-react";
import { db } from "@/lib/db";
import { employerOrOnboard, requirePageUser } from "@/lib/queries";
import { INTERVIEW_PRICE_USD, RECOMMENDATION_LABEL, type Recommendation } from "@/lib/interviews";
import { PRODUCTS } from "@/lib/payments";
import { stamp } from "@/lib/notify";
import { presignDownload } from "@/lib/r2";
import { NOINDEX } from "@/lib/site";
import { BuyButton } from "@/app/employer/billing/buy-button";
import { InterviewConfirmButton } from "@/components/interview-confirm-button";
import { InterviewCancelButton } from "@/components/interview-cancel-button";
import { InterviewCapture } from "@/components/interview-capture";

export const metadata: Metadata = { title: "Interviews", ...NOINDEX };

const STATUS_LABEL: Record<string, string> = {
  requested: "Waiting on candidate",
  consented: "Ready to confirm",
  paid: "Confirmed — scheduling",
  scheduled: "Scheduled",
  recorded: "Recorded — assessment pending",
  reported: "Completed",
  declined: "Declined",
  cancelled: "Cancelled",
};

const GROUPS: { title: string; statuses: string[] }[] = [
  { title: "Waiting on candidate", statuses: ["requested"] },
  { title: "Ready to confirm", statuses: ["consented"] },
  { title: "Scheduled", statuses: ["paid", "scheduled", "recorded"] },
  { title: "Completed — view report", statuses: ["reported"] },
  { title: "Declined", statuses: ["declined"] },
  { title: "Cancelled", statuses: ["cancelled"] },
];

function ScoreBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-32 shrink-0 text-xs text-ink-faint">{label}</span>
      <span className="h-2 flex-1 overflow-hidden rounded-full bg-line">
        <span
          className="block h-full rounded-full bg-brand"
          style={{ width: `${(value / 5) * 100}%` }}
        />
      </span>
      <span className="w-8 shrink-0 text-right text-xs font-medium text-ink">{value}/5</span>
    </div>
  );
}

export default async function InterviewsPage({
  searchParams,
}: {
  searchParams: Promise<{ paid?: string }>;
}) {
  const { paid } = await searchParams;
  const user = await requirePageUser("employer");
  const employer = await employerOrOnboard(user.id);

  const interviews = await db.interview.findMany({
    where: { employerId: employer.id },
    orderBy: { createdAt: "desc" },
    // ponytail: bound the list like every other list in the app — a long-lived
    // high-volume employer shouldn't load their whole interview history.
    take: 200,
    include: {
      interviewer: { select: { user: { select: { name: true } } } },
      talent: { select: { name: true } },
      assessment: true,
    },
  });

  // Sign the recording links for finished interviews up front, in parallel —
  // independent R2 reads, so no reason to await them one at a time. A
  // short-lived presigned URL minted at render is fine for a click that follows
  // the load; ponytail: 1h ceiling — route through an endpoint if bookmarked.
  const signed = await Promise.all(
    interviews
      .filter((iv) => iv.status === "reported" && iv.recordingKey)
      .map(async (iv) => {
        try {
          return [iv.id, await presignDownload(iv.recordingKey!, 3600)] as const;
        } catch (e) {
          console.error("[interviews] could not sign recording", e);
          return null;
        }
      }),
  );
  const recordingUrls = new Map(signed.filter((x): x is [string, string] => x !== null));

  return (
    <>
      <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">Interviews</h1>
      <p className="mt-1 text-sm leading-relaxed text-ink-soft">
        Have a vetted interviewer run a recorded 30-minute interview of a shortlisted candidate and
        file an assessment. Each interview costs 1 interview credit (${INTERVIEW_PRICE_USD} each). The
        candidate consents first — a credit is only spent once they agree.
      </p>

      <div className="mt-6">
        <InterviewCapture shouldCapture={paid === "1"} />
      </div>

      <div className="mt-6 rounded-2xl border border-line bg-white p-6">
        <p className="text-xs text-ink-faint">Interview credits</p>
        <p className="font-display mt-1.5 text-4xl font-semibold text-brand">
          {employer.interviewCredits}
        </p>
        <p className="mt-1 text-sm text-ink-soft">
          Each credit books one interview (${INTERVIEW_PRICE_USD} each). Buy ahead so a credit is
          ready the moment a candidate agrees.
        </p>
        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-line bg-white p-5">
            <h3 className="font-medium text-ink">{PRODUCTS.interview_single.label}</h3>
            <p className="font-display mt-2 text-2xl font-semibold text-ink">
              ${PRODUCTS.interview_single.amount}
            </p>
            <p className="mt-1 mb-4 text-sm text-ink-soft">1 interview credit</p>
            <BuyButton
              productId="interview_single"
              label="Buy 1 credit"
              variant="ghost"
              pendingKey="pendingInterviewOrder"
            />
          </div>
          <div className="rounded-2xl border-2 border-brand bg-white p-5">
            <div className="flex items-center gap-2">
              <h3 className="font-medium text-ink">{PRODUCTS.interview_five.label}</h3>
              <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-medium text-brand">
                best value
              </span>
            </div>
            <p className="font-display mt-2 text-2xl font-semibold text-ink">
              ${PRODUCTS.interview_five.amount}
            </p>
            <p className="mt-1 mb-4 text-sm text-ink-soft">5 interview credits · $14 each</p>
            <BuyButton
              productId="interview_five"
              label="Buy 5 credits"
              pendingKey="pendingInterviewOrder"
            />
          </div>
        </div>
      </div>

      {interviews.length === 0 ? (
        <div className="mt-6 rounded-2xl border border-line bg-white p-8 text-center sm:p-10">
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-soft">
            <Video className="h-5 w-5 text-brand" strokeWidth={1.75} />
          </span>
          <h2 className="font-display mt-4 text-lg font-semibold text-ink">No interviews yet</h2>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-ink-soft">
            Open a candidate on an unlocked shortlist and choose &ldquo;Interview this
            candidate&rdquo;. A vetted interviewer runs a recorded 30-minute interview and returns a
            structured assessment you can compare across candidates. You buy interview credits up
            front; a credit is only spent once the candidate agrees and you confirm.
          </p>
        </div>
      ) : (
        GROUPS.map((group) => {
          const items = interviews.filter((iv) => group.statuses.includes(iv.status));
          if (items.length === 0) return null;
          return (
            <section key={group.title} className="mt-8">
              <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-ink-faint">
                {group.title}
              </h2>
              <div className="space-y-4">
                {items.map((iv) => {
                  const firstName = iv.talent.name.split(" ")[0];
                  return (
                    <div key={iv.id} className="rounded-2xl border border-line bg-white p-5 sm:p-6">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="font-medium text-ink">{iv.talent.name}</h3>
                          <p className="mt-0.5 text-sm text-ink-soft">
                            Interviewer: {iv.interviewer.user.name} · 1 interview credit
                          </p>
                        </div>
                        <span className="shrink-0 rounded-full bg-brand-soft px-2.5 py-1 text-[11px] font-medium text-brand">
                          {STATUS_LABEL[iv.status] ?? iv.status}
                        </span>
                      </div>

                      {(iv.suggestedQuestions.length > 0 || iv.employerNotes) && (
                        <div className="mt-4 rounded-xl border border-line bg-paper p-4">
                          <p className="text-xs font-medium uppercase tracking-wider text-ink-faint">
                            What you sent the interviewer
                          </p>
                          {iv.employerNotes && (
                            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-ink-soft">
                              {iv.employerNotes}
                            </p>
                          )}
                          {iv.suggestedQuestions.length > 0 && (
                            <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm leading-relaxed text-ink-soft">
                              {iv.suggestedQuestions.map((q, i) => (
                                <li key={i}>{q}</li>
                              ))}
                            </ol>
                          )}
                        </div>
                      )}

                      {iv.status === "requested" && (
                        <>
                          <p className="mt-3 text-sm leading-relaxed text-ink-soft">
                            We&rsquo;ve asked {firstName} to consent to a recorded interview. No
                            credit is spent unless they agree and you confirm.
                          </p>
                          <div className="mt-4">
                            <InterviewCancelButton interviewId={iv.id} />
                          </div>
                        </>
                      )}

                      {iv.status === "consented" && (
                        <>
                          <p className="mt-3 text-sm leading-relaxed text-ink-soft">
                            {firstName} agreed to the recorded interview. Confirm to spend 1 interview
                            credit and we&rsquo;ll schedule it. The interview is recorded, and the
                            recording is shared with you.
                          </p>
                          {employer.interviewCredits > 0 ? (
                            <div className="mt-4 flex flex-wrap items-center gap-3">
                              <InterviewConfirmButton interviewId={iv.id} />
                              <InterviewCancelButton interviewId={iv.id} />
                            </div>
                          ) : (
                            <div className="mt-4 rounded-xl border border-line bg-paper p-4">
                              <p className="text-sm leading-relaxed text-ink-soft">
                                You have no interview credits left. Buy interview credits (${INTERVIEW_PRICE_USD}{" "}
                                each) above to confirm this interview.
                              </p>
                              <div className="mt-3">
                                <InterviewCancelButton interviewId={iv.id} />
                              </div>
                            </div>
                          )}
                        </>
                      )}

                      {(iv.status === "paid" || iv.status === "scheduled") && (
                        <>
                          <p className="mt-3 text-sm leading-relaxed text-ink-soft">
                            Confirmed.
                            {iv.scheduledAt
                              ? ` Scheduled for ${stamp(iv.scheduledAt)}.`
                              : " We're arranging a time with the interviewer."}{" "}
                            The assessment and recording will appear here once the interview is done.
                          </p>
                          {/* The link the interviewer runs the call on. You are
                              paying for this interview — you get to sit in. */}
                          {iv.meetingUrl ? (
                            <a
                              href={iv.meetingUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-3 inline-flex min-h-11 items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium text-brand ring-1 ring-inset ring-brand/30 transition-colors hover:bg-brand-soft"
                            >
                              <Video className="h-4 w-4" strokeWidth={1.75} /> Join the interview
                            </a>
                          ) : (
                            <p className="mt-3 text-sm text-ink-faint">
                              The join link appears here once the interviewer posts it.
                            </p>
                          )}
                        </>
                      )}

                      {iv.status === "recorded" && (
                        <p className="mt-3 text-sm leading-relaxed text-ink-soft">
                          The interview has been recorded. The interviewer is finalising the
                          assessment — it will appear here shortly.
                        </p>
                      )}

                      {iv.status === "declined" && (
                        <p className="mt-3 text-sm leading-relaxed text-ink-soft">
                          {firstName} declined the interview, so it did not go ahead. No credit was
                          spent — it stays on your balance.
                        </p>
                      )}

                      {iv.status === "cancelled" && (
                        <p className="mt-3 text-sm leading-relaxed text-ink-soft">
                          This request was cancelled. No credit was spent — it stays on your balance.
                        </p>
                      )}

                      {iv.status === "reported" && iv.assessment && (
                        <div className="mt-4 border-t border-line pt-4">
                          <span className="inline-flex rounded-full bg-brand-soft px-3 py-1 text-sm font-semibold text-brand">
                            {RECOMMENDATION_LABEL[iv.assessment.recommendation as Recommendation] ??
                              iv.assessment.recommendation}
                          </span>

                          <div className="mt-4 space-y-2">
                            <ScoreBar label="Overall" value={iv.assessment.overall} />
                            <ScoreBar label="Technical" value={iv.assessment.technical} />
                            <ScoreBar label="Communication" value={iv.assessment.communication} />
                            <ScoreBar label="English fluency" value={iv.assessment.englishFluency} />
                          </div>

                          <div className="mt-5 space-y-4">
                            <div>
                              <h4 className="text-xs font-medium uppercase tracking-wider text-ink-faint">
                                Strengths
                              </h4>
                              <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-ink-soft">
                                {iv.assessment.strengths}
                              </p>
                            </div>
                            <div>
                              <h4 className="text-xs font-medium uppercase tracking-wider text-ink-faint">
                                Concerns
                              </h4>
                              <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-ink-soft">
                                {iv.assessment.concerns}
                              </p>
                            </div>
                            {iv.assessment.notes && (
                              <div>
                                <h4 className="text-xs font-medium uppercase tracking-wider text-ink-faint">
                                  Notes
                                </h4>
                                <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-ink-soft">
                                  {iv.assessment.notes}
                                </p>
                              </div>
                            )}
                          </div>

                          <div className="mt-5">
                            {recordingUrls.has(iv.id) ? (
                              <a
                                href={recordingUrls.get(iv.id)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium text-brand ring-1 ring-inset ring-brand/30 transition-colors hover:bg-brand-soft"
                              >
                                <Video className="h-4 w-4" strokeWidth={1.75} /> Watch the recording
                              </a>
                            ) : iv.recordingKey ? (
                              <p className="text-sm text-ink-faint">
                                A recording of this interview is on file.
                              </p>
                            ) : null}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          );
        })
      )}
    </>
  );
}

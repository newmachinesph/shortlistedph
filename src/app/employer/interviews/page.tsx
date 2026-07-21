import type { Metadata } from "next";
import { Video } from "lucide-react";
import { db } from "@/lib/db";
import { employerOrOnboard, requirePageUser } from "@/lib/queries";
import { RECOMMENDATION_LABEL, type Recommendation } from "@/lib/interviews";
import { stamp } from "@/lib/notify";
import { presignDownload } from "@/lib/r2";
import { NOINDEX } from "@/lib/site";
import { InterviewPayButton } from "@/components/interview-pay-button";
import { InterviewCancelButton } from "@/components/interview-cancel-button";
import { InterviewCapture } from "@/components/interview-capture";

export const metadata: Metadata = { title: "Interviews", ...NOINDEX };

const STATUS_LABEL: Record<string, string> = {
  requested: "Waiting on candidate",
  consented: "Ready to pay",
  paid: "Paid — scheduling",
  scheduled: "Scheduled",
  recorded: "Recorded — assessment pending",
  reported: "Completed",
  declined: "Declined",
  cancelled: "Cancelled",
};

const GROUPS: { title: string; statuses: string[] }[] = [
  { title: "Waiting on candidate", statuses: ["requested"] },
  { title: "Ready to pay", statuses: ["consented"] },
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
    include: {
      interviewer: { select: { user: { select: { name: true } } } },
      talent: { select: { name: true } },
      assessment: true,
    },
  });

  // Sign the recording links for finished interviews up front. A short-lived
  // presigned URL minted at render is fine for a click that follows the load;
  // ponytail: 1h ceiling — route through an endpoint if reports get bookmarked.
  const recordingUrls = new Map<string, string>();
  for (const iv of interviews) {
    if (iv.status === "reported" && iv.recordingKey) {
      try {
        recordingUrls.set(iv.id, await presignDownload(iv.recordingKey, 3600));
      } catch (e) {
        console.error("[interviews] could not sign recording", e);
      }
    }
  }

  return (
    <>
      <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">Interviews</h1>
      <p className="mt-1 text-sm leading-relaxed text-ink-soft">
        Have a vetted interviewer run a recorded 30-minute interview of a shortlisted candidate and
        file an assessment. The candidate consents first — you pay only after they agree.
      </p>

      <div className="mt-6">
        <InterviewCapture shouldCapture={paid === "1"} />
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
            structured assessment you can compare across candidates. Nothing is charged until the
            candidate agrees.
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
                            Interviewer: {iv.interviewer.user.name} · ${iv.priceUsd.toFixed(2)}
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
                            We&rsquo;ve asked {firstName} to consent to a recorded interview. You can
                            pay once they agree — nothing is charged until then.
                          </p>
                          <div className="mt-4">
                            <InterviewCancelButton interviewId={iv.id} />
                          </div>
                        </>
                      )}

                      {iv.status === "consented" && (
                        <>
                          <p className="mt-3 text-sm leading-relaxed text-ink-soft">
                            {firstName} agreed to the recorded interview. Pay to confirm and we&rsquo;ll
                            schedule it. The interview is recorded, and the recording is shared with
                            you.
                          </p>
                          <div className="mt-4 flex flex-wrap items-center gap-3">
                            <InterviewPayButton interviewId={iv.id} priceUsd={iv.priceUsd} />
                            <InterviewCancelButton interviewId={iv.id} />
                          </div>
                        </>
                      )}

                      {(iv.status === "paid" || iv.status === "scheduled") && (
                        <p className="mt-3 text-sm leading-relaxed text-ink-soft">
                          Paid and confirmed.
                          {iv.scheduledAt
                            ? ` Scheduled for ${stamp(iv.scheduledAt)}.`
                            : " We're arranging a time with the interviewer."}{" "}
                          The assessment and recording will appear here once the interview is done.
                        </p>
                      )}

                      {iv.status === "recorded" && (
                        <p className="mt-3 text-sm leading-relaxed text-ink-soft">
                          The interview has been recorded. The interviewer is finalising the
                          assessment — it will appear here shortly.
                        </p>
                      )}

                      {iv.status === "declined" && (
                        <p className="mt-3 text-sm leading-relaxed text-ink-soft">
                          {firstName} declined the interview, so it did not go ahead. You were not
                          charged.
                        </p>
                      )}

                      {iv.status === "cancelled" && (
                        <p className="mt-3 text-sm leading-relaxed text-ink-soft">
                          This request was cancelled. Nothing was charged.
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

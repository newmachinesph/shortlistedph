import type { Metadata } from "next";
import { Building2, Clock, Mic, Video } from "lucide-react";
import { NOINDEX } from "@/lib/site";
import { INTERVIEW_DURATION_MINUTES, talentInterviews } from "@/lib/interviews";
import { requirePageUser, talentOrOnboard } from "@/lib/queries";
import { stamp } from "@/lib/notify";
import { InterviewConsent } from "@/components/interview-talent-consent";
import { AssessmentCard } from "@/components/assessment-card";

export const metadata: Metadata = { title: "Interviews", ...NOINDEX };

type Row = Awaited<ReturnType<typeof talentInterviews>>[number];

/** How a settled interview reads to the candidate — no interviewer identity, no price. */
function settledLabel(row: Row): string {
  switch (row.status) {
    case "consented":
      return "You agreed. Waiting for the employer to confirm.";
    case "paid":
      return "Confirmed. The interviewer will set a time and post the join link here.";
    case "scheduled":
      return row.scheduledAt ? `Scheduled for ${stamp(row.scheduledAt)}.` : "Scheduled.";
    case "recorded":
      return "Interview done. The assessment is being prepared.";
    case "reported":
      return "Complete — your assessment and recording are below.";
    case "declined":
      return "You declined. No payment was taken.";
    case "cancelled":
      return "Cancelled.";
    default:
      return row.status;
  }
}

export default async function TalentInterviewsPage() {
  const user = await requirePageUser("talent");
  await talentOrOnboard(user.id);
  const rows = await talentInterviews(user.id);

  const pending = rows.filter((r) => r.status === "requested");
  const settled = rows.filter((r) => r.status !== "requested");

  return (
    <>
      <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">Interviews</h1>
      <p className="mt-1 text-sm text-ink-soft">
        An employer who shortlisted you can ask a vetted interviewer to run a short interview. It
        only happens if you agree first — and nothing is charged to anyone until you do.
      </p>

      {rows.length === 0 && (
        <div className="mt-7 rounded-2xl border border-line bg-white p-6 text-center sm:p-10">
          <Video className="mx-auto h-8 w-8 text-ink-faint" strokeWidth={1.5} />
          <h2 className="font-display mt-4 text-lg font-semibold text-ink">No interview requests</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-ink-soft">
            If an employer wants a vetted interviewer to talk with you, the request appears here for
            your consent. There is nothing to do in the meantime.
          </p>
        </div>
      )}

      {pending.map((row) => (
        <div key={row.id} className="mt-7 rounded-2xl border border-line bg-white p-6">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-soft">
                <Building2 className="h-5 w-5 text-brand" strokeWidth={1.75} />
              </span>
              <div>
                <h2 className="font-medium text-ink">{row.company}</h2>
                <p className="text-sm text-ink-soft">
                  wants a vetted interviewer to run a {INTERVIEW_DURATION_MINUTES}-minute interview
                </p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1 rounded-full bg-ember-soft px-2.5 py-1 text-[11px] font-medium text-ember">
              <Clock className="h-3 w-3" strokeWidth={1.75} /> Needs your consent
            </span>
          </div>

          <div className="mt-5 rounded-xl border border-line bg-paper p-5">
            <p className="flex items-center gap-1.5 text-xs font-medium text-ink">
              <Mic className="h-3.5 w-3.5 text-ember" strokeWidth={1.75} />
              <span>Read this before you agree — it is a recorded session</span>
            </p>
            <p className="mt-3 text-sm leading-relaxed text-ink-soft">
              By agreeing, you consent to two separate things:
            </p>
            <ul className="mt-2 space-y-2 text-sm leading-relaxed text-ink-soft">
              <li className="flex gap-2">
                <span className="font-medium text-ink">1.</span>
                <span>
                  taking part in a {INTERVIEW_DURATION_MINUTES}-minute interview with a vetted
                  interviewer from shortlisted.ph; and
                </span>
              </li>
              <li className="flex gap-2">
                <span className="font-medium text-ink">2.</span>
                <span>
                  that interview being <span className="font-medium text-ink">audio and video
                  recorded</span>, and the recording — together with a written assessment — being
                  shared with <span className="font-medium text-ink">{row.company}</span>.
                </span>
              </li>
            </ul>
            <p className="mt-3 text-sm leading-relaxed text-ink-soft">
              Recording starts only after you agree. Under the Data Privacy Act of 2012 (RA 10173),
              this recording needs your consent, and you are free to decline. Declining is invisible
              to future matching, costs you nothing, and no payment is ever taken.
            </p>
          </div>

          <InterviewConsent interviewId={row.id} />
        </div>
      ))}

      {settled.length > 0 && (
        <>
          <h2 className="mt-9 mb-3 text-sm font-medium uppercase tracking-wider text-ink-faint">
            Your interviews
          </h2>
          <div className="space-y-4">
            {settled.map((row) => (
              <div key={row.id} className="rounded-2xl border border-line bg-white p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-paper">
                      <Building2 className="h-5 w-5 text-ink-faint" strokeWidth={1.75} />
                    </span>
                    <div>
                      <h3 className="font-medium text-ink">{row.company}</h3>
                      <p className="text-sm text-ink-soft">{settledLabel(row)}</p>
                    </div>
                  </div>
                  <span className="shrink-0 rounded-full border border-line px-2.5 py-1 text-[11px] font-medium text-ink-faint">
                    {row.status}
                  </span>
                </div>
                {/* The whole point of a booked interview. Shown for "paid" too:
                    the interviewer can post the link before the time is set,
                    and the candidate should never have to ask for it. */}
                {row.meetingUrl && (row.status === "paid" || row.status === "scheduled") && (
                  <a
                    href={row.meetingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-4 inline-flex min-h-11 items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium text-brand ring-1 ring-inset ring-brand/30 transition-colors hover:bg-brand-soft"
                  >
                    <Video className="h-4 w-4" strokeWidth={1.75} /> Join the interview
                  </a>
                )}

                {/* Rendered by the same component the employer's page uses, so
                    the candidate reads the assessment word for word as its
                    buyer does — including the free-text notes. */}
                {row.assessment && (
                  <AssessmentCard
                    assessment={row.assessment}
                    footer={
                      row.hasRecording ? (
                        <a
                          href={`/api/talent/interviews/${row.id}/recording`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium text-brand ring-1 ring-inset ring-brand/30 transition-colors hover:bg-brand-soft"
                        >
                          <Video className="h-4 w-4" strokeWidth={1.75} /> Download your recording
                        </a>
                      ) : null
                    }
                  />
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </>
  );
}

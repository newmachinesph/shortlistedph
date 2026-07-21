import type { Metadata } from "next";
import Link from "next/link";
import { CheckCircle2, Clock } from "lucide-react";
import { pageMeta } from "@/lib/site";
import { getSessionUser } from "@/lib/session";
import { getInterviewer, INTERVIEWER_RATE_MAX, INTERVIEWER_RATE_MIN } from "@/lib/interviews";
import { PublicPage } from "@/components/public-chrome";
import { InterviewerApplyForm } from "@/components/interviewer-apply-form";

// Public recruiting page — indexable, unlike the gated portal.
export const metadata: Metadata = pageMeta({
  title: "Become an interviewer",
  description:
    "Run paid, recorded 30-minute interviews of shortlisted Filipino candidates and file a structured assessment. Apply to join the interviewer pool on shortlisted.ph.",
  path: "/apply/interviewer",
});

export default async function ApplyInterviewerPage() {
  const user = await getSessionUser();
  const interviewer = user ? await getInterviewer(user.id) : null;

  return (
    <PublicPage>
      <div className="mx-auto max-w-2xl px-5 py-14 sm:px-8">
        <p className="text-sm font-medium text-brand">Interviewer pool</p>
        <h1 className="font-display mt-2 text-3xl font-semibold tracking-tight text-ink sm:text-4xl">
          Interview shortlisted candidates
        </h1>
        <p className="mt-4 text-base leading-relaxed text-ink-soft">
          Employers pick a vetted interviewer to run a recorded 30-minute call with a candidate they
          shortlisted, then read your structured assessment. You set your rate (${INTERVIEWER_RATE_MIN}–$
          {INTERVIEWER_RATE_MAX} per interview) and run the call on your own meeting tool. Applications
          are reviewed before you can start.
        </p>

        {!user && <SignInPrompt />}

        {user && interviewer && <StatusCard status={interviewer.status} />}

        {user && !interviewer && (
          <InterviewerApplyForm rateMin={INTERVIEWER_RATE_MIN} rateMax={INTERVIEWER_RATE_MAX} />
        )}
      </div>
    </PublicPage>
  );
}

function SignInPrompt() {
  return (
    <div className="mt-8 rounded-2xl border border-line bg-white p-6 text-center sm:p-8">
      <h2 className="font-display text-lg font-semibold text-ink">Sign in to apply</h2>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-ink-soft">
        You need an account to apply. Sign in, or create one first, then come back to this page.
      </p>
      <div className="mt-5 flex flex-col justify-center gap-3 sm:flex-row">
        <Link
          href="/login"
          className="flex min-h-11 items-center justify-center rounded-xl bg-brand px-5 text-sm font-medium text-white transition-colors hover:bg-brand-dark"
        >
          Sign in
        </Link>
        <Link
          href="/register"
          className="flex min-h-11 items-center justify-center rounded-xl border border-line px-5 text-sm font-medium text-ink-soft transition-colors hover:text-ink"
        >
          Create account
        </Link>
      </div>
    </div>
  );
}

function StatusCard({ status }: { status: string }) {
  if (status === "pending") {
    return (
      <div className="mt-8 rounded-2xl border border-line bg-white p-6 text-center sm:p-8">
        <Clock className="mx-auto h-8 w-8 text-ink-faint" strokeWidth={1.5} />
        <h2 className="font-display mt-3 text-lg font-semibold text-ink">Application received</h2>
        <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-ink-soft">
          Thanks — we review each application by hand and will be in touch once it&rsquo;s approved.
        </p>
      </div>
    );
  }

  // active or paused — they're in.
  return (
    <div className="mt-8 rounded-2xl border border-line bg-white p-6 text-center sm:p-8">
      <CheckCircle2 className="mx-auto h-8 w-8 text-brand" strokeWidth={1.75} />
      <h2 className="font-display mt-3 text-lg font-semibold text-ink">You&rsquo;re an interviewer</h2>
      <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-ink-soft">
        {status === "paused"
          ? "Your account is paused. Your assignments are still in your portal."
          : "Head to your portal to see assignments and file assessments."}
      </p>
      <Link
        href="/interviewer"
        className="mt-5 inline-flex min-h-11 items-center justify-center rounded-xl bg-brand px-5 text-sm font-medium text-white transition-colors hover:bg-brand-dark"
      >
        Open interviewer portal
      </Link>
    </div>
  );
}

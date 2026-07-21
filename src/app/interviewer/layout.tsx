import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Clock } from "lucide-react";
import { NOINDEX } from "@/lib/site";
import { getSessionUser } from "@/lib/session";
import { getInterviewer } from "@/lib/interviews";
import { InterviewerShell } from "@/components/interviewer-shell";

export const metadata: Metadata = { title: "Interviewer portal", ...NOINDEX };

/**
 * One gate for the whole portal. A signed-out visitor goes to login; someone
 * who never applied goes to the application; a pending applicant sees the
 * review state instead of the workspace. Only active/paused reach the pages.
 */
export default async function InterviewerLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  if (!user) redirect("/login");

  const interviewer = await getInterviewer(user.id);
  if (!interviewer) redirect("/apply/interviewer");

  if (interviewer.status === "pending") {
    return (
      <InterviewerShell>
        <div className="rounded-2xl border border-line bg-white p-6 text-center sm:p-10">
          <Clock className="mx-auto h-8 w-8 text-ink-faint" strokeWidth={1.5} />
          <h1 className="font-display mt-4 text-lg font-semibold text-ink">Application under review</h1>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-ink-soft">
            Thanks for applying to interview on shortlisted.ph. We review each application by hand.
            You&rsquo;ll get access here once you&rsquo;re approved.
          </p>
        </div>
      </InterviewerShell>
    );
  }

  return <InterviewerShell>{children}</InterviewerShell>;
}

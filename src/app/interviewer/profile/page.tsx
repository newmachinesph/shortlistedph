import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { getInterviewer, INTERVIEWER_RATE_MAX, INTERVIEWER_RATE_MIN } from "@/lib/interviews";
import { AvatarUpload } from "@/components/avatar-upload";
import { InterviewerProfileForm } from "@/components/interviewer-profile-form";

export default async function InterviewerProfilePage() {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  const interviewer = await getInterviewer(user.id);
  if (!interviewer) redirect("/apply/interviewer");

  return (
    <>
      <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">Profile</h1>
      <p className="mt-1 text-sm text-ink-soft">
        How employers see you when they pick an interviewer. Your rate is what you earn per interview.
      </p>

      <div className="mt-6 flex items-center gap-4 rounded-2xl border border-line bg-white p-5">
        <AvatarUpload name={user.name} image={user.image} />
        <div>
          <p className="text-sm font-medium text-ink">Your photo</p>
          <p className="mt-0.5 text-xs leading-relaxed text-ink-faint">
            Employers see this when they pick an interviewer.
          </p>
        </div>
      </div>

      <InterviewerProfileForm
        initial={{
          bio: interviewer.bio ?? "",
          expertise: interviewer.expertise.join(", "),
          languages: interviewer.languages.join(", "),
          rateUsd: interviewer.rateUsd,
        }}
        rateMin={INTERVIEWER_RATE_MIN}
        rateMax={INTERVIEWER_RATE_MAX}
      />
    </>
  );
}

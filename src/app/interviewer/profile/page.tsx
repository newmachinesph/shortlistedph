import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/session";
import { getInterviewer, INTERVIEWER_RATE_MAX, INTERVIEWER_RATE_MIN } from "@/lib/interviews";
import { AvatarUpload } from "@/components/avatar-upload";
import { InterviewerProfileForm } from "@/components/interviewer-profile-form";
import { PAYOUT_METHODS, isPayoutMethod } from "../queries";
import { PayoutForm } from "./payout-form";

const METHOD_LABEL: Record<(typeof PAYOUT_METHODS)[number], string> = {
  gcash: "GCash",
  bank: "Bank transfer",
};

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

      <PayoutForm
        methods={PAYOUT_METHODS.map((m) => ({ value: m, label: METHOD_LABEL[m] }))}
        initial={{
          // A legacy or unknown method reads as none at all, so the form reopens
          // on a real option instead of labelling the stored value.
          method: isPayoutMethod(interviewer.payoutMethod) ? interviewer.payoutMethod : null,
          accountName: interviewer.payoutAccountName,
          // Only the tail crosses to the client. The number itself is written
          // here and never read back out.
          accountTail: interviewer.payoutAccountNumber?.slice(-4) ?? null,
        }}
      />
    </>
  );
}

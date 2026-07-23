import type { Metadata } from "next";
import { Building2 } from "lucide-react";
import { NOINDEX } from "@/lib/site";
import { employerOrOnboard, requirePageUser } from "@/lib/queries";
import { presignDownload } from "@/lib/r2";
import { ProfileForm } from "./profile-form";

export const metadata: Metadata = { title: "Company profile", ...NOINDEX };

export default async function EmployerProfilePage() {
  const user = await requirePageUser("employer");
  const employer = await employerOrOnboard(user.id);

  let logoUrl: string | null = null;
  if (employer.logoKey) {
    try {
      logoUrl = await presignDownload(employer.logoKey, 3600);
    } catch (e) {
      console.error("[profile] could not sign logo", e);
    }
  }

  return (
    <>
      <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">Company profile</h1>
      <p className="mt-1 text-sm text-ink-soft">
        No business verification required — your track record on shortlisted.ph is your reputation.
      </p>

      <ProfileForm
        employer={{
          companyName: employer.companyName,
          location: employer.location,
          contactName: employer.contactName,
          blurb: employer.blurb,
        }}
        logoUrl={logoUrl}
        email={user.email}
      />

      <div className="mt-5 flex items-start gap-3 rounded-2xl border border-line bg-white p-6">
        <Building2 className="mt-0.5 h-5 w-5 shrink-0 text-ink-faint" strokeWidth={1.75} />
        <p className="max-w-2xl text-sm leading-relaxed text-ink-soft">
          Candidates see your company name and this description when they decide whether to accept a
          connection.
        </p>
      </div>
    </>
  );
}

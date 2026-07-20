import { redirect } from "next/navigation";
import Link from "next/link";
import { db } from "@/lib/db";
import { Logo } from "@/components/logo";
import { requirePageUser } from "@/lib/queries";
import { computeGaps } from "@/lib/resume";
import { OnboardingWizard } from "@/components/onboarding-wizard";

/**
 * Server side so the wizard opens on stored state, never on a blank form.
 * Everything the wizard needs to resume is derived from the profile itself —
 * there is no separate progress record to fall out of sync.
 */
export default async function OnboardingPage() {
  const user = await requirePageUser("talent");
  const profile = await db.talentProfile.findUnique({
    where: { userId: user.id },
    include: { skills: { orderBy: { name: "asc" } }, engagements: true },
  });
  if (!profile) redirect("/register");

  const gaps = computeGaps(profile, profile.skills, profile.engagements);

  return (
    <div className="min-h-screen bg-paper">
      <header className="mx-auto w-full max-w-2xl px-5 py-6">
        <Link href="/" className="inline-block py-1">
          <Logo />
        </Link>
      </header>
      <main className="mx-auto w-full max-w-2xl px-5 pb-20">
        <OnboardingWizard
          hasResume={Boolean(profile.resumeKey)}
          gaps={gaps}
          profile={{
            headline: profile.headline,
            summary: profile.summary,
            city: profile.city,
            rateUsd: profile.rateUsd,
            availability: profile.availability,
            committedHours: profile.committedHours,
            preferredOverlap: profile.preferredOverlap,
            portfolioUrl: profile.portfolioUrl,
            linkedinUrl: profile.linkedinUrl,
            githubUrl: profile.githubUrl,
            education: profile.education,
            englishLevel: profile.englishLevel,
            tools: profile.tools,
            certifications: profile.certifications,
          }}
          skills={profile.skills.map((s) => ({ name: s.name, confirmed: s.confirmed }))}
          engagements={profile.engagements.map((e) => ({
            role: e.role,
            company: e.company,
            span: e.span,
            confirmed: e.outcome === "confirmed",
          }))}
        />
      </main>
    </div>
  );
}

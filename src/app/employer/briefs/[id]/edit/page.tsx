import { notFound, redirect } from "next/navigation";
import { db } from "@/lib/db";
import { employerOrOnboard, requirePageUser } from "@/lib/queries";
import { BriefBuilder } from "../../new/brief-builder";

/**
 * Resume a saved draft. "Continue editing" used to point at /briefs/new, which
 * created a SECOND row and left the first one orphaned — this edits the row the
 * employer actually clicked.
 */
export default async function EditJobDescriptionPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const user = await requirePageUser("employer");
  const employer = await employerOrOnboard(user.id);

  const jd = await db.jobDescription.findFirst({ where: { id, employerId: employer.id } });
  if (!jd) notFound();
  // Published JDs are embedded and already ranked against; editing one would
  // invalidate every score. Same rule the PATCH endpoint enforces.
  if (jd.status !== "draft") redirect(`/employer/briefs/${jd.id}`);

  const hard = (jd.hardRequirements ?? null) as { rateMaxUsd?: number | null } | null;

  return (
    <BriefBuilder
      initialDraft={null}
      existing={{
        id: jd.id,
        title: jd.title,
        budgetMin: jd.budgetMin,
        budgetMax: jd.budgetMax,
        hoursPerWeek: jd.hoursPerWeek,
        overlap: jd.overlap,
        mustHaves: jd.mustHaves,
        niceToHaves: jd.niceToHaves,
        rateMaxUsd: hard?.rateMaxUsd ?? null,
      }}
    />
  );
}

import { db } from "@/lib/db";
import { getSessionUser } from "@/lib/session";
import { currentDraft } from "@/lib/job-draft";
import { BriefBuilder, type InitialDraft } from "./brief-builder";

/**
 * Prefills the builder from an anonymous /start draft the first time an
 * employer with no JD yet arrives here — so what they typed before signing up
 * carries over. The draft is only read; it is marked claimed when the JD is
 * created (see /api/jds). Read-only DB access is fine in a server component.
 */
export default async function NewJobDescriptionPage() {
  const user = await getSessionUser();
  const draft = user?.role === "employer" ? await currentDraft() : null;

  let initialDraft: InitialDraft | null = null;
  if (draft && user) {
    const employer = await db.employerAccount.findUnique({ where: { userId: user.id } });
    const jdCount = employer
      ? await db.jobDescription.count({ where: { employerId: employer.id } })
      : 1;
    if (jdCount === 0) {
      initialDraft = {
        title: draft.title ?? "",
        rawText: draft.rawText ?? "",
        budgetMin: draft.budgetMin ?? null,
        budgetMax: draft.budgetMax ?? null,
        hoursPerWeek: draft.hoursPerWeek ?? null,
        overlap: draft.overlap ?? null,
        mustHaves: draft.mustHaves ?? [],
      };
    }
  }

  return <BriefBuilder initialDraft={initialDraft} />;
}

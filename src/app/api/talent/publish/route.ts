import { db } from "@/lib/db";
import { fail, ok } from "@/lib/api";
import { refreshProfileEmbeddings } from "@/lib/profile-embedding";
import { HttpError, requireRole, requireTalentProfile } from "@/lib/session";

/** Publishing = embedding. An unembedded profile can never appear in a slate. */
export async function POST() {
  try {
    const user = await requireRole("talent");
    const base = await requireTalentProfile(user.id);

    const profile = await db.talentProfile.findUniqueOrThrow({
      where: { id: base.id },
      include: { skills: true },
    });

    const missing: string[] = [];
    if (!profile.headline) missing.push("headline");
    if (!profile.rateUsd) missing.push("standing rate");
    if (profile.skills.length === 0) missing.push("at least one skill");
    if (missing.length) throw new HttpError(422, `Add ${missing.join(", ")} before publishing`);

    await refreshProfileEmbeddings(profile.id, { markPublished: true });

    return ok({ published: true });
  } catch (e) {
    return fail(e);
  }
}

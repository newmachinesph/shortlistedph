import { db } from "@/lib/db";
import { fail, ok } from "@/lib/api";
import { refreshProfileEmbeddings } from "@/lib/profile-embedding";
import { rateLimit } from "@/lib/rate-limit";
import { HttpError, requireRole, requireTalentProfile } from "@/lib/session";

/** Publishing = embedding. An unembedded profile can never appear in a slate. */
export async function POST() {
  try {
    const user = await requireRole("talent");
    // Four embedding calls per hit, and the bucket for exactly this existed
    // unused — a stuck client looping on the publish button was an unmetered
    // bill.
    rateLimit("publish", user.id);
    const base = await requireTalentProfile(user.id);

    // Publishing twice is not publishing twice as hard. publishedAt is set on
    // the first publish and never moves, and every later edit of a published
    // profile re-embeds itself (/api/talent/profile), so re-running the whole
    // embed block here bought nothing and cost four calls.
    if (base.publishedAt) return ok({ published: true });

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

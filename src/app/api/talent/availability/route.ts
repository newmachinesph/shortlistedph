import { z } from "zod";
import { db } from "@/lib/db";
import { fail, ok, parseBody } from "@/lib/api";
import { requireRole, requireTalentProfile } from "@/lib/session";

const Body = z.object({
  openToOffers: z.boolean(),
  availability: z.enum(["open", "partial", "booked"]),
  noticePeriodDays: z.number().int().min(0).max(365),
});

/**
 * The candidate confirms or updates their live availability. Every confirm
 * stamps availabilityConfirmedAt = now — that freshness is the whole point; it
 * is what lets an employer trust the signal over frozen snapshot data.
 *
 * Scoped to the caller's own profile via the session user id, never an id from
 * the body — a talent can only ever move their own availability.
 */
async function handle(req: Request) {
  try {
    const user = await requireRole("talent");
    const profile = await requireTalentProfile(user.id);
    const { openToOffers, availability, noticePeriodDays } = await parseBody(req, Body);

    const updated = await db.talentProfile.update({
      where: { id: profile.id },
      data: {
        openToOffers,
        availability,
        noticePeriodDays,
        availabilityConfirmedAt: new Date(),
        // ponytail: availability is orthogonal to credential stability — do NOT
        // touch lastEditedAt. Confirming availability must not reset the
        // snapshot-stability clock that ranking rewards.
      },
      select: {
        openToOffers: true,
        availability: true,
        noticePeriodDays: true,
        availabilityConfirmedAt: true,
      },
    });

    return ok(updated);
  } catch (e) {
    return fail(e);
  }
}

export const PATCH = handle;
export const POST = handle;

import "server-only";
import { db } from "./db";
import { showcaseAvatarsEnabled } from "./settings";

/**
 * Real talent photos for public marketing pages.
 *
 * Deliberately returns nothing but the image URL. A showcase face is never
 * paired with a name, city, or headline: `visibility = true` is consent to be
 * *matched*, and rendering someone's photo beside their details on a landing
 * page is a different thing than being matchable. Faces only, or nothing.
 *
 * The gate is identical to the one `getPublicStats().matchable` counts, so the
 * faces shown are drawn from exactly the pool the number claims.
 */

export async function getShowcaseAvatars(limit = 12): Promise<string[]> {
  if (!(await showcaseAvatarsEnabled())) return [];

  try {
    // ORDER BY random() is fine at this scale (a few hundred rows) and the
    // caller caches for an hour, so this runs once per revalidation, not per
    // request. Revisit only if the pool reaches tens of thousands.
    const rows = await db.$queryRaw<{ image: string }[]>`
      select u.image
        from "TalentProfile" p
        join "user" u on u.id = p."userId"
       where p."publishedAt" is not null
         and p.visibility = true
         and u.status = 'active'
         and u.image is not null
       order by random()
       limit ${limit}
    `;
    return rows.map((r) => r.image);
  } catch {
    // Same contract as getPublicStats: an unreachable database hides the
    // decoration rather than failing the page it decorates.
    return [];
  }
}

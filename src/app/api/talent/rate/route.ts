import { z } from "zod";
import { db } from "@/lib/db";
import { fail, ok, parseBody } from "@/lib/api";
import { HttpError, requireRole, requireTalentProfile } from "@/lib/session";

const RATE_LOCK_DAYS = 30;

const Body = z.object({ rateUsd: z.number().min(1).max(200) });

/**
 * Standing rate: one number for every employer, changes locked for 30 days,
 * full history retained and shown to employers who shortlist you.
 */
export async function PUT(req: Request) {
  try {
    const user = await requireRole("talent");
    const profile = await requireTalentProfile(user.id);
    const { rateUsd } = await parseBody(req, Body);

    if (profile.rateLockedUntil && profile.rateLockedUntil > new Date()) {
      throw new HttpError(
        409,
        `Rate is locked until ${profile.rateLockedUntil.toISOString().slice(0, 10)}`,
      );
    }
    if (profile.rateUsd === rateUsd) return ok({ rateUsd, unchanged: true });

    const lockedUntil = new Date(Date.now() + RATE_LOCK_DAYS * 86_400_000);

    await db.$transaction([
      db.rateChange.create({
        data: { profileId: profile.id, oldRate: profile.rateUsd, newRate: rateUsd },
      }),
      db.talentProfile.update({
        where: { id: profile.id },
        data: { rateUsd, rateLockedUntil: lockedUntil, lastEditedAt: new Date() },
      }),
    ]);

    return ok({ rateUsd, lockedUntil });
  } catch (e) {
    return fail(e);
  }
}

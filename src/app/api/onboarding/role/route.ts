import { z } from "zod";
import { db } from "@/lib/db";
import { fail, ok, parseBody } from "@/lib/api";
import { mail } from "@/lib/email";
import { claimAttributionFromCookie } from "@/lib/referral";
import { HttpError, requireUser } from "@/lib/session";

const Body = z.discriminatedUnion("role", [
  z.object({ role: z.literal("talent") }),
  z.object({
    role: z.literal("employer"),
    companyName: z.string().min(2).max(120),
    location: z.string().max(120).optional(),
    contactName: z.string().max(120).optional(),
  }),
]);

/** One-time role selection right after signup. Never re-assignable by the client. */
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = await parseBody(req, Body);

    const existing = await db.user.findUnique({
      where: { id: user.id },
      select: { role: true, talentProfile: { select: { id: true } }, employer: { select: { id: true } } },
    });
    if (existing?.talentProfile || existing?.employer) {
      throw new HttpError(409, "Role already set");
    }

    if (body.role === "talent") {
      await db.$transaction([
        db.user.update({ where: { id: user.id }, data: { role: "talent" } }),
        db.talentProfile.create({ data: { userId: user.id } }),
      ]);
    } else {
      await db.$transaction([
        db.user.update({ where: { id: user.id }, data: { role: "employer" } }),
        db.employerAccount.create({
          data: {
            userId: user.id,
            companyName: body.companyName,
            location: body.location,
            contactName: body.contactName,
          },
        }),
      ]);
    }

    // Post-commit, best-effort, deliberately not inside the transaction.
    // Attribution has to happen HERE: a referred employer never visits the
    // talent surfaces that claim it lazily, so without this call employer
    // referrals — the ones actually worth paying for — are never credited.
    try {
      await claimAttributionFromCookie(user.id);
      if (body.role === "talent") {
        await mail.welcomeTalent(user.email, user.name);
      }
    } catch (e) {
      console.error("[onboarding] post-signup side effects failed", e);
    }

    return ok({ role: body.role });
  } catch (e) {
    return fail(e);
  }
}

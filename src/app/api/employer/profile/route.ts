import { z } from "zod";
import { db } from "@/lib/db";
import { fail, ok, parseBody } from "@/lib/api";
import { deleteObject } from "@/lib/r2";
import { HttpError, requireEmployer, requireRole } from "@/lib/session";

const optionalText = (max: number) =>
  z
    .union([z.literal(""), z.string().trim().max(max)])
    .transform((v) => (v === "" ? null : v))
    .optional();

const Patch = z.object({
  companyName: z.string().trim().min(1).max(120).optional(),
  location: optionalText(120),
  contactName: optionalText(120),
  blurb: optionalText(600),
  logoKey: z.string().max(300).nullable().optional(),
});

export async function PATCH(req: Request) {
  try {
    const user = await requireRole("employer");
    const employer = await requireEmployer(user.id);
    const body = await parseBody(req, Patch);

    // A foreign key here would let one employer point their logo at another's file.
    if (body.logoKey && !body.logoKey.startsWith(`employer-logos/${employer.id}/`)) {
      throw new HttpError(403, "Logo key does not belong to this account");
    }

    await db.employerAccount.update({ where: { id: employer.id }, data: body });

    // Replacing the logo orphans the old object — delete it so storage does
    // not grow with every swap. Best-effort after the DB write: a failed
    // delete leaves a stray file, never a broken profile. Own-prefix check
    // keeps this from ever deleting outside the employer's folder.
    const previous = employer.logoKey;
    if (
      body.logoKey !== undefined &&
      previous &&
      previous !== body.logoKey &&
      previous.startsWith(`employer-logos/${employer.id}/`)
    ) {
      try {
        await deleteObject(previous);
      } catch (e) {
        console.error("[profile] could not delete replaced logo", e);
      }
    }

    return ok({ updated: true });
  } catch (e) {
    return fail(e);
  }
}

import { z } from "zod";
import { db } from "@/lib/db";
import { fail, ok, parseBody } from "@/lib/api";
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
    return ok({ updated: true });
  } catch (e) {
    return fail(e);
  }
}

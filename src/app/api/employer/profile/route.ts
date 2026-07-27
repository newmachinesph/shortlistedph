import { z } from "zod";
import { db } from "@/lib/db";
import { fail, ok, parseBody } from "@/lib/api";
import { deleteObject, headObject } from "@/lib/r2";
import { HttpError, requireEmployer, requireRole } from "@/lib/session";

/** Mirrors the limits the upload-url route signs. */
const LOGO_MAX_BYTES = 2 * 1024 * 1024;
const LOGO_TYPES = ["image/jpeg", "image/png", "image/webp"];

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

    // Confirm the object is really there and really an image before the profile
    // points at it. The presigned PUT signs the length but deliberately leaves
    // content-type unsigned, and nothing else verifies the upload actually
    // happened — so without this an employer could register a key for a file
    // they never uploaded, or one whose declared type was a lie.
    if (body.logoKey) {
      const head = await headObject(body.logoKey);
      if (!head) throw new HttpError(422, "That logo upload did not complete — try again");
      if (head.size > LOGO_MAX_BYTES) throw new HttpError(422, "That logo is too large");
      if (!head.contentType || !LOGO_TYPES.includes(head.contentType)) {
        throw new HttpError(422, "A logo must be a JPEG, PNG or WebP image");
      }
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

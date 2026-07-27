import { z } from "zod";
import { db } from "@/lib/db";
import { fail, ok, parseBody } from "@/lib/api";
import { deleteObject, headObject, publicOrigin, publicUrl } from "@/lib/r2";
import { HttpError, requireUser } from "@/lib/session";

const Body = z.object({
  imageKey: z.string().min(1).max(300),
});

/** Same budget the presign step signs, re-stated against what was stored. */
const MAX_BYTES = 2 * 1024 * 1024;
const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp"]);

/**
 * Confirms an avatar upload: points User.image at the freshly uploaded object
 * and deletes the previous one so storage doesn't grow with every swap.
 */
export async function PATCH(req: Request) {
  try {
    const user = await requireUser();
    const { imageKey } = await parseBody(req, Body);

    // A foreign key here would let one account point their avatar at (and later
    // delete) another user's object.
    if (!imageKey.startsWith(`avatars/${user.id}/`)) {
      throw new HttpError(403, "Photo key does not belong to this account");
    }

    // Owning the key is not the same as having uploaded anything to it. This
    // route used to publish a CDN URL for an object it never looked at, so a
    // presign that was requested and never used left User.image on a 404 — and
    // content-type is not covered by the upload signature, so what landed there
    // is only known here.
    const head = await headObject(imageKey);
    if (!head) throw new HttpError(404, "That photo was never uploaded — try again");
    if (head.size > MAX_BYTES) throw new HttpError(413, "Photo must be under 2MB");
    if (!head.contentType || !ALLOWED.has(head.contentType)) {
      throw new HttpError(415, "Photo must be JPEG, PNG, or WebP");
    }

    const current = await db.user.findUnique({ where: { id: user.id }, select: { image: true } });
    const nextUrl = publicUrl(imageKey);

    await db.user.update({ where: { id: user.id }, data: { image: nextUrl } });

    // Best-effort delete of the replaced object, after the DB write: a failed
    // delete leaves a stray file, never a broken avatar. Only ever touch our
    // own CDN under the avatars/ prefix — legacy uploadthing URLs and any
    // foreign host are left untouched.
    const prev = current?.image;
    const ownAvatarPrefix = `${publicOrigin()}/avatars/`;
    if (prev && prev !== nextUrl && prev.startsWith(ownAvatarPrefix)) {
      const oldKey = prev.slice(publicOrigin().length + 1);
      try {
        await deleteObject(oldKey);
      } catch (e) {
        console.error("[avatar] could not delete replaced photo", e);
      }
    }

    return ok({ image: nextUrl });
  } catch (e) {
    return fail(e);
  }
}

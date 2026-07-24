import { z } from "zod";
import { fail, ok, parseBody } from "@/lib/api";
import { presignUpload } from "@/lib/r2";
import { HttpError, requireUser } from "@/lib/session";

const ALLOWED: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

// Advisory only — a presigned PUT can't enforce length.
const MAX_BYTES = 2 * 1024 * 1024;

const Body = z.object({
  contentType: z.string(),
  sizeBytes: z.number().int().positive(),
});

/** Any signed-in account (talent/employer/interviewer/admin) can set an avatar. */
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const { contentType, sizeBytes } = await parseBody(req, Body);

    const ext = ALLOWED[contentType];
    if (!ext) throw new HttpError(415, "Photo must be JPEG, PNG, or WebP");
    if (sizeBytes > MAX_BYTES) throw new HttpError(413, "Photo must be under 2MB");

    // Key is server-derived and namespaced per user — a client-supplied key
    // would let one account overwrite another's file. Timestamped so each
    // upload is a distinct object the confirm step can swap and clean up.
    const key = `avatars/${user.id}/${Date.now()}.${ext}`;
    const uploadUrl = await presignUpload(key, contentType);

    return ok({ uploadUrl, key });
  } catch (e) {
    return fail(e);
  }
}

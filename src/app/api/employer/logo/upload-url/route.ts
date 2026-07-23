import { z } from "zod";
import { fail, ok, parseBody } from "@/lib/api";
import { presignUpload } from "@/lib/r2";
import { HttpError, requireEmployer, requireRole } from "@/lib/session";

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

export async function POST(req: Request) {
  try {
    const user = await requireRole("employer");
    const employer = await requireEmployer(user.id);
    const { contentType, sizeBytes } = await parseBody(req, Body);

    const ext = ALLOWED[contentType];
    if (!ext) throw new HttpError(415, "Logo must be JPEG, PNG, or WebP");
    if (sizeBytes > MAX_BYTES) throw new HttpError(413, "Logo must be under 2MB");

    // Key is server-derived — a client-supplied key would let one employer overwrite another's file.
    const key = `employer-logos/${employer.id}/${Date.now()}.${ext}`;
    const uploadUrl = await presignUpload(key, contentType);

    return ok({ uploadUrl, key });
  } catch (e) {
    return fail(e);
  }
}

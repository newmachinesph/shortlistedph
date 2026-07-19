import { z } from "zod";
import { fail, ok, parseBody } from "@/lib/api";
import { presignUpload } from "@/lib/r2";
import { HttpError, requireRole, requireTalentProfile } from "@/lib/session";

const ALLOWED: Record<string, string> = {
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "text/plain": "txt",
};

const MAX_BYTES = 5 * 1024 * 1024;

const Body = z.object({
  contentType: z.string(),
  sizeBytes: z.number().int().positive(),
});

export async function POST(req: Request) {
  try {
    const user = await requireRole("talent");
    const profile = await requireTalentProfile(user.id);
    const { contentType, sizeBytes } = await parseBody(req, Body);

    const ext = ALLOWED[contentType];
    if (!ext) throw new HttpError(415, "Resume must be PDF, DOC, DOCX, or TXT");
    if (sizeBytes > MAX_BYTES) throw new HttpError(413, "Resume must be under 5MB");

    // Key is server-derived — a client-supplied key would let one user overwrite another's file.
    const key = `resumes/${profile.id}/${Date.now()}.${ext}`;
    const uploadUrl = await presignUpload(key, contentType);

    return ok({ uploadUrl, key });
  } catch (e) {
    return fail(e);
  }
}

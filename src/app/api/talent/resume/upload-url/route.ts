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

// Mirrored by MAX_RESUME_BYTES in lib/resume.ts, which re-checks the bytes we
// actually fetched back — this bounds the upload, that bounds the parse.
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
    // sizeBytes stops being a claim here: it goes into the signature, so a body
    // of any other length fails to verify at R2.
    const uploadUrl = await presignUpload(key, contentType, sizeBytes);

    return ok({ uploadUrl, key });
  } catch (e) {
    return fail(e);
  }
}

import { z } from "zod";
import { fail, ok, parseBody } from "@/lib/api";
import { db } from "@/lib/db";
import { presignUpload } from "@/lib/r2";
import { HttpError } from "@/lib/session";
import { requireActingInterviewer } from "@/app/interviewer/queries";

/**
 * The recording is made off-platform and uploaded here. POST hands back a
 * presigned PUT; PATCH stores the resulting key and advances the interview to
 * "recorded". The key is server-derived so one interviewer can never write to
 * another's path, and PATCH re-verifies the key it is handed matches that path.
 */
const ALLOWED: Record<string, string> = {
  "video/mp4": "mp4",
  "video/webm": "webm",
  "video/quicktime": "mov",
  "video/x-matroska": "mkv",
  "audio/mpeg": "mp3",
  "audio/mp4": "m4a",
  "audio/webm": "weba",
};

// Advisory only — a presigned PUT can't enforce length. A 30-minute recording
// is large; this just stops an obviously wrong upload.
const MAX_BYTES = 2 * 1024 * 1024 * 1024;

const PresignBody = z.object({
  interviewId: z.string().min(1),
  contentType: z.string(),
  sizeBytes: z.number().int().positive(),
});

const ConfirmBody = z.object({
  interviewId: z.string().min(1),
  key: z.string().min(1),
});

/** A recording can be attached while the interview is paid or scheduled. */
async function scopedInterview(interviewId: string, interviewerId: string) {
  const interview = await db.interview.findFirst({
    where: { id: interviewId, interviewerId, status: { in: ["paid", "scheduled"] } },
    select: { id: true },
  });
  if (!interview) throw new HttpError(404, "Interview not found");
  return interview;
}

export async function POST(req: Request) {
  try {
    const { interviewer } = await requireActingInterviewer();
    const { interviewId, contentType, sizeBytes } = await parseBody(req, PresignBody);

    const ext = ALLOWED[contentType];
    if (!ext) throw new HttpError(415, "Recording must be MP4, WebM, MOV, MKV, MP3, M4A, or audio WebM");
    if (sizeBytes > MAX_BYTES) throw new HttpError(413, "Recording must be under 2GB");

    await scopedInterview(interviewId, interviewer.id);

    const key = `interviews/${interviewer.id}/${interviewId}/${Date.now()}.${ext}`;
    const uploadUrl = await presignUpload(key, contentType);

    return ok({ uploadUrl, key });
  } catch (e) {
    return fail(e);
  }
}

export async function PATCH(req: Request) {
  try {
    const { interviewer } = await requireActingInterviewer();
    const { interviewId, key } = await parseBody(req, ConfirmBody);

    // The key must be the one we would have minted for this pair — never an
    // arbitrary path the client made up.
    if (!key.startsWith(`interviews/${interviewer.id}/${interviewId}/`)) {
      throw new HttpError(400, "Recording key does not match this interview");
    }

    await scopedInterview(interviewId, interviewer.id);

    await db.interview.update({
      where: { id: interviewId },
      data: { recordingKey: key, status: "recorded" },
    });

    return ok({ status: "recorded" });
  } catch (e) {
    return fail(e);
  }
}

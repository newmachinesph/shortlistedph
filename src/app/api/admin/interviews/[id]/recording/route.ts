import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { fail } from "@/lib/api";
import { presignDownload } from "@/lib/r2";
import { HttpError, requireAdmin } from "@/lib/session";

/**
 * Recording review for quality control. Redirects to a short-lived presigned
 * R2 URL so the object key never reaches the browser and the link expires.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
    const { id } = await params;

    const interview = await db.interview.findUnique({
      where: { id },
      select: { recordingKey: true },
    });
    if (!interview?.recordingKey) throw new HttpError(404, "No recording for this interview");

    const url = await presignDownload(interview.recordingKey);
    return NextResponse.redirect(url);
  } catch (e) {
    return fail(e);
  }
}

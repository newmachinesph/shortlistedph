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
    const admin = await requireAdmin();
    const { id } = await params;

    const interview = await db.interview.findUnique({
      where: { id },
      select: { recordingKey: true },
    });
    if (!interview?.recordingKey) throw new HttpError(404, "No recording for this interview");

    // A candidate's recorded interview leaving the platform is a disclosure,
    // not a page view — log it BEFORE handing over the URL, so a link that
    // was issued is on the record even if the download itself never happens.
    await db.auditLog.create({
      data: { actorId: admin.id, action: "admin.recording.download", target: id },
    });

    const url = await presignDownload(interview.recordingKey);
    return NextResponse.redirect(url);
  } catch (e) {
    return fail(e);
  }
}

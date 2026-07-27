import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { fail } from "@/lib/api";
import { presignDownload } from "@/lib/r2";
import { HttpError, requireRole } from "@/lib/session";

/**
 * The candidate's own copy of their recorded interview.
 *
 * They consented to being recorded — it is the gate that lets the employer be
 * charged at all — and the recording is their personal data. The employer and
 * an admin could both watch it and the person in it could not, which is the
 * access right under RA 10173 read backwards.
 *
 * Scoped by talentUserId in the WHERE clause, never a post-fetch check, so a
 * request for someone else's interview 404s without revealing the row exists —
 * same rule as the consent route next door.
 */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const user = await requireRole("talent");
    const { id } = await params;

    const interview = await db.interview.findFirst({
      where: { id, talentUserId: user.id },
      select: { recordingKey: true },
    });
    if (!interview?.recordingKey) throw new HttpError(404, "No recording for this interview");

    // Logged for the same reason the admin route logs it: a recording leaving
    // the platform is a disclosure, and the record is written BEFORE the URL is
    // handed over so an issued link is on it even if nobody clicks.
    await db.auditLog.create({
      data: { actorId: user.id, action: "talent.recording.download", target: id },
    });

    const url = await presignDownload(interview.recordingKey);
    return NextResponse.redirect(url);
  } catch (e) {
    return fail(e);
  }
}

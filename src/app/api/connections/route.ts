import { z } from "zod";
import { db } from "@/lib/db";
import { fail, ok, parseBody } from "@/lib/api";
import { mail } from "@/lib/email";
import { notify } from "@/lib/notify";
import { HttpError, requireEmployer, requireRole } from "@/lib/session";

const Body = z.object({
  slateEntryId: z.string().min(1),
  message: z.string().max(2000).optional(),
});

/**
 * Employer asks to be introduced. Nothing about the candidate is revealed by
 * this — it creates a request the candidate can decline, and the candidate's
 * contact details stay sealed until they consent.
 */
export async function POST(req: Request) {
  try {
    const user = await requireRole("employer");
    const employer = await requireEmployer(user.id);
    const { slateEntryId, message } = await parseBody(req, Body);

    const entry = await db.slateEntry.findFirst({
      where: { id: slateEntryId, slate: { jd: { employerId: employer.id } } },
      include: {
        slate: { select: { status: true } },
        snapshot: { select: { profileId: true, jd: { select: { title: true } } } },
        connection: { select: { id: true } },
      },
    });
    if (!entry) throw new HttpError(404, "Candidate not found on any of your shortlists");

    // Requesting is part of what the credit bought.
    if (entry.slate.status !== "unlocked") {
      throw new HttpError(402, "Unlock this shortlist before requesting a connection");
    }
    if (entry.connection) throw new HttpError(409, "You have already requested this candidate");

    const connection = await db.connection.create({
      data: { slateEntryId: entry.id, state: "requested", screeningAnswers: message ? { message } : undefined },
    });

    const profile = await db.talentProfile.findUnique({
      where: { id: entry.snapshot.profileId },
      select: { userId: true, user: { select: { email: true, name: true } } },
    });
    if (profile) {
      await notify({
        userId: profile.userId,
        type: "connection_requested",
        payload: {
          connectionId: connection.id,
          company: employer.companyName,
          jobTitle: entry.snapshot.jd.title,
        },
      });

      // In-app alone is not enough here: the candidate has no reason to be
      // logged in, and a request they never see reads as a candidate who
      // ignored the employer.
      try {
        await mail.connectionRequested(profile.user.email, {
          name: profile.user.name,
          company: employer.companyName,
          jobTitle: entry.snapshot.jd.title,
        });
      } catch (e) {
        console.error("[connections] request email failed", e);
      }
    }

    return ok({ connectionId: connection.id, state: connection.state }, { status: 201 });
  } catch (e) {
    return fail(e);
  }
}

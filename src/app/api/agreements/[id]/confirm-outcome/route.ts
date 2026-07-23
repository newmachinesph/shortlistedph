import { z } from "zod";
import { db } from "@/lib/db";
import { fail, ok, parseBody } from "@/lib/api";
import { notify } from "@/lib/notify";
import { HttpError, requireUser } from "@/lib/session";
import { agreementForUser, applyConfirmedOutcome, currentPeriod } from "@/lib/agreements";

const Body = z.object({
  period: z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Period must be YYYY-MM"),
});

/**
 * The monthly outcome loop. Each side confirms a period once; the unique
 * (agreementId, period) row holds one timestamp per side. When BOTH sides
 * have confirmed the same period the outcome is mutual, and the trust
 * signals matching consumes get written (see applyConfirmedOutcome).
 */
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await requireUser();
    const { period } = await parseBody(req, Body);
    const { agreement, snap, side } = await agreementForUser(id, user.id);

    if (!agreement.talentSignedAt || !agreement.employerSignedAt) {
      throw new HttpError(409, "Both sides must sign before outcomes can be confirmed");
    }
    if (period > currentPeriod()) throw new HttpError(422, "That month has not happened yet");
    if (period < currentPeriod(agreement.createdAt)) {
      throw new HttpError(422, "That month predates this agreement");
    }

    const existing = await db.outcomeConfirmation.findUnique({
      where: { agreementId_period: { agreementId: id, period } },
    });
    const mine = side === "talent" ? existing?.talentConfirmedAt : existing?.employerConfirmedAt;
    if (mine) throw new HttpError(409, "You already confirmed this month");

    const myStamp =
      side === "talent" ? { talentConfirmedAt: new Date() } : { employerConfirmedAt: new Date() };
    const row = await db.outcomeConfirmation.upsert({
      where: { agreementId_period: { agreementId: id, period } },
      update: myStamp,
      create: { agreementId: id, period, ...myStamp },
    });

    const both = Boolean(row.talentConfirmedAt && row.employerConfirmedAt);
    if (both) {
      await applyConfirmedOutcome(snap, period);
      const otherUserId = side === "talent" ? snap.jd.employer.userId : snap.profile.userId;
      await notify({
        userId: otherUserId,
        type: "outcome_confirmed",
        payload: { jobTitle: snap.jd.title, period },
      });
    }

    return ok({ period, bothConfirmed: both });
  } catch (e) {
    return fail(e);
  }
}

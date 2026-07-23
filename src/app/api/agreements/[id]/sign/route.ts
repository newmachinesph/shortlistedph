import { db } from "@/lib/db";
import { fail, ok } from "@/lib/api";
import { notify } from "@/lib/notify";
import { HttpError, requireUser } from "@/lib/session";
import { agreementForUser } from "@/lib/agreements";

/**
 * One signature per side, ever. Signatures are stored as timestamps and the
 * model has no status column — "active" is derived: both timestamps set.
 * A non-party sees the same 404 as a bad id.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await requireUser();
    const { side, snap } = await agreementForUser(id, user.id);

    // Atomic sign-once: the WHERE only matches while my slot is still empty.
    const signed = await db.agreement.updateMany({
      where: { id, ...(side === "talent" ? { talentSignedAt: null } : { employerSignedAt: null }) },
      data: side === "talent" ? { talentSignedAt: new Date() } : { employerSignedAt: new Date() },
    });
    if (signed.count === 0) throw new HttpError(409, "You have already signed this agreement");

    const updated = await db.agreement.findUniqueOrThrow({ where: { id } });
    const active = Boolean(updated.talentSignedAt && updated.employerSignedAt);

    const otherUserId = side === "talent" ? snap.jd.employer.userId : snap.profile.userId;
    await notify({
      userId: otherUserId,
      type: active ? "agreement_active" : "agreement_signed",
      payload: { jobTitle: snap.jd.title },
    });

    return ok({
      active,
      talentSignedAt: updated.talentSignedAt,
      employerSignedAt: updated.employerSignedAt,
    });
  } catch (e) {
    return fail(e);
  }
}

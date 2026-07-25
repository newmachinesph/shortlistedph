import { db } from "@/lib/db";
import { fail, ok } from "@/lib/api";
import { mail } from "@/lib/email";
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
    const otherSide = side === "talent" ? "employer" : "talent";
    await notify({
      userId: otherUserId,
      type: active ? "agreement_active" : "agreement_signed",
      payload: { jobTitle: snap.jd.title },
    });
    // Post-commit and best-effort: the signature is already recorded, so a
    // failure here must not turn into a 409 "already signed" on the retry.
    try {
      const other = await db.user.findUnique({
        where: { id: otherUserId },
        select: { email: true, name: true },
      });
      if (other) {
        const args = { name: other.name, jobTitle: snap.jd.title, side: otherSide } as const;
        await (active ? mail.agreementActive(other.email, args) : mail.agreementSigned(other.email, args));
      }
    } catch (e) {
      console.error("[agreements] sign notification email failed", e);
    }

    return ok({
      active,
      talentSignedAt: updated.talentSignedAt,
      employerSignedAt: updated.employerSignedAt,
    });
  } catch (e) {
    return fail(e);
  }
}

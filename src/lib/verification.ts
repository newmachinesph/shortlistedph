import "server-only";
import { db } from "./db";
import { notify } from "./notify";
import { HttpError } from "./session";

/**
 * Identity verification review.
 *
 * The badge used to have no writer at all: fulfilment deferred it to "the Didit
 * webhook", and no such route was ever built. Talent paid, waited, and could
 * never be verified — while the checkout refused a second attempt because the
 * fee was already paid. Money for a feature that could not complete.
 *
 * Until a provider integration exists, the review is human: paying queues an
 * attempt (IdentityBinding.status = "pending"), an admin approves or rejects
 * it, and approval is the ONLY thing that writes TalentProfile.verifiedTier.
 * That ordering is the point — paying must never be enough to look verified.
 *
 * A rejection re-opens the door: the checkout gate keys on an unresolved
 * attempt, not on "ever paid", so a rejected applicant can try again.
 */

export const VERIFIED_TIER = "id_verified";

export async function listPendingVerifications() {
  return db.identityBinding.findMany({
    where: { status: "pending" },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      status: true,
      createdAt: true,
      diditSessionRef: true,
      user: {
        select: {
          id: true,
          name: true,
          email: true,
          talentProfile: { select: { id: true, headline: true, verifiedTier: true } },
        },
      },
    },
  });
}

/** Whether this user has an attempt still awaiting review — the checkout gate. */
export async function hasOpenVerification(userId: string): Promise<boolean> {
  const binding = await db.identityBinding.findUnique({
    where: { userId },
    select: { status: true },
  });
  return binding?.status === "pending" || binding?.status === "verified";
}

export async function approveVerification(args: { actorId: string; userId: string }) {
  const binding = await db.identityBinding.findUnique({ where: { userId: args.userId } });
  if (!binding) throw new HttpError(404, "No verification attempt for this user");
  if (binding.status === "verified") return { status: "verified" as const };

  const now = new Date();
  await db.$transaction(async (tx) => {
    await tx.identityBinding.update({
      where: { userId: args.userId },
      data: { status: "verified", verifiedAt: now, reviewedAt: now, note: null },
    });
    // The one write of the badge in the entire codebase.
    await tx.talentProfile.updateMany({
      where: { userId: args.userId },
      data: { verifiedTier: VERIFIED_TIER },
    });
    await tx.auditLog.create({
      data: { actorId: args.actorId, action: "verification.approved", target: args.userId },
    });
  });

  await notify({ userId: args.userId, type: "verification_verified", payload: {} });
  return { status: "verified" as const };
}

export async function rejectVerification(args: { actorId: string; userId: string; note: string }) {
  const binding = await db.identityBinding.findUnique({ where: { userId: args.userId } });
  if (!binding) throw new HttpError(404, "No verification attempt for this user");

  const now = new Date();
  await db.$transaction(async (tx) => {
    await tx.identityBinding.update({
      where: { userId: args.userId },
      data: { status: "rejected", reviewedAt: now, note: args.note, verifiedAt: null },
    });
    // A previously-granted badge is withdrawn with the same action, so there is
    // no path where a rejected identity keeps the mark.
    await tx.talentProfile.updateMany({
      where: { userId: args.userId, verifiedTier: VERIFIED_TIER },
      data: { verifiedTier: "none" },
    });
    await tx.auditLog.create({
      data: {
        actorId: args.actorId,
        action: "verification.rejected",
        target: args.userId,
        meta: { note: args.note },
      },
    });
  });

  await notify({
    userId: args.userId,
    type: "verification_rejected",
    payload: { note: args.note },
  });
  return { status: "rejected" as const };
}

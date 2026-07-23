import { db } from "@/lib/db";
import { fail, ok } from "@/lib/api";
import { HttpError, requireEmployer, requireRole } from "@/lib/session";

/**
 * Spends one credit to unlock a slate. Credits come from PayPal purchases
 * (P3) — this endpoint only ever moves the ledger, never takes payment.
 */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await requireRole("employer");
    const employer = await requireEmployer(user.id);

    const slate = await db.slate.findUnique({
      where: { id },
      include: {
        jd: { select: { employerId: true } },
        _count: { select: { entries: true } },
      },
    });
    if (!slate || slate.jd.employerId !== employer.id) throw new HttpError(404, "Slate not found");
    // Awaiting admin review: invisible to the employer, so not unlockable either.
    if (slate.status === "pending_review") throw new HttpError(404, "Slate not found");
    if (slate.status === "unlocked") return ok({ status: "unlocked", alreadyUnlocked: true });
    // Belt and braces: buildSlate no longer creates empty slates, but a credit
    // must never be spendable on nothing.
    if (slate._count.entries === 0) throw new HttpError(409, "This shortlist has no candidates to unlock");

    const result = await db.$transaction(async (tx) => {
      // Conditional decrement — two concurrent unlocks can't both spend the
      // last credit, because the WHERE clause fails on the second one.
      const spent = await tx.employerAccount.updateMany({
        where: { id: employer.id, credits: { gte: 1 } },
        data: { credits: { decrement: 1 } },
      });
      if (spent.count === 0) return null;

      await tx.entitlement.updateMany({
        where: { employerId: employer.id, spentOnSlateId: null },
        data: { spentOnSlateId: slate.id },
      });
      await tx.slate.update({
        where: { id: slate.id },
        data: { status: "unlocked", unlockedAt: new Date() },
      });
      await tx.auditLog.create({
        data: { actorId: user.id, action: "slate.unlock", target: slate.id },
      });
      return true;
    });

    if (!result) throw new HttpError(402, "No shortlist credits — purchase one to unlock");

    return ok({ status: "unlocked" });
  } catch (e) {
    return fail(e);
  }
}

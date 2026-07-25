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
    // Consent-first: a slate stays empty until candidates accept, and a credit
    // must never be spendable on nothing. Unlocking works at any size ≥ 1;
    // entries added after unlock appear unmasked automatically.
    if (slate._count.entries === 0) throw new HttpError(409, "This shortlist has no confirmed candidates yet — check back soon");

    const result = await db.$transaction(async (tx) => {
      // Conditional decrement — two concurrent unlocks can't both spend the
      // last credit, because the WHERE clause fails on the second one.
      const spent = await tx.employerAccount.updateMany({
        where: { id: employer.id, credits: { gte: 1 } },
        data: { credits: { decrement: 1 } },
      });
      if (spent.count === 0) return null;

      // Mark exactly ONE unspent entitlement as spent on this slate — the old
      // updateMany marked every credit the employer had, corrupting the
      // "which purchase paid which unlock" trail after the first unlock.
      const ent = await tx.entitlement.findFirst({
        where: { employerId: employer.id, spentOnSlateId: null, revokedAt: null },
        select: { id: true },
      });
      if (ent) {
        await tx.entitlement.update({
          where: { id: ent.id },
          data: { spentOnSlateId: slate.id },
        });
      } else {
        // The balance allowed a spend the ledger can't back: unspent+unrevoked
        // entitlements are supposed to EQUAL credits. The unlock still stands —
        // they paid — but silence here is how that drift stayed invisible.
        console.warn("[slate.unlock] credit spent with no unspent entitlement", {
          employerId: employer.id,
          slateId: slate.id,
        });
      }
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

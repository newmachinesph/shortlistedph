import { z } from "zod";
import { fail, ok, parseBody } from "@/lib/api";
import {
  TALENT_LEVERS,
  adjustEmployerCredits,
  applyUserStatus,
  clearTalentLever,
  unpublishProfile,
} from "@/lib/admin";
import { requireAdmin } from "@/lib/session";

const Body = z.union([
  z.object({ status: z.enum(["active", "suspended", "banned"]) }),
  z.object({ unpublish: z.literal(true) }),
  z.object({ clear: z.enum(TALENT_LEVERS) }),
  z.object({
    credits: z.object({
      // Which balance: shortlist (unlock a slate) or interview (book one each).
      kind: z.enum(["shortlist", "interview"]),
      // Exactly one is used; the lib rejects passing both.
      set: z.number().int().min(0).max(9999).optional(),
      delta: z.number().int().min(-9999).max(9999).optional(),
      reason: z.string().trim().min(1).max(300),
    }),
  }),
]);

/**
 * Suspend, ban, reactivate, or take a profile down.
 *
 * The enforcement itself lives in lib/admin.ts because resolving a report can
 * apply the same action — one implementation, so the two paths cannot drift.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    const body = await parseBody(req, Body);

    if ("unpublish" in body) {
      return ok(await unpublishProfile({ actorId: admin.id, userId: id }));
    }

    if ("clear" in body) {
      return ok(await clearTalentLever({ actorId: admin.id, userId: id, lever: body.clear }));
    }

    if ("credits" in body) {
      return ok(
        await adjustEmployerCredits({
          actorId: admin.id,
          userId: id,
          kind: body.credits.kind,
          set: body.credits.set,
          delta: body.credits.delta,
          reason: body.credits.reason,
        }),
      );
    }

    const result = await applyUserStatus({
      actorId: admin.id,
      userId: id,
      status: body.status,
      action: `admin.user.${body.status}`,
    });

    return ok({
      ...result,
      // Said out loud so the operator never assumes reactivating put someone
      // back in front of employers. Only the talent can republish.
      note:
        body.status === "active"
          ? "Access restored. Any talent profile stays unpublished until the person republishes it themselves."
          : undefined,
    });
  } catch (e) {
    return fail(e);
  }
}

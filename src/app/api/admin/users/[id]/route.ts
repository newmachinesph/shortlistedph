import { z } from "zod";
import { fail, ok, parseBody } from "@/lib/api";
import { applyUserStatus, unpublishProfile } from "@/lib/admin";
import { requireAdmin } from "@/lib/session";

const Body = z.union([
  z.object({ status: z.enum(["active", "suspended", "banned"]) }),
  z.object({ unpublish: z.literal(true) }),
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

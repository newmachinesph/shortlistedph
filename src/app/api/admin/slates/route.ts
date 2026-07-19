import { z } from "zod";
import { fail, ok, parseBody } from "@/lib/api";
import { failJd, rematchJd } from "@/lib/admin";
import { requireAdmin } from "@/lib/session";

const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("rematch"), jdId: z.string().min(1) }),
  z.object({ action: z.literal("fail"), jdId: z.string().min(1), note: z.string().max(500).optional() }),
]);

/**
 * Levers for a JD stuck in matching. publish/route.ts runs buildSlate inline,
 * so a request that dies mid-run leaves the JD wedged with nothing to do about
 * it — this is the recovery path.
 */
export async function POST(req: Request) {
  try {
    const admin = await requireAdmin();
    const body = await parseBody(req, Body);

    if (body.action === "fail") {
      return ok(await failJd({ actorId: admin.id, jdId: body.jdId, note: body.note }));
    }

    return ok(await rematchJd({ actorId: admin.id, jdId: body.jdId }));
  } catch (e) {
    return fail(e);
  }
}

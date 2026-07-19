import { z } from "zod";
import { db } from "@/lib/db";
import { fail, ok, parseBody } from "@/lib/api";
import { requireUser } from "@/lib/session";

const Body = z.union([
  z.object({ all: z.literal(true) }),
  z.object({ id: z.string().min(1) }),
]);

/**
 * Marking read is a write, so it is scoped by userId in the WHERE clause rather
 * than looked up by id and checked afterwards. updateMany with a compound
 * filter cannot touch another user's row even if the id is guessed — a wrong id
 * simply updates nothing, which is also why this reports a count instead of
 * 404ing (a 404 would confirm which ids exist).
 */
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const body = await parseBody(req, Body);

    const where =
      "all" in body
        ? { userId: user.id, readAt: null }
        : { id: body.id, userId: user.id, readAt: null };

    const { count } = await db.notification.updateMany({
      where,
      data: { readAt: new Date() },
    });

    return ok({ marked: count });
  } catch (e) {
    return fail(e);
  }
}

import { fail, ok } from "@/lib/api";
import { requireUser } from "@/lib/session";
import { listNotifications } from "@/lib/notify";

/** The signed-in user's own notifications. There is no way to ask for anyone else's. */
export async function GET() {
  try {
    const user = await requireUser();
    const { rows, unread } = await listNotifications(user.id);
    return ok({
      unread,
      notifications: rows.map((n) => ({
        id: n.id,
        type: n.type,
        payload: n.payload,
        read: n.readAt !== null,
        createdAt: n.createdAt,
      })),
    });
  } catch (e) {
    return fail(e);
  }
}

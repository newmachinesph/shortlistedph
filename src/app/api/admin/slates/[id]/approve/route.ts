import { fail, ok } from "@/lib/api";
import { approveSlate } from "@/lib/admin";
import { requireAdmin } from "@/lib/session";

/** Releases a pending_review slate to its employer. Manual, always. */
export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const admin = await requireAdmin();
    const { id } = await params;
    return ok(await approveSlate({ actorId: admin.id, slateId: id }));
  } catch (e) {
    return fail(e);
  }
}

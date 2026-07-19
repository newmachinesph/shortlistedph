import { db } from "@/lib/db";
import { fail, ok } from "@/lib/api";
import type { FrozenProfile } from "@/lib/slate";
import { HttpError, requireEmployer, requireRole } from "@/lib/session";

/** Full dossier. 403s unless the snapshot's slate has been unlocked. */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await requireRole("employer");
    const employer = await requireEmployer(user.id);

    const snapshot = await db.profileSnapshot.findUnique({
      where: { id },
      include: {
        jd: { select: { employerId: true, title: true, publishedAt: true } },
        entries: { select: { slate: { select: { status: true } } } },
        profile: { select: { user: { select: { name: true, email: true } } } },
      },
    });

    if (!snapshot || snapshot.jd.employerId !== employer.id) throw new HttpError(404, "Not found");

    const unlocked = snapshot.entries.some((e) => e.slate.status === "unlocked");
    if (!unlocked) throw new HttpError(402, "Unlock this shortlist to view the full dossier");

    const frozen = snapshot.frozenJson as FrozenProfile;

    return ok({
      snapshot: {
        id: snapshot.id,
        jdTitle: snapshot.jd.title,
        frozenAt: snapshot.jd.publishedAt,
        name: snapshot.profile.user.name,
        // Contact is released at connection consent, not at unlock.
        ...frozen,
        userId: undefined,
      },
    });
  } catch (e) {
    return fail(e);
  }
}

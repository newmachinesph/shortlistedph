import { db } from "@/lib/db";
import { fail, ok } from "@/lib/api";
import { maskEntry } from "@/lib/slate";
import { HttpError, requireEmployer, requireRole } from "@/lib/session";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await requireRole("employer");
    const employer = await requireEmployer(user.id);

    const slate = await db.slate.findUnique({
      where: { id },
      include: {
        jd: { select: { id: true, employerId: true, title: true, mustHaves: true, niceToHaves: true, budgetMin: true, budgetMax: true, hoursPerWeek: true, overlap: true, publishedAt: true } },
        entries: {
          orderBy: { rank: "asc" },
          include: { snapshot: { select: { id: true, frozenJson: true, profileId: true } } },
        },
      },
    });

    if (!slate || slate.jd.employerId !== employer.id) throw new HttpError(404, "Slate not found");

    const unlocked = slate.status === "unlocked";

    // Names are fetched only when unlocked — a locked response never even
    // loads them into memory, so they cannot leak through a serialization bug.
    let names = new Map<string, string>();
    if (unlocked) {
      const profileIds = slate.entries.map((e) => e.snapshot.profileId);
      const profiles = await db.talentProfile.findMany({
        where: { id: { in: profileIds } },
        select: { id: true, user: { select: { name: true } } },
      });
      names = new Map(profiles.map((p) => [p.id, p.user.name]));
    }

    return ok({
      slate: {
        id: slate.id,
        status: slate.status,
        deliveredAt: slate.deliveredAt,
        jd: { ...slate.jd, employerId: undefined },
        entries: slate.entries.map((e) =>
          maskEntry(
            {
              id: e.id,
              rank: e.rank,
              score: e.score,
              dims: e.dims as never,
              reasons: e.reasons,
              snapshot: e.snapshot,
              candidateName: unlocked ? (names.get(e.snapshot.profileId) ?? null) : null,
            },
            unlocked,
          ),
        ),
      },
    });
  } catch (e) {
    return fail(e);
  }
}

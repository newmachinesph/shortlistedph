import { z } from "zod";
import { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { fail, ok, parseBody } from "@/lib/api";
import { HttpError, requireUser } from "@/lib/session";

const Body = z.object({
  connectionId: z.string().min(1),
  stars: z.number().int().min(1).max(5),
  comment: z.string().trim().max(2000).optional(),
});

/**
 * Either party rates the other. Direction is derived from which side of the
 * connection the caller sits on — never from the body. Rating opens once the
 * connection is consented or the pair completed a reported interview, and each
 * side rates once per connection (@@unique([agreementId, direction])).
 *
 * Double-blind: nothing is released until both sides have rated; the read side
 * additionally releases after 14 days (see lib/ratings.ts).
 */
export async function POST(req: Request) {
  try {
    const user = await requireUser();
    const { connectionId, stars, comment } = await parseBody(req, Body);

    const connection = await db.connection.findUnique({
      where: { id: connectionId },
      select: {
        id: true,
        state: true,
        slateEntry: {
          select: {
            snapshot: {
              select: {
                profile: { select: { userId: true } },
                jd: { select: { employer: { select: { userId: true } } } },
              },
            },
            interviews: { where: { status: "reported" }, select: { id: true }, take: 1 },
          },
        },
      },
    });
    if (!connection) throw new HttpError(404, "Connection not found");

    const talentUserId = connection.slateEntry.snapshot.profile.userId;
    const employerUserId = connection.slateEntry.snapshot.jd.employer.userId;
    if (talentUserId === employerUserId) throw new HttpError(403, "You cannot rate yourself");

    const direction =
      user.id === talentUserId
        ? "talent_to_employer"
        : user.id === employerUserId
          ? "employer_to_talent"
          : null;
    // Same 404 as a missing row — a non-party must not learn the connection exists.
    if (!direction) throw new HttpError(404, "Connection not found");

    const hasCompletedInterview = connection.slateEntry.interviews.length > 0;
    if (connection.state !== "consented" && !hasCompletedInterview) {
      throw new HttpError(403, "Rating opens after a consented connection or a completed interview");
    }

    try {
      const rating = await db.$transaction(async (tx) => {
        // ponytail: Rating anchors on Agreement, but signing isn't built yet —
        // a ratable pair without one gets a bare terms:{} anchor row. Replace
        // with the real signed agreement when e-signing ships.
        const agreement = await tx.agreement.upsert({
          where: { connectionId: connection.id },
          update: {},
          create: { connectionId: connection.id, terms: {} },
        });

        const created = await tx.rating.create({
          data: { agreementId: agreement.id, direction, stars, comment: comment || null },
        });

        // Both sides in — release both at once.
        const count = await tx.rating.count({ where: { agreementId: agreement.id } });
        if (count === 2) {
          await tx.rating.updateMany({
            where: { agreementId: agreement.id, revealedAt: null },
            data: { revealedAt: new Date() },
          });
        }
        return created;
      });

      return ok({ id: rating.id }, { status: 201 });
    } catch (e) {
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        throw new HttpError(409, "Already rated");
      }
      throw e;
    }
  } catch (e) {
    return fail(e);
  }
}

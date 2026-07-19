import { z } from "zod";
import { db } from "@/lib/db";
import { fail, ok, parseBody } from "@/lib/api";
import { HttpError, requireRole } from "@/lib/session";

const Body = z.object({ decision: z.enum(["consent", "decline"]) });

/**
 * The candidate's decision. This is the only thing that releases contact
 * details — an employer who paid still gets nothing until the person says yes.
 *
 * A decline is deliberately opaque to the employer: they see the slot closed,
 * never a reason, and it does not affect the candidate's future matching.
 */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const user = await requireRole("talent");
    const { decision } = await parseBody(req, Body);

    const connection = await db.connection.findFirst({
      where: { id, slateEntry: { snapshot: { profile: { userId: user.id } } } },
      include: {
        slateEntry: {
          select: {
            snapshot: {
              select: { jd: { select: { title: true, employer: { select: { userId: true, companyName: true } } } } },
            },
          },
        },
      },
    });
    if (!connection) throw new HttpError(404, "Connection not found");
    if (connection.state !== "requested") {
      throw new HttpError(409, `Already ${connection.state}`);
    }

    const updated = await db.connection.update({
      where: { id: connection.id },
      data:
        decision === "consent"
          ? { state: "consented", contactRevealedAt: new Date() }
          : { state: "declined" },
    });

    const employerUserId = connection.slateEntry.snapshot.jd.employer.userId;
    await db.notification.create({
      data: {
        userId: employerUserId,
        type: decision === "consent" ? "connection_accepted" : "connection_declined",
        payload: {
          connectionId: connection.id,
          jobTitle: connection.slateEntry.snapshot.jd.title,
        },
      },
    });

    return ok({ state: updated.state });
  } catch (e) {
    return fail(e);
  }
}

import { z } from "zod";
import { db } from "@/lib/db";
import { fail, ok, parseBody } from "@/lib/api";
import { HttpError, requireEmployer, requireRole } from "@/lib/session";
import { notify, openThreadWhere, type Participant } from "@/lib/notify";

const Body = z.object({
  connectionId: z.string().min(1),
  body: z.string().trim().min(1, "Write a message first").max(4000, "Message is too long"),
});

/**
 * Resolves the caller into the identity messaging is scoped by. An employer is
 * a participant through their EmployerAccount, not their user row, so the
 * account has to be loaded before any thread query can be filtered.
 */
async function caller(): Promise<{ participant: Participant; userId: string; name: string }> {
  const user = await requireRole("talent", "employer");
  if (user.role === "employer") {
    const employer = await requireEmployer(user.id);
    return {
      participant: { side: "employer", employerId: employer.id },
      userId: user.id,
      name: employer.companyName,
    };
  }
  return { participant: { side: "talent", userId: user.id }, userId: user.id, name: user.name };
}

/**
 * One 403 covers "no such connection", "not yours", and "not open yet". They
 * are deliberately indistinguishable — a different status per case would let an
 * employer probe ids to learn which candidates exist and who declined them.
 */
const NO_ACCESS = new HttpError(403, "This conversation is not open to you");

export async function GET(req: Request) {
  try {
    const { participant } = await caller();
    const connectionId = new URL(req.url).searchParams.get("connectionId");
    if (!connectionId) throw new HttpError(400, "connectionId is required");

    const connection = await db.connection.findFirst({
      where: { id: connectionId, ...openThreadWhere(participant) },
      select: { id: true },
    });
    if (!connection) throw NO_ACCESS;

    const messages = await db.message.findMany({
      where: { connectionId: connection.id },
      orderBy: { createdAt: "asc" },
      select: { id: true, senderId: true, body: true, createdAt: true },
    });

    return ok({ messages });
  } catch (e) {
    return fail(e);
  }
}

export async function POST(req: Request) {
  try {
    const { participant, userId, name } = await caller();
    const { connectionId, body } = await parseBody(req, Body);

    // The participant filter and the consent gate are both in the WHERE clause,
    // so a non-participant never loads the row they would need to write to.
    const connection = await db.connection.findFirst({
      where: { id: connectionId, ...openThreadWhere(participant) },
      select: {
        id: true,
        slateEntry: {
          select: {
            snapshot: {
              select: {
                profile: { select: { userId: true } },
                jd: { select: { title: true } },
              },
            },
            slate: { select: { jd: { select: { employer: { select: { userId: true } } } } } },
          },
        },
      },
    });
    if (!connection) throw NO_ACCESS;

    const message = await db.message.create({
      data: { connectionId: connection.id, senderId: userId, body },
      select: { id: true, senderId: true, body: true, createdAt: true },
    });

    const recipientId =
      participant.side === "talent"
        ? connection.slateEntry.slate.jd.employer.userId
        : connection.slateEntry.snapshot.profile.userId;

    await notify({
      userId: recipientId,
      type: "message_received",
      payload: {
        connectionId: connection.id,
        from: name,
        jobTitle: connection.slateEntry.snapshot.jd.title,
      },
    });

    return ok({ message }, { status: 201 });
  } catch (e) {
    return fail(e);
  }
}

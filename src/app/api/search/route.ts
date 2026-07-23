import { z } from "zod";
import { db } from "@/lib/db";
import { fail, ok } from "@/lib/api";
import { requireEmployer, requireUser } from "@/lib/session";
import { participantWhere } from "@/lib/notify";

const Q = z.string().trim().min(2).max(64);

const CAP = 10;

type Result = { id: string; label: string; sub: string | null; href: string };

/** Workspace Ctrl-K search. Role-aware, capped, contains-match only. */
export async function GET(req: Request) {
  try {
    const user = await requireUser();
    const q = Q.parse(new URL(req.url).searchParams.get("q") ?? "");
    const contains = { contains: q, mode: "insensitive" as const };

    let results: Result[] = [];

    if (user.role === "employer") {
      const employer = await requireEmployer(user.id);
      const [jds, entries] = await Promise.all([
        db.jobDescription.findMany({
          where: { employerId: employer.id, title: contains },
          orderBy: { createdAt: "desc" },
          take: CAP,
          select: { id: true, title: true, status: true },
        }),
        // Names are searchable only where this employer already unlocked them —
        // the same paywall line maskEntry draws.
        db.slateEntry.findMany({
          where: {
            slate: { status: "unlocked", jd: { employerId: employer.id } },
            snapshot: { profile: { user: { name: contains } } },
          },
          distinct: ["snapshotId"],
          take: CAP,
          select: {
            snapshotId: true,
            snapshot: {
              select: {
                profile: { select: { user: { select: { name: true } } } },
                jd: { select: { title: true } },
              },
            },
          },
        }),
      ]);
      results = [
        ...jds.map((jd) => ({
          id: jd.id,
          label: jd.title,
          sub: jd.status,
          href: `/employer/briefs/${jd.id}`,
        })),
        ...entries.map((e) => ({
          id: e.snapshotId,
          label: e.snapshot.profile.user.name,
          sub: e.snapshot.jd.title,
          href: `/employer/candidates/${e.snapshotId}`,
        })),
      ];
    } else if (user.role === "talent") {
      const [connections, interviews] = await Promise.all([
        db.connection.findMany({
          where: {
            AND: [
              participantWhere({ side: "talent", userId: user.id }),
              { slateEntry: { snapshot: { jd: { employer: { companyName: contains } } } } },
            ],
          },
          orderBy: { createdAt: "desc" },
          take: CAP,
          select: {
            id: true,
            slateEntry: {
              select: {
                snapshot: {
                  select: {
                    jd: { select: { title: true, employer: { select: { companyName: true } } } },
                  },
                },
              },
            },
          },
        }),
        db.interview.findMany({
          where: { talentUserId: user.id, employer: { companyName: contains } },
          orderBy: { createdAt: "desc" },
          take: CAP,
          select: { id: true, status: true, employer: { select: { companyName: true } } },
        }),
      ]);
      results = [
        ...connections.map((c) => ({
          id: c.id,
          label: c.slateEntry.snapshot.jd.employer.companyName,
          sub: c.slateEntry.snapshot.jd.title,
          href: "/talent/connections",
        })),
        ...interviews.map((i) => ({
          id: i.id,
          label: `Interview — ${i.employer.companyName}`,
          sub: i.status,
          href: "/talent/interviews",
        })),
      ];
    }
    // Other roles (admin) get an empty list — the workspace shell never renders for them.

    return ok({ results: results.slice(0, CAP) });
  } catch (e) {
    return fail(e);
  }
}

import "server-only";
import { db } from "./db";

/**
 * Ratings anchor on Agreement (@@unique([agreementId, direction])) and release
 * double-blind: revealedAt is set once both sides rate, or the rating shows
 * anyway 14 days after submission so nobody can bury a score by never rating.
 */

const REVEAL_AFTER_DAYS = 14;

/** Read-side release filter — no cron needed for the 14-day timeout. */
function revealedOr() {
  return [
    { revealedAt: { not: null } },
    { createdAt: { lte: new Date(Date.now() - REVEAL_AFTER_DAYS * 86_400_000) } },
  ];
}

/** The two events that open rating for a pair. */
const ELIGIBLE_OR = [
  { state: "consented" },
  { slateEntry: { interviews: { some: { status: "reported" } } } },
];

/** Consented connections (or completed interviews) this talent has not rated yet. */
export async function listRateableForTalent(userId: string) {
  const rows = await db.connection.findMany({
    where: {
      slateEntry: { snapshot: { profile: { userId } } },
      OR: ELIGIBLE_OR,
      NOT: { agreement: { ratings: { some: { direction: "talent_to_employer" } } } },
    },
    orderBy: { createdAt: "desc" },
    take: 100, // ponytail: hard cap, paginate if any account ever hits it
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
  });
  return rows.map((c) => ({
    connectionId: c.id,
    counterpart: c.slateEntry.snapshot.jd.employer.companyName,
    jobTitle: c.slateEntry.snapshot.jd.title,
  }));
}

/** Consented connections (or completed interviews) this employer has not rated yet. */
export async function listRateableForEmployer(userId: string) {
  const rows = await db.connection.findMany({
    where: {
      slateEntry: { slate: { jd: { employer: { userId } } } },
      OR: ELIGIBLE_OR,
      NOT: { agreement: { ratings: { some: { direction: "employer_to_talent" } } } },
    },
    orderBy: { createdAt: "desc" },
    take: 100, // ponytail: hard cap, paginate if any account ever hits it
    select: {
      id: true,
      slateEntry: {
        select: {
          snapshot: {
            select: {
              jd: { select: { title: true } },
              profile: { select: { user: { select: { name: true } } } },
            },
          },
        },
      },
    },
  });
  return rows.map((c) => ({
    connectionId: c.id,
    counterpart: c.slateEntry.snapshot.profile.user.name,
    jobTitle: c.slateEntry.snapshot.jd.title,
  }));
}

/** Released ratings employers left for this talent, newest first. */
export async function listReceivedForTalent(userId: string) {
  const rows = await db.rating.findMany({
    where: {
      direction: "employer_to_talent",
      agreement: { connection: { slateEntry: { snapshot: { profile: { userId } } } } },
      OR: revealedOr(),
    },
    orderBy: { createdAt: "desc" },
    take: 100, // ponytail: hard cap, paginate if any account ever hits it
    select: {
      id: true,
      stars: true,
      comment: true,
      createdAt: true,
      agreement: {
        select: {
          connection: {
            select: {
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
          },
        },
      },
    },
  });
  return rows.map((r) => {
    const jd = r.agreement.connection.slateEntry.snapshot.jd;
    return {
      id: r.id,
      stars: r.stars,
      comment: r.comment,
      createdAt: r.createdAt,
      counterpart: jd.employer.companyName,
      jobTitle: jd.title,
    };
  });
}

/** Released ratings talent left for this employer, newest first. */
export async function listReceivedForEmployer(userId: string) {
  const rows = await db.rating.findMany({
    where: {
      direction: "talent_to_employer",
      agreement: { connection: { slateEntry: { slate: { jd: { employer: { userId } } } } } },
      OR: revealedOr(),
    },
    orderBy: { createdAt: "desc" },
    take: 100, // ponytail: hard cap, paginate if any account ever hits it
    select: {
      id: true,
      stars: true,
      comment: true,
      createdAt: true,
      agreement: {
        select: {
          connection: {
            select: {
              slateEntry: {
                select: {
                  snapshot: {
                    select: {
                      jd: { select: { title: true } },
                      profile: { select: { user: { select: { name: true } } } },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  });
  return rows.map((r) => {
    const snap = r.agreement.connection.slateEntry.snapshot;
    return {
      id: r.id,
      stars: r.stars,
      comment: r.comment,
      createdAt: r.createdAt,
      counterpart: snap.profile.user.name,
      jobTitle: snap.jd.title,
    };
  });
}

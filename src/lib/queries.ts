import "server-only";
import { redirect } from "next/navigation";
import { db } from "./db";
import { getSessionUser } from "./session";
import { maskEntry, type MaskedEntry } from "./slate";

/**
 * Read models shared by server components and route handlers.
 * Server components call these directly — never fetch our own API over HTTP.
 */

export async function requirePageUser(role: "talent" | "employer") {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  if (user.role !== role) redirect(user.role === "employer" ? "/employer" : "/talent");
  return user;
}

export async function employerOrOnboard(userId: string) {
  const employer = await db.employerAccount.findUnique({ where: { userId } });
  if (!employer) redirect("/register");
  return employer;
}

export async function talentOrOnboard(userId: string) {
  const profile = await db.talentProfile.findUnique({ where: { userId } });
  if (!profile) redirect("/onboarding");
  return profile;
}

export async function listJds(employerId: string) {
  return db.jobDescription.findMany({
    where: { employerId },
    orderBy: { createdAt: "desc" },
    include: {
      slates: {
        orderBy: { deliveredAt: "desc" },
        take: 1,
        select: { id: true, status: true, _count: { select: { entries: true } } },
      },
    },
  });
}

export type SlateView = {
  slateId: string;
  unlocked: boolean;
  deliveredAt: Date;
  entries: MaskedEntry[];
};

/** Applies the same masking the API uses — one code path, one paywall. */
export async function getSlateForJd(jdId: string, employerId: string): Promise<SlateView | null> {
  const slate = await db.slate.findFirst({
    where: { jdId, jd: { employerId } },
    orderBy: { deliveredAt: "desc" },
    include: {
      entries: {
        orderBy: { rank: "asc" },
        include: { snapshot: { select: { id: true, frozenJson: true, profileId: true } } },
      },
    },
  });
  if (!slate) return null;

  const unlocked = slate.status === "unlocked";

  let names = new Map<string, string>();
  if (unlocked) {
    const profiles = await db.talentProfile.findMany({
      where: { id: { in: slate.entries.map((e) => e.snapshot.profileId) } },
      select: { id: true, user: { select: { name: true } } },
    });
    names = new Map(profiles.map((p) => [p.id, p.user.name]));
  }

  return {
    slateId: slate.id,
    unlocked,
    deliveredAt: slate.deliveredAt,
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
  };
}

export async function getSnapshotForEmployer(snapshotId: string, employerId: string) {
  const snapshot = await db.profileSnapshot.findFirst({
    where: { id: snapshotId, jd: { employerId } },
    include: {
      jd: { select: { id: true, title: true, publishedAt: true } },
      entries: { select: { slate: { select: { status: true } } } },
      profile: { select: { user: { select: { name: true } } } },
    },
  });
  if (!snapshot) return null;
  const unlocked = snapshot.entries.some((e) => e.slate.status === "unlocked");
  return { snapshot, unlocked };
}

/** Derived time values are computed here, not during render — render must stay pure. */
export async function getTalentProfile(userId: string) {
  const profile = await db.talentProfile.findUnique({
    where: { userId },
    include: {
      skills: true,
      engagements: true,
      rateChanges: { orderBy: { changedAt: "desc" }, take: 5 },
      user: { select: { name: true, email: true } },
    },
  });
  if (!profile) return null;

  const now = Date.now();
  return {
    ...profile,
    stableDays: Math.max(0, Math.floor((now - profile.lastEditedAt.getTime()) / 86_400_000)),
    isRateLocked: profile.rateLockedUntil ? profile.rateLockedUntil.getTime() > now : false,
  };
}

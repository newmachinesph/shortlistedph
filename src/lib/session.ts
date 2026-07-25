import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { auth } from "./auth";
import { db } from "./db";

export type Role = "talent" | "employer" | "admin";

export type SessionUser = {
  id: string;
  email: string;
  name: string;
  image: string | null;
  role: Role;
  status: string;
};

// cache() dedupes the session lookup across one request: a layout and its
// pages (and any query helper) all resolve the same user without re-hitting
// better-auth/the DB each time.
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return null;
  const u = session.user as typeof session.user & { role?: string; status?: string };
  return {
    id: u.id,
    email: u.email,
    name: u.name,
    image: u.image ?? null,
    role: (u.role as Role) ?? "talent",
    status: u.status ?? "active",
  };
});

/** Throws a Response — route handlers should let it bubble via requireRole's caller. */
export class HttpError extends Error {
  // Plain field, not a `public status` parameter property: TS parameter
  // properties emit code, so Node's type-stripping mode rejects the file
  // outright — and that killed any script importing anything that
  // transitively reaches session.ts (the eval harness, for one).
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new HttpError(401, "Not signed in");
  if (user.status !== "active") throw new HttpError(403, "Account is not active");
  return user;
}

export async function requireRole(...roles: Role[]): Promise<SessionUser> {
  const user = await requireUser();
  if (!roles.includes(user.role)) throw new HttpError(403, "Wrong role for this resource");
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  const allowlist = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  // Admin needs BOTH the role and an allowlisted email — a compromised role
  // column alone must not grant back-office access.
  if (user.role !== "admin" || !allowlist.includes(user.email.toLowerCase())) {
    throw new HttpError(403, "Admin only");
  }
  return user;
}

export async function requireTalentProfile(userId: string) {
  const profile = await db.talentProfile.findUnique({ where: { userId } });
  if (!profile) throw new HttpError(404, "No talent profile");
  return profile;
}

export async function requireEmployer(userId: string) {
  const employer = await db.employerAccount.findUnique({ where: { userId } });
  if (!employer) throw new HttpError(404, "No employer account");
  return employer;
}

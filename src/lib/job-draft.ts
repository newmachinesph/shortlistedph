import "server-only";
import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { db } from "./db";
import type { JobDraft } from "@prisma/client";

/**
 * The anonymous, pre-signup role a visitor describes on /start. Keyed by a
 * cookie token — no PII, role fields only — so their input survives the signup
 * boundary and prefills the real JD builder once they have an account.
 */

const DRAFT_COOKIE = "slph_draft";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 30; // 30 days

/** Role-only fields a draft carries. Deliberately no name/email/company. */
export type DraftFields = {
  title: string | null;
  rawText: string | null;
  budgetMax: number | null;
  hoursPerWeek: number | null;
  mustHaves: string[];
};

/** Cookie descriptor for `NextResponse.cookies.set` — mirrors the referral cookie. */
export function draftCookie(token: string) {
  return {
    name: DRAFT_COOKIE,
    value: token,
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: COOKIE_MAX_AGE,
  };
}

/** The draft token on the current request, if the visitor already has one. */
export async function draftToken(): Promise<string | null> {
  return (await cookies()).get(DRAFT_COOKIE)?.value ?? null;
}

/** This request's unclaimed draft, or null. Read-only — safe in server components. */
export async function currentDraft(): Promise<JobDraft | null> {
  const token = await draftToken();
  if (!token) return null;
  const draft = await db.jobDraft.findUnique({ where: { token } });
  return draft && !draft.claimedByJdId ? draft : null;
}

/**
 * Upsert the draft for the current request and return its token (the caller
 * sets the cookie on its response). Reuses an existing unclaimed draft; a
 * claimed one is spent, so we start a fresh token.
 */
export async function upsertDraft(fields: DraftFields, matchCount: number): Promise<string> {
  const existing = await draftToken();
  if (existing) {
    const found = await db.jobDraft.findUnique({ where: { token: existing } });
    if (found && !found.claimedByJdId) {
      await db.jobDraft.update({ where: { token: existing }, data: { ...fields, matchCount } });
      return existing;
    }
  }
  const token = randomBytes(16).toString("hex");
  await db.jobDraft.create({ data: { token, ...fields, matchCount } });
  return token;
}

/** Mark a draft claimed when its owner turns it into a JD. No-op if missing or already claimed. */
export async function claimDraft(token: string, jdId: string): Promise<void> {
  await db.jobDraft.updateMany({
    where: { token, claimedByJdId: null },
    data: { claimedByJdId: jdId },
  });
}

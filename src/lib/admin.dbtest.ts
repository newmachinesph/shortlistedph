/**
 * What a ban actually reaches, against a real Postgres.
 *
 *   npm run test:money        (runs every *.dbtest.ts)
 *
 * Suspending an account revoked its sessions and unpublished its talent
 * profile, and stopped there. An interviewer who was banned kept a status of
 * "active" on their Interviewer row, so employers went on picking them out of
 * the pool and booking calls with someone who could not log in to run them —
 * one interview credit spent per booking, with no route back.
 */
import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { config } from "dotenv";

config({ path: ".env.local", override: true });

const { db } = await import("./db.ts");
const { applyUserStatus } = await import("./admin.ts");

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL missing from .env.local");

let seq = 0;
const users: string[] = [];
const interviewerIds: string[] = [];

/**
 * An interviewer with one confirmed ("paid") interview against a spent credit —
 * the state where a ban does the most damage, because the employer has already
 * been charged for a call that can no longer happen.
 */
async function bookedInterview() {
  const id = `admin-test-${Date.now()}-${seq++}`;

  const adminUser = await db.user.create({
    data: { id: `${id}-a`, name: "Admin", email: `${id}-a@example.com`, role: "admin" },
  });
  const talent = await db.user.create({
    data: { id: `${id}-t`, name: "Talent", email: `${id}-t@example.com`, role: "talent" },
  });
  const profile = await db.talentProfile.create({
    data: { userId: talent.id, headline: "Engineer", publishedAt: new Date() },
  });

  const employerUser = await db.user.create({
    data: { id: `${id}-e`, name: "Employer", email: `${id}-e@example.com`, role: "employer" },
  });
  const employer = await db.employerAccount.create({
    data: { userId: employerUser.id, companyName: "Ban Test Co", interviewCredits: 0 },
  });

  const jd = await db.jobDescription.create({
    data: { employerId: employer.id, title: "Ban test brief", status: "slate_ready" },
  });
  const slate = await db.slate.create({ data: { jdId: jd.id, status: "unlocked" } });
  const snapshot = await db.profileSnapshot.create({
    data: { profileId: profile.id, jdId: jd.id, frozenJson: {} },
  });
  const entry = await db.slateEntry.create({
    data: { slateId: slate.id, snapshotId: snapshot.id, rank: 1, score: 80, dims: {} },
  });

  const interviewerUser = await db.user.create({
    data: { id: `${id}-i`, name: "Interviewer", email: `${id}-i@example.com`, role: "talent" },
  });
  const interviewer = await db.interviewer.create({
    data: {
      userId: interviewerUser.id,
      status: "active",
      yearsExperience: 10,
      expertise: ["react"],
      rateUsd: 20,
      bio: "Interviewer",
    },
  });

  const interview = await db.interview.create({
    data: {
      slateEntryId: entry.id,
      employerId: employer.id,
      interviewerId: interviewer.id,
      talentUserId: talent.id,
      status: "paid",
      priceUsd: 25,
      interviewerPayoutUsd: 15,
    },
  });
  // The credit the employer spent to confirm it.
  await db.entitlement.create({
    data: {
      employerId: employer.id,
      kind: "interview_credit",
      source: `${id}-purchase`,
      spentOnInterviewId: interview.id,
    },
  });

  users.push(adminUser.id, talent.id, employerUser.id, interviewerUser.id);
  interviewerIds.push(interviewer.id);
  return {
    adminId: adminUser.id,
    interviewerUserId: interviewerUser.id,
    interviewerId: interviewer.id,
    talentUserId: talent.id,
    employerId: employer.id,
    interviewId: interview.id,
  };
}

after(async () => {
  // Phased, deepest first: Interview, Entitlement, Slate and ProfileSnapshot
  // are all Restrict-guarded against the rows above them on purpose.
  const employers = await db.employerAccount.findMany({
    where: { userId: { in: users } },
    select: { id: true },
  });
  const employerIds = employers.map((e) => e.id);

  await db.entitlement.deleteMany({ where: { employerId: { in: employerIds } } });
  await db.interview.deleteMany({ where: { talentUserId: { in: users } } });
  await db.interviewer.deleteMany({ where: { id: { in: interviewerIds } } });
  await db.slateEntry.deleteMany({ where: { slate: { jd: { employerId: { in: employerIds } } } } });
  await db.slate.deleteMany({ where: { jd: { employerId: { in: employerIds } } } });
  await db.profileSnapshot.deleteMany({ where: { jd: { employerId: { in: employerIds } } } });
  await db.jobDescription.deleteMany({ where: { employerId: { in: employerIds } } });
  await db.auditLog.deleteMany({ where: { actorId: { in: users } } });
  await db.notification.deleteMany({ where: { userId: { in: users } } });
  await db.user.deleteMany({ where: { id: { in: users } } });

  await db.$disconnect();
});

describe("applyUserStatus — a ban has to reach every role the person holds", () => {
  it("takes a banned interviewer out of the bookable pool", async () => {
    const f = await bookedInterview();

    await applyUserStatus({
      actorId: f.adminId,
      userId: f.interviewerUserId,
      status: "banned",
      action: "admin.user.banned",
    });

    const interviewer = await db.interviewer.findUniqueOrThrow({
      where: { id: f.interviewerId },
    });
    assert.notEqual(
      interviewer.status,
      "active",
      "an active Interviewer row is what employers pick from — a banned one must leave it",
    );
  });

  it("cancels the interview they can no longer run, and returns the credit", async () => {
    const f = await bookedInterview();

    await applyUserStatus({
      actorId: f.adminId,
      userId: f.interviewerUserId,
      status: "suspended",
      action: "admin.user.suspended",
    });

    const interview = await db.interview.findUniqueOrThrow({ where: { id: f.interviewId } });
    assert.equal(
      interview.status,
      "cancelled",
      "their sessions are revoked, so the call cannot happen — leaving it booked strands both parties",
    );

    const employer = await db.employerAccount.findUniqueOrThrow({ where: { id: f.employerId } });
    assert.equal(employer.interviewCredits, 1, "the employer paid for a call that never happened");

    const entitlement = await db.entitlement.findFirstOrThrow({
      where: { employerId: f.employerId },
    });
    assert.equal(
      entitlement.spentOnInterviewId,
      null,
      "the ledger row has to be freed too, or the balance and the ledger disagree",
    );
  });

  it("cancels an interview the banned person was the CANDIDATE for", async () => {
    const f = await bookedInterview();

    await applyUserStatus({
      actorId: f.adminId,
      userId: f.talentUserId,
      status: "banned",
      action: "admin.user.banned",
    });

    const interview = await db.interview.findUniqueOrThrow({ where: { id: f.interviewId } });
    assert.equal(interview.status, "cancelled");
  });

  it("does not put a paused interviewer back in the pool on reactivation", async () => {
    const f = await bookedInterview();
    await applyUserStatus({
      actorId: f.adminId,
      userId: f.interviewerUserId,
      status: "suspended",
      action: "admin.user.suspended",
    });

    await applyUserStatus({
      actorId: f.adminId,
      userId: f.interviewerUserId,
      status: "active",
      action: "admin.user.active",
    });

    const interviewer = await db.interviewer.findUniqueOrThrow({ where: { id: f.interviewerId } });
    assert.equal(
      interviewer.status,
      "paused",
      "same rule as the talent profile: restoring ACCESS is not the same as putting someone back in front of buyers",
    );
  });

  it("leaves delivered work alone", async () => {
    const f = await bookedInterview();
    await db.interview.update({ where: { id: f.interviewId }, data: { status: "reported" } });

    await applyUserStatus({
      actorId: f.adminId,
      userId: f.interviewerUserId,
      status: "banned",
      action: "admin.user.banned",
    });

    const interview = await db.interview.findUniqueOrThrow({ where: { id: f.interviewId } });
    assert.equal(
      interview.status,
      "reported",
      "the call ran and the assessment was filed — cancelling would erase earnings someone is owed",
    );
  });
});

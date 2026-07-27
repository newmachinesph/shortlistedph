/**
 * Capacity from confirmed work, against a real Postgres.
 *
 *   npm run test:money        (runs every *.dbtest.ts)
 *
 * A confirmed hire changed nothing about capacity. Someone working 40h/week for
 * one employer still scored as fully free, kept being ranked for full-time
 * roles, and kept receiving invitations they had to decline — which the
 * rotation change now charges them for. `committedHours` already fed
 * scoreOverlap, the preferences facet and the Stage 0 hours filter; nothing had
 * ever written it except the talent by hand.
 */
import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { config } from "dotenv";

config({ path: ".env.local", override: true });

const { db } = await import("./db.ts");
const { currentPeriod, previousPeriod, syncCommittedHours, syncAllCommittedHours } = await import(
  "./agreements.ts"
);

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL missing from .env.local");

let seq = 0;
const users: string[] = [];

/**
 * A talent with one agreement for `hoursPerWeek`, confirmed by both sides for
 * `period` — or unconfirmed when `period` is null.
 */
async function engagement(opts: {
  hoursPerWeek: number;
  period: string | null;
  profileId?: string;
  selfCommittedHours?: number;
}) {
  const id = `hours-test-${Date.now()}-${seq++}`;

  let profileId = opts.profileId;
  if (!profileId) {
    const talent = await db.user.create({
      data: { id: `${id}-t`, name: "Talent", email: `${id}-t@example.com`, role: "talent" },
    });
    const profile = await db.talentProfile.create({
      data: {
        userId: talent.id,
        headline: "Engineer",
        selfCommittedHours: opts.selfCommittedHours ?? 0,
        committedHours: opts.selfCommittedHours ?? 0,
      },
    });
    users.push(talent.id);
    profileId = profile.id;
  }

  const employerUser = await db.user.create({
    data: { id: `${id}-e`, name: "Employer", email: `${id}-e@example.com`, role: "employer" },
  });
  const employer = await db.employerAccount.create({
    data: { userId: employerUser.id, companyName: `Hours Co ${seq}` },
  });
  const jd = await db.jobDescription.create({
    data: {
      employerId: employer.id,
      title: `Hours test brief ${seq}`,
      status: "slate_ready",
      hoursPerWeek: opts.hoursPerWeek,
    },
  });
  const slate = await db.slate.create({ data: { jdId: jd.id, status: "unlocked" } });
  const snapshot = await db.profileSnapshot.create({
    data: { profileId, jdId: jd.id, frozenJson: {} },
  });
  const entry = await db.slateEntry.create({
    data: { slateId: slate.id, snapshotId: snapshot.id, rank: 1, score: 80, dims: {} },
  });
  const connection = await db.connection.create({
    data: { slateEntryId: entry.id, state: "consented" },
  });
  const agreement = await db.agreement.create({
    data: {
      connectionId: connection.id,
      terms: { title: jd.title, hoursPerWeek: opts.hoursPerWeek },
      talentSignedAt: new Date(),
      employerSignedAt: new Date(),
    },
  });

  if (opts.period) {
    await db.outcomeConfirmation.create({
      data: {
        agreementId: agreement.id,
        period: opts.period,
        talentConfirmedAt: new Date(),
        employerConfirmedAt: new Date(),
      },
    });
  }

  users.push(employerUser.id);
  return { profileId, agreementId: agreement.id };
}

const hoursOf = async (profileId: string) =>
  (await db.talentProfile.findUniqueOrThrow({ where: { id: profileId } })).committedHours;

after(async () => {
  const employers = await db.employerAccount.findMany({
    where: { userId: { in: users } },
    select: { id: true },
  });
  const employerIds = employers.map((e) => e.id);

  await db.agreement.deleteMany({
    where: { connection: { slateEntry: { slate: { jd: { employerId: { in: employerIds } } } } } },
  });
  await db.connection.deleteMany({
    where: { slateEntry: { slate: { jd: { employerId: { in: employerIds } } } } },
  });
  await db.slateEntry.deleteMany({ where: { slate: { jd: { employerId: { in: employerIds } } } } });
  await db.slate.deleteMany({ where: { jd: { employerId: { in: employerIds } } } });
  await db.profileSnapshot.deleteMany({ where: { jd: { employerId: { in: employerIds } } } });
  await db.jobDescription.deleteMany({ where: { employerId: { in: employerIds } } });
  await db.user.deleteMany({ where: { id: { in: users } } });

  await db.$disconnect();
});

describe("syncCommittedHours", () => {
  it("commits the hours of a confirmed engagement", async () => {
    const { profileId } = await engagement({ hoursPerWeek: 20, period: currentPeriod() });

    await syncCommittedHours(profileId);

    assert.equal(await hoursOf(profileId), 20);
  });

  it("adds up two confirmed engagements", async () => {
    const first = await engagement({ hoursPerWeek: 20, period: currentPeriod() });
    await engagement({ hoursPerWeek: 15, period: currentPeriod(), profileId: first.profileId });

    await syncCommittedHours(first.profileId);

    assert.equal(await hoursOf(first.profileId), 35);
  });

  it("keeps the talent's own figure on top of the confirmed ones", async () => {
    // They may be working somewhere this platform will never hear about.
    const { profileId } = await engagement({
      hoursPerWeek: 20,
      period: currentPeriod(),
      selfCommittedHours: 10,
    });

    await syncCommittedHours(profileId);

    assert.equal(await hoursOf(profileId), 30, "deriving from agreements alone would erase the 10");
  });

  it("counts last month's confirmation too", async () => {
    // Otherwise every talent drops to zero on the 1st and climbs back as the
    // month's confirmations land.
    const { profileId } = await engagement({ hoursPerWeek: 20, period: previousPeriod() });

    await syncCommittedHours(profileId);

    assert.equal(await hoursOf(profileId), 20);
  });

  it("gives the week back when the confirmations stop", async () => {
    // Nothing fires when an engagement ends — it ends by the monthly
    // confirmations simply not arriving.
    const stale = "2020-01";
    const { profileId } = await engagement({ hoursPerWeek: 40, period: stale });

    await syncCommittedHours(profileId);

    assert.equal(await hoursOf(profileId), 0, "a lapsed engagement must not hold capacity forever");
  });

  it("ignores an agreement neither side has confirmed", async () => {
    const { profileId } = await engagement({ hoursPerWeek: 40, period: null });

    await syncCommittedHours(profileId);

    assert.equal(await hoursOf(profileId), 0, "signing is not the same as working");
  });

  it("ignores a period only one side confirmed", async () => {
    const { profileId, agreementId } = await engagement({ hoursPerWeek: 40, period: null });
    await db.outcomeConfirmation.create({
      data: { agreementId, period: currentPeriod(), talentConfirmedAt: new Date() },
    });

    await syncCommittedHours(profileId);

    assert.equal(await hoursOf(profileId), 0, "a mutual outcome needs both signatures");
  });

  it("is idempotent — running it again does not stack", async () => {
    const { profileId } = await engagement({ hoursPerWeek: 20, period: currentPeriod() });

    await syncCommittedHours(profileId);
    await syncCommittedHours(profileId);
    await syncCommittedHours(profileId);

    assert.equal(await hoursOf(profileId), 20, "derived, never incremented");
  });

  it("never commits more hours than a week holds", async () => {
    const first = await engagement({ hoursPerWeek: 60, period: currentPeriod() });
    await engagement({ hoursPerWeek: 60, period: currentPeriod(), profileId: first.profileId });

    await syncCommittedHours(first.profileId);

    assert.equal(await hoursOf(first.profileId), 80);
  });
});

describe("syncAllCommittedHours", () => {
  it("finds the profiles whose hours moved", async () => {
    const { profileId } = await engagement({ hoursPerWeek: 25, period: currentPeriod() });

    const changed = await syncAllCommittedHours();

    assert.ok(changed >= 1);
    assert.equal(await hoursOf(profileId), 25, "the sweep is what recovers a lapsed engagement");
  });
});

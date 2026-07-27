/**
 * What a candidate can see about interviews of themselves, against a real
 * Postgres.
 *
 *   npm run test:money        (runs every *.dbtest.ts)
 *
 * The assessment and the recording are the candidate's own personal data —
 * they consented to being recorded, which is the gate that lets the employer be
 * charged at all — and both were readable by the employer and an admin and by
 * nobody else. This pins the two halves of that: the subject can reach their
 * own, and cannot reach anyone else's.
 */
import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { config } from "dotenv";

config({ path: ".env.local", override: true });

const { db } = await import("./db.ts");
const { talentInterviews } = await import("./interviews.ts");

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL missing from .env.local");

let seq = 0;
const users: string[] = [];
const interviewers: string[] = [];

/** A reported interview: recording on file, assessment filed. */
async function reportedInterview() {
  const id = `iv-test-${Date.now()}-${seq++}`;

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
    data: { userId: employerUser.id, companyName: "Interview Test Co" },
  });

  const jd = await db.jobDescription.create({
    data: { employerId: employer.id, title: "Interview test brief", status: "slate_ready" },
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
      status: "reported",
      priceUsd: 25,
      interviewerPayoutUsd: 15,
      recordingKey: `recordings/${id}.webm`,
    },
  });
  await db.interviewAssessment.create({
    data: {
      interviewId: interview.id,
      recommendation: "yes",
      overall: 4,
      technical: 4,
      communication: 5,
      englishFluency: 5,
      strengths: "Clear communicator, strong React fundamentals.",
      concerns: "Limited exposure to large-scale data work.",
      notes: "Would place again.",
    },
  });

  users.push(talent.id, employerUser.id, interviewerUser.id);
  interviewers.push(interviewer.id);
  return { talentUserId: talent.id, interviewId: interview.id };
}

after(async () => {
  // Strictly phased, because almost everything here is Restrict-guarded on
  // purpose: an Interview must survive its employer, interviewer or candidate
  // being deleted, and a ProfileSnapshot must survive its profile. Deleting
  // per-user in one pass fails as soon as the candidate is removed before the
  // employer's snapshots are — so every layer goes platform-wide, deepest
  // first, before any user is touched.
  const employers = await db.employerAccount.findMany({
    where: { userId: { in: users } },
    select: { id: true },
  });
  const employerIds = employers.map((e) => e.id);

  await db.interview.deleteMany({ where: { talentUserId: { in: users } } });
  await db.interviewer.deleteMany({ where: { id: { in: interviewers } } });
  await db.slateEntry.deleteMany({ where: { slate: { jd: { employerId: { in: employerIds } } } } });
  await db.slate.deleteMany({ where: { jd: { employerId: { in: employerIds } } } });
  await db.profileSnapshot.deleteMany({ where: { jd: { employerId: { in: employerIds } } } });
  await db.jobDescription.deleteMany({ where: { employerId: { in: employerIds } } });
  await db.user.deleteMany({ where: { id: { in: users } } });

  await db.$disconnect();
});

describe("talentInterviews", () => {
  it("gives the candidate the assessment written about them", async () => {
    const { talentUserId } = await reportedInterview();

    const [row] = await talentInterviews(talentUserId);

    assert.ok(row.assessment, "the subject of an assessment must be able to read it");
    assert.equal(row.assessment.recommendation, "yes");
    assert.equal(row.assessment.overall, 4);
    assert.equal(row.assessment.concerns, "Limited exposure to large-scale data work.");
    // The employer sees this field in full. Withholding it from the person it
    // describes would be the worst of both worlds.
    assert.equal(row.assessment.notes, "Would place again.");
  });

  it("tells the candidate a recording of them exists, without leaking the key", async () => {
    const { talentUserId } = await reportedInterview();

    const [row] = await talentInterviews(talentUserId);

    assert.equal(row.hasRecording, true);
    assert.equal(
      "recordingKey" in row,
      false,
      "the R2 key must stay server-side — the download route presigns it",
    );
  });

  it("never returns another candidate's interview", async () => {
    const mine = await reportedInterview();
    const theirs = await reportedInterview();

    const rows = await talentInterviews(mine.talentUserId);

    assert.equal(rows.length, 1);
    assert.equal(rows[0].id, mine.interviewId);
    assert.equal(
      rows.some((r) => r.id === theirs.interviewId),
      false,
      "scoping is in the WHERE, so someone else's interview is never fetched at all",
    );
  });
});

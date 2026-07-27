/**
 * Who a queued invitation is allowed to reach, against a real Postgres.
 *
 *   npm run test:money        (runs every *.dbtest.ts)
 *
 * The engine decides who gets RANKED; this decides who gets EMAILED, and the
 * two ran on different definitions of "not matchable". The pool query requires
 * visibility AND openToOffers AND no dormancy AND not booked; the sender
 * checked visibility alone, so a candidate who had unticked "I'm open to new
 * offers" — copy: "no new invitation is sent" — still received the invitations
 * queued before they flipped it.
 *
 * These assert on SELECTION, not delivery: a withheld row is never touched,
 * while a row that was picked up records a send attempt even when no SMTP
 * server is listening. That keeps the tests independent of mail working.
 */
import { after, describe, it } from "node:test";
import assert from "node:assert/strict";
import { config } from "dotenv";

config({ path: ".env.local", override: true });

const { db } = await import("./db.ts");
const { sendConsentRequests } = await import("./consent.ts");

if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL missing from .env.local");

let seq = 0;
const created: string[] = [];

/**
 * A published, matchable candidate with one queued-but-unsent invitation —
 * the state a candidate is in between a slate being built and the emails going
 * out, which is exactly the window an opt-out has to be honoured in.
 */
async function queuedInvite(profileOverrides: Record<string, unknown> = {}) {
  const id = `consent-test-${Date.now()}-${seq++}`;

  const talent = await db.user.create({
    data: { id: `${id}-t`, name: "Talent", email: `${id}-t@example.com`, role: "talent" },
  });
  const profile = await db.talentProfile.create({
    data: {
      userId: talent.id,
      headline: "Engineer",
      rateUsd: 20,
      publishedAt: new Date(),
      ...profileOverrides,
    },
  });

  const employer = await db.user.create({
    data: { id: `${id}-e`, name: "Employer", email: `${id}-e@example.com`, role: "employer" },
  });
  const account = await db.employerAccount.create({
    data: { userId: employer.id, companyName: "Consent Test Co" },
  });
  const jd = await db.jobDescription.create({
    data: { employerId: account.id, title: "Consent test brief", status: "slate_ready" },
  });
  const slate = await db.slate.create({ data: { jdId: jd.id, status: "preview" } });
  const consent = await db.matchConsent.create({
    data: { jdId: jd.id, profileId: profile.id, slateId: slate.id, token: id },
  });

  created.push(talent.id, employer.id);
  return { jdId: jd.id, consentId: consent.id, profileId: profile.id };
}

/** True when the sender picked the row up at all — sent, or tried and failed. */
async function wasAttempted(consentId: string) {
  const c = await db.matchConsent.findUniqueOrThrow({ where: { id: consentId } });
  return c.sendAttempts > 0 || c.sentAt !== null;
}

after(async () => {
  for (const userId of created) {
    const account = await db.employerAccount.findUnique({ where: { userId } });
    if (account) {
      await db.slate.deleteMany({ where: { jd: { employerId: account.id } } });
      await db.jobDescription.deleteMany({ where: { employerId: account.id } });
    }
    await db.user.delete({ where: { id: userId } });
  }
  await db.$disconnect();
});

describe("sendConsentRequests — who a queued invitation may reach", () => {
  it("sends to a matchable candidate", async () => {
    const { jdId, consentId } = await queuedInvite();

    await sendConsentRequests(jdId);

    assert.equal(
      await wasAttempted(consentId),
      true,
      "a matchable candidate's queued invitation must go out",
    );
  });

  it("withholds from someone who is not open to offers", async () => {
    const { jdId, consentId } = await queuedInvite({ openToOffers: false });

    const { sent } = await sendConsentRequests(jdId);

    assert.equal(sent, 0);
    assert.equal(
      await wasAttempted(consentId),
      false,
      'the checkbox says "no new invitation is sent" — the queued ones are exactly what that has to cover',
    );
  });

  it("withholds from someone fully booked", async () => {
    const { jdId, consentId } = await queuedInvite({ availability: "booked" });

    await sendConsentRequests(jdId);

    assert.equal(
      await wasAttempted(consentId),
      false,
      '"fully booked" is documented as taking you out of matching too',
    );
  });

  it("withholds from a dormant profile", async () => {
    const { jdId, consentId } = await queuedInvite({ dormantAt: new Date() });

    await sendConsentRequests(jdId);

    assert.equal(
      await wasAttempted(consentId),
      false,
      "dormancy exists to stop invitations reaching someone who ignored the last one",
    );
  });

  it("withholds from a hidden profile", async () => {
    const { jdId, consentId } = await queuedInvite({ visibility: false });

    await sendConsentRequests(jdId);

    assert.equal(await wasAttempted(consentId), false);
  });

  it("withholds from a suspended account", async () => {
    const { jdId, consentId, profileId } = await queuedInvite();
    const profile = await db.talentProfile.findUniqueOrThrow({ where: { id: profileId } });
    await db.user.update({ where: { id: profile.userId }, data: { status: "suspended" } });

    await sendConsentRequests(jdId);

    assert.equal(
      await wasAttempted(consentId),
      false,
      "a suspended account is out of the pool and must be out of the outbox",
    );
  });
});

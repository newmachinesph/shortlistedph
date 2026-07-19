/**
 * The one check that must never break: a locked slate leaks nothing.
 * Run with: node --experimental-strip-types src/lib/slate.test.ts
 */
import assert from "node:assert/strict";
import { maskEntry, type SlateEntryInput } from "./slate.ts";

const entry: SlateEntryInput = {
  id: "e1",
  rank: 1,
  score: 94,
  dims: { skills: 96, rate: 100, overlap: 95, experience: 88 },
  reasons: ["6 yrs in US dental practices"],
  snapshot: {
    id: "snap1",
    frozenJson: {
      userId: "u_secret",
      headline: "Medical VA",
      summary: "Six years inside US dental practices.",
      city: "Davao City",
      yearsExperience: 6,
      rateUsd: 9,
      availability: "open",
      committedHours: 0,
      verifiedTier: "id_verified",
      profileStableDays: 74,
      skills: [{ name: "Dentrix", confirmed: true }],
      engagements: [
        { role: "Patient Coordinator", company: "Harbor Dental", span: "2022-2025", outcome: "confirmed" },
      ],
    },
  },
  candidateName: "Kristine Bautista",
};

// Locked: no PII anywhere in the serialized payload.
const locked = maskEntry({ ...entry, candidateName: null }, false);
const blob = JSON.stringify(locked);

for (const secret of ["Kristine", "Bautista", "u_secret", "snap1", "Harbor Dental"]) {
  assert.ok(!blob.includes(secret), `locked payload leaked "${secret}"`);
}
assert.equal(locked.locked, true);
assert.equal(locked.name, undefined);
assert.equal(locked.snapshotId, undefined);
assert.equal(locked.engagements, undefined);
assert.equal(locked.summary, undefined);

// ...but the preview still sells: score, dims, reasons, skills, rate survive.
assert.equal(locked.score, 94);
assert.equal(locked.rateUsd, 9);
assert.equal(locked.skills[0].name, "Dentrix");
assert.equal(locked.reasons.length, 1);
assert.equal(locked.initials, "??");

// Unlocked: identity is released.
const open = maskEntry(entry, true);
assert.equal(open.locked, false);
assert.equal(open.name, "Kristine Bautista");
assert.equal(open.initials, "KB");
assert.equal(open.snapshotId, "snap1");
assert.equal(open.engagements?.[0].company, "Harbor Dental");

console.log("slate masking: OK");

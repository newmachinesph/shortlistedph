/**
 * Drives the core loop against a RUNNING dev app and asserts the database
 * agreed. Everything outside the re-activation flow was, until this existed,
 * verified only by the typechecker.
 *
 *   npx next dev                     # in another terminal
 *   npm run smoke
 *
 * Dev only. It writes real rows (two users, a profile, a JD, a slate) and
 * refuses to run against anything but DATABASE_URL. Re-runnable: every account
 * is stamped with a fresh timestamp, so runs never collide.
 *
 * Failures print the step, the HTTP status and the body, then stop — a smoke
 * test that carries on after a broken step only reports noise.
 */
import { config } from "dotenv";
import pg from "pg";
import { SignJWT } from "jose";

config({ path: ".env.local", override: true });

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
const SECRET = need("BETTER_AUTH_SECRET");
const db = new pg.Client({ connectionString: need("DATABASE_URL") });

function need(key: string): string {
  const v = process.env[key];
  if (!v) throw new Error(`${key} missing from .env.local`);
  return v;
}

// ── HTTP with a cookie jar ───────────────────────────────────────────────────

type Jar = Map<string, string>;

/**
 * Whatever came back. The assertions below read fields off responses and rows
 * directly; restating the API's and Prisma's types here would only be a second
 * copy to drift out of sync with the thing under test.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Loose = any;

async function call(
  jar: Jar,
  method: string,
  path: string,
  body?: unknown,
): Promise<{ status: number; json: Loose; text: string }> {
  const cookie = [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
  const res = await fetch(`${BASE}${path}`, {
    method,
    redirect: "manual",
    headers: {
      // better-auth rejects a state-changing request with no Origin outright
      // (MISSING_OR_NULL_ORIGIN) — a browser always sends one, so this is the
      // header being restored, not a check being bypassed.
      origin: BASE,
      ...(body === undefined ? {} : { "content-type": "application/json" }),
      ...(cookie ? { cookie } : {}),
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });
  // getSetCookie keeps multiple Set-Cookie headers separate; the combined
  // header would split a cookie whose value contains a comma.
  for (const raw of res.headers.getSetCookie()) {
    const [pair] = raw.split(";");
    const eq = pair.indexOf("=");
    if (eq > 0) jar.set(pair.slice(0, eq).trim(), pair.slice(eq + 1).trim());
  }
  const text = await res.text();
  let json: Loose = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* redirects and HTML pages have no JSON body */
  }
  return { status: res.status, json, text };
}

let step = 0;

/** Every HTTP step goes through here so no failure can be stepped over. */
async function must(
  label: string,
  jar: Jar,
  method: string,
  path: string,
  body?: unknown,
  okStatus: number[] = [200, 201],
) {
  const res = await call(jar, method, path, body);
  if (!okStatus.includes(res.status)) {
    throw new Error(
      `${label}\n  ${method} ${path} -> ${res.status}\n  ${res.text.slice(0, 400)}`,
    );
  }
  console.log(`  ${String(++step).padStart(2)}. ok   ${label}`);
  return res.json;
}

function check(label: string, condition: unknown, detail = "") {
  if (!condition) throw new Error(`ASSERTION FAILED: ${label}${detail ? `\n  ${detail}` : ""}`);
  console.log(`  ${String(++step).padStart(2)}. db   ${label}`);
}

async function one<T = Loose>(sql: string, params: unknown[] = []): Promise<T> {
  const { rows } = await db.query(sql, params);
  return rows[0] as T;
}

// ── Signup + email verification ──────────────────────────────────────────────

/**
 * requireEmailVerification means signup issues no session. The link normally
 * arrives by email; the token is just an HS256 JWT over {email} signed with
 * BETTER_AUTH_SECRET (better-auth createEmailVerificationToken), so the script
 * mints its own and hits the real endpoint. Only the delivery is skipped —
 * /api/auth/verify-email runs exactly as a human's click would.
 */
async function verifyToken(email: string): Promise<string> {
  return new SignJWT({ email: email.toLowerCase() })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + 3600)
    .sign(new TextEncoder().encode(SECRET));
}

async function signUpAndVerify(name: string, email: string, password: string): Promise<Jar> {
  const jar: Jar = new Map();
  await must(`sign up ${email}`, jar, "POST", "/api/auth/sign-up/email", {
    name,
    email,
    password,
  });
  check(
    "signup issued NO session (email verification is enforced)",
    !jar.has("better-auth.session_token"),
    `cookies: ${[...jar.keys()].join(", ") || "none"}`,
  );
  const token = await verifyToken(email);
  await must(
    "verify email",
    jar,
    "GET",
    `/api/auth/verify-email?token=${token}&callbackURL=%2F`,
    undefined,
    [200, 302],
  );
  check("verification signed the user in", jar.has("better-auth.session_token"));
  return jar;
}

// ── The run ──────────────────────────────────────────────────────────────────

async function main() {
  const stamp = Date.now();
  const talentEmail = `smoke.talent.${stamp}@example.com`;
  const employerEmail = `smoke.employer.${stamp}@example.com`;
  const password = "SmokeTest!2026";

  await db.connect();
  console.log(`\nsmoke: core loop against ${BASE}\n`);

  // Previous runs left a published profile in the matching pool, which would
  // show up in every later employer's slate. Clearing them first keeps dev
  // honest and makes the invite count mean what it says.
  //
  // Slate and ProfileSnapshot are ON DELETE RESTRICT on purpose — they are the
  // delivered product and must outlive an edit or a deletion upstream — so they
  // are dropped explicitly, in dependency order, rather than by cascade.
  // Everything else (profile, JD, consents, entries) cascades from user, slate
  // and snapshot. That these two need naming here is the guard working.
  const smoke = `LIKE 'smoke.%@example.com'`;
  await db.query(
    `DELETE FROM "Slate" sl
      USING "JobDescription" j, "EmployerAccount" e, "user" u
      WHERE sl."jdId" = j.id AND j."employerId" = e.id AND e."userId" = u.id AND u.email ${smoke}`,
  );
  await db.query(
    `DELETE FROM "ProfileSnapshot" s
      USING "TalentProfile" p, "user" u
      WHERE s."profileId" = p.id AND p."userId" = u.id AND u.email ${smoke}`,
  );
  const purged = await db.query(`DELETE FROM "user" WHERE email ${smoke}`);
  if (purged.rowCount) console.log(`  purged ${purged.rowCount} account(s) from earlier runs\n`);

  // ── Talent: register → onboard → publish ──────────────────────────────────
  console.log("TALENT");
  const talent = await signUpAndVerify("Smoke Talent", talentEmail, password);

  await must("claim the talent role", talent, "POST", "/api/onboarding/role", {
    role: "talent",
  });

  await must("fill the profile", talent, "PATCH", "/api/talent/profile", {
    headline: "Senior React engineer",
    summary:
      "Eight years building React and TypeScript products, most recently a Next.js " +
      "commerce platform serving 40k monthly buyers. Comfortable owning a feature " +
      "end to end: data model, API, UI and the tests that keep it honest.",
    city: "Cebu City",
    yearsExperience: 8,
    availability: "open",
    committedHours: 0,
    englishLevel: "fluent",
    tools: "React, TypeScript, Next.js, PostgreSQL, Prisma",
    preferredOverlap: "4h US Eastern",
    skills: ["React", "TypeScript", "Next.js", "PostgreSQL"],
    engagements: [
      { role: "Senior Frontend Engineer", company: "Kalibrr", span: "2022-2025" },
    ],
  });

  await must("set the standing rate", talent, "PUT", "/api/talent/rate", { rateUsd: 22 });
  await must("publish", talent, "POST", "/api/talent/publish");

  const profile = await one(
    `SELECT p.id, p."publishedAt", p."rateUsd", p."openToOffers", p.visibility,
            p.embedding IS NOT NULL AS has_embedding,
            p."embeddingSkills" IS NOT NULL AS has_skills_vec,
            (SELECT count(*) FROM "Skill" s WHERE s."profileId" = p.id) AS skills,
            (SELECT count(*) FROM "ProfileTool" t WHERE t."profileId" = p.id) AS tools
       FROM "TalentProfile" p
       JOIN "user" u ON u.id = p."userId"
      WHERE u.email = $1`,
    [talentEmail],
  );
  check("profile row exists", profile);
  check("publishedAt is set", profile.publishedAt);
  check("whole-profile embedding written", profile.has_embedding);
  check("skills facet vector written", profile.has_skills_vec);
  check("skills persisted", Number(profile.skills) === 4, `got ${profile.skills}`);
  check("canonical tools derived", Number(profile.tools) > 0, `got ${profile.tools}`);
  check("in the matching pool", profile.openToOffers && profile.visibility);

  // ── Employer: register → brief → publish → slate ──────────────────────────
  console.log("\nEMPLOYER");
  const employer = await signUpAndVerify("Smoke Employer", employerEmail, password);

  await must("claim the employer role", employer, "POST", "/api/onboarding/role", {
    role: "employer",
    companyName: "Smoke Test Co",
    location: "Singapore",
    contactName: "Sam Buyer",
  });

  const { jd } = await must("create the brief", employer, "POST", "/api/jds", {
    title: "Senior React engineer for a Next.js commerce platform",
    budgetMin: 15,
    budgetMax: 30,
    hoursPerWeek: 40,
    overlap: "4h US Eastern",
    mustHaves: ["React", "TypeScript"],
    niceToHaves: ["Next.js", "PostgreSQL"],
    rateMaxUsd: 30,
  });

  const slateResult = await must(
    "publish the brief (embeds + ranks + invites)",
    employer,
    "POST",
    `/api/jds/${jd.id}/publish`,
  );
  check(
    "the pool was actually scanned",
    slateResult.scanned > 0,
    `scanned=${slateResult.scanned} — a published profile exists, so 0 means the pool query excluded it`,
  );
  check("a slate was created", slateResult.slateId, JSON.stringify(slateResult));
  check("exactly this run's candidate was invited", slateResult.invited === 1, `invited=${slateResult.invited}`);

  const consent = await one(
    `SELECT c.id, c.token, c.status, c.score, c.dims, c.reasons, c."snapshotId"
       FROM "MatchConsent" c WHERE c."jdId" = $1 AND c."profileId" = $2`,
    [jd.id, profile.id],
  );
  check("this run's candidate got a consent request", consent);
  check("ranking frozen at INVITE time — score", consent.score != null);
  check("ranking frozen at INVITE time — dims", consent.dims != null);
  check("ranking frozen at INVITE time — snapshot", consent.snapshotId);
  check("match bullets written", Array.isArray(consent.reasons) && consent.reasons.length > 0);

  // The hidden-JD principle, checked against what a candidate's browser
  // actually receives rather than against the query that feeds it. The company
  // name and the employer's own wording of the title must not survive the trip.
  const consentPage = await call(new Map(), "GET", `/consent/${consent.token}`);
  check("consent page renders for an unauthenticated candidate", consentPage.status === 200);
  check(
    "consent page does not name the employer",
    !consentPage.text.includes("Smoke Test Co"),
  );
  check(
    "consent page does not leak the employer's raw title",
    !consentPage.text.includes("Next.js commerce platform"),
  );

  const slateBefore = await one(`SELECT status FROM "Slate" WHERE id = $1`, [
    slateResult.slateId,
  ]);
  check(
    "slate starts behind the curtain (pending_review)",
    slateBefore.status === "pending_review",
    `got ${slateBefore.status}`,
  );

  // The employer must not see a slate an admin has not released.
  const early = await call(employer, "GET", `/api/slates/${slateResult.slateId}`);
  check(
    "employer cannot read an unapproved slate",
    early.status >= 400,
    `GET /api/slates/{id} -> ${early.status}`,
  );

  // ── Admin: approve ────────────────────────────────────────────────────────
  console.log("\nADMIN");
  const admin: Jar = new Map();
  await must("admin sign-in", admin, "POST", "/api/auth/sign-in/email", {
    email: need("ADMIN_EMAIL"),
    password: need("ADMIN_PASSWORD"),
  });
  await must("approve the slate", admin, "POST", `/api/admin/slates/${slateResult.slateId}/approve`);

  const approved = await one(`SELECT status FROM "Slate" WHERE id = $1`, [slateResult.slateId]);
  check("slate released to preview", approved.status === "preview", `got ${approved.status}`);

  // ── Talent accepts → the slate finally has a body on it ───────────────────
  console.log("\nCONSENT");
  await must("candidate accepts", new Map(), "POST", `/api/consent/${consent.token}`, {
    action: "accept",
  });

  // SlateEntry reaches the candidate through the snapshot, never by profileId —
  // the entry IS the frozen record, not a pointer at a live profile.
  const entry = await one(
    `SELECT e.id, e."snapshotId", e.score
       FROM "SlateEntry" e
       JOIN "ProfileSnapshot" s ON s.id = e."snapshotId"
      WHERE e."slateId" = $1 AND s."profileId" = $2`,
    [slateResult.slateId, profile.id],
  );
  check("slate entry created on accept", entry);
  check(
    "the entry carries the INVITE-time snapshot, not a fresh one",
    entry.snapshotId === consent.snapshotId,
    `entry=${entry.snapshotId} consent=${consent.snapshotId}`,
  );
  check("the entry carries the frozen score", Number(entry.score) === Number(consent.score));

  const employerSlate = await call(employer, "GET", `/api/slates/${slateResult.slateId}`);
  check(
    "employer can now read the slate",
    employerSlate.status === 200,
    `-> ${employerSlate.status} ${employerSlate.text.slice(0, 200)}`,
  );

  console.log(`\nPASS — ${step} checks\n`);
}

try {
  await main();
} catch (e) {
  console.error(`\nFAIL at step ${step + 1}\n${e instanceof Error ? e.message : e}\n`);
  process.exitCode = 1;
} finally {
  await db.end();
}

import "server-only";
import { z } from "zod";
import { db } from "./db";
import { mail } from "./email";
import { notify } from "./notify";
import { blendSimilarity, jdFacetTexts } from "./facets";
import { MODELS, embedMany, openai, toVectorLiteral } from "./openai";
import {
  QUALIFY_SCORE,
  QUALIFY_SKILLS,
  composite,
  scoreExperience,
  scoreOverlap,
  scoreRate,
  scoreSkills,
  type Dims,
} from "./scoring";

export type { Dims };

export const SLATE_SIZE = 5;
const CANDIDATE_POOL = 50;

// A candidate whose availability was confirmed within this window is treated as
// "fresh" and gets a light nudge up the rotation — never a hard filter.
const AVAILABILITY_FRESH_DAYS = 14;

const ReasonsOutput = z.object({
  candidates: z
    .array(z.object({ index: z.number().int(), reasons: z.array(z.string()) }))
    .optional(),
});

type Candidate = {
  id: string;
  userId: string;
  headline: string | null;
  summary: string | null;
  city: string | null;
  yearsExperience: number;
  rateUsd: number | null;
  availability: string;
  committedHours: number;
  verifiedTier: string;
  lastEditedAt: Date;
  shortlistCount: number;
  lastShownAt: Date | null;
  openToOffers: boolean;
  availabilityConfirmedAt: Date | null;
  // Facet cosine distances; each COALESCEs to the whole-profile distance when
  // the facet column is NULL, so un-backfilled profiles rank as before.
  dskills: number;
  dexp: number;
  dprefs: number;
};

type Jd = {
  id: string;
  title: string;
  mustHaves: string[];
  niceToHaves: string[];
  budgetMin: number | null;
  budgetMax: number | null;
  hoursPerWeek: number | null;
  overlap: string | null;
};

// Single owner is facets.ts — the eval harness and backfill embed this exact text.
export function jdEmbedText(jd: Jd): string {
  return jdFacetTexts(jd).role;
}

/**
 * Ranks the market against one job description.
 * The LLM writes prose reasons only — it never decides rank.
 */
export async function buildSlate(jdId: string) {
  const jd = await db.jobDescription.findUniqueOrThrow({ where: { id: jdId } });
  // Two query vectors, one batch call: the whole-JD role text (also the hnsw
  // pool cut) and the skills-facet text.
  const q = jdFacetTexts(jd);
  const [roleVec, skillsVec] = await embedMany([q.role, q.skills]);

  const pool = await db.$queryRawUnsafe<Candidate[]>(
    `SELECT p.id, p."userId", p.headline, p.summary, p.city, p."yearsExperience",
            p."rateUsd", p.availability, p."committedHours", p."verifiedTier", p."lastEditedAt",
            p."shortlistCount", p."lastShownAt", p."openToOffers", p."availabilityConfirmedAt",
            COALESCE(p."embeddingSkills" <=> $2::vector, p.embedding <=> $1::vector) AS dskills,
            COALESCE(p."embeddingExperience" <=> $1::vector, p.embedding <=> $1::vector) AS dexp,
            COALESCE(p."embeddingPrefs" <=> $1::vector, p.embedding <=> $1::vector) AS dprefs
       FROM "TalentProfile" p
       JOIN "user" u ON u.id = p."userId"
      WHERE p."publishedAt" IS NOT NULL
        AND p.visibility = true
        AND p.embedding IS NOT NULL
        AND u.status = 'active'
      ORDER BY p.embedding <=> $1::vector
      LIMIT ${CANDIDATE_POOL}`,
    toVectorLiteral(roleVec),
    toVectorLiteral(skillsVec),
  );

  if (pool.length === 0) {
    // Terminal state, not "still matching" — otherwise the dashboard spins forever.
    await db.jobDescription.update({ where: { id: jd.id }, data: { status: "no_matches" } });
    return { slateId: null, scanned: 0, entries: 0 };
  }

  const ids = pool.map((c) => c.id);
  const [skills, engagements] = await Promise.all([
    db.skill.findMany({ where: { profileId: { in: ids } } }),
    db.engagement.findMany({ where: { profileId: { in: ids } } }),
  ]);

  const skillsBy = new Map<string, typeof skills>();
  for (const s of skills) {
    const list = skillsBy.get(s.profileId) ?? [];
    list.push(s);
    skillsBy.set(s.profileId, list);
  }
  const engBy = new Map<string, typeof engagements>();
  for (const e of engagements) {
    const list = engBy.get(e.profileId) ?? [];
    list.push(e);
    engBy.set(e.profileId, list);
  }

  const freshCutoff = Date.now() - AVAILABILITY_FRESH_DAYS * 86_400_000;

  const eligible = pool
    .map((c) => {
      const cSkills = skillsBy.get(c.id) ?? [];
      const cEng = engBy.get(c.id) ?? [];
      const sim = blendSimilarity(c.dskills, c.dexp, c.dprefs);
      const dims: Dims = {
        skills: scoreSkills(jd.mustHaves, cSkills, sim, {
          headline: c.headline,
          roles: cEng.map((e) => e.role),
        }),
        rate: scoreRate(c.rateUsd, jd.budgetMin, jd.budgetMax),
        overlap: scoreOverlap(c.availability, c.committedHours, jd.hoursPerWeek),
        experience: scoreExperience(c.yearsExperience, cEng.filter((e) => e.outcome === "confirmed").length),
      };
      const fresh = c.openToOffers && (c.availabilityConfirmedAt?.getTime() ?? 0) >= freshCutoff;
      return {
        c,
        dims,
        score: composite(dims, c.verifiedTier === "id_verified"),
        fresh,
        skills: cSkills,
        engagements: cEng,
      };
    })
    // Quality gates eligibility: a candidate rotates only if the composite
    // clears QUALIFY *and* there is real skill overlap for this job. Fairness
    // never places anyone below the bar; padding can't buy a wrong-domain slot.
    .filter((r) => r.score >= QUALIFY_SCORE && r.dims.skills >= QUALIFY_SKILLS)
    // Rotate among the qualified. Fewer prior placements first (shown least),
    // then longest-waiting (older/null lastShownAt), then a light nudge for
    // freshly-confirmed availability, and finally score as the tiebreaker.
    // Because shortlistCount leads, once everyone qualified has been shown they
    // all sit at higher counts and the least-shown return to the front — the
    // cycle resets itself, and anyone placed (or hired) drifts back each turn.
    .sort((a, b) => {
      if (a.c.shortlistCount !== b.c.shortlistCount) return a.c.shortlistCount - b.c.shortlistCount;
      const at = a.c.lastShownAt?.getTime() ?? 0;
      const bt = b.c.lastShownAt?.getTime() ?? 0;
      if (at !== bt) return at - bt;
      if (a.fresh !== b.fresh) return Number(b.fresh) - Number(a.fresh);
      return b.score - a.score;
    });

  const top = eligible.slice(0, SLATE_SIZE);

  // Nobody cleared the bar. Record that honestly instead of creating an empty
  // slate the employer could be charged to "unlock".
  if (top.length === 0) {
    await db.jobDescription.update({ where: { id: jd.id }, data: { status: "no_matches" } });
    return { slateId: null, scanned: pool.length, entries: 0 };
  }

  const reasons = await explain(jd, top);

  const publishedAt = jd.publishedAt ?? new Date();

  const slate = await db.$transaction(async (tx) => {
    const created = await tx.slate.create({ data: { jdId: jd.id, status: "preview" } });

    for (const [i, r] of top.entries()) {
      // Freeze the profile as of this JD. Later edits cannot change what the
      // employer sees — this is what makes the anti-tailoring claim literal.
      const snapshot = await tx.profileSnapshot.upsert({
        where: { profileId_jdId: { profileId: r.c.id, jdId: jd.id } },
        create: {
          profileId: r.c.id,
          jdId: jd.id,
          frozenJson: {
            name: null, // filled from user at read time; masked while locked
            userId: r.c.userId,
            headline: r.c.headline,
            summary: r.c.summary,
            city: r.c.city,
            yearsExperience: r.c.yearsExperience,
            rateUsd: r.c.rateUsd,
            availability: r.c.availability,
            committedHours: r.c.committedHours,
            verifiedTier: r.c.verifiedTier,
            profileStableDays: Math.max(
              0,
              Math.floor((publishedAt.getTime() - r.c.lastEditedAt.getTime()) / 86_400_000),
            ),
            skills: r.skills.map((s) => ({ name: s.name, confirmed: s.confirmed })),
            engagements: r.engagements.map((e) => ({
              role: e.role,
              company: e.company,
              span: e.span,
              outcome: e.outcome,
            })),
          },
        },
        update: {},
      });

      await tx.slateEntry.create({
        data: {
          slateId: created.id,
          snapshotId: snapshot.id,
          rank: i + 1,
          score: r.score,
          dims: r.dims,
          reasons: reasons[i] ?? [],
        },
      });
    }

    // Stamp the rotation counters in the same transaction that wrote the
    // entries: each placed candidate's shortlistCount rises and lastShownAt
    // moves to now, so next time they order behind whoever has been shown less.
    // Snapshots above stay frozen — this touches live rotation state only.
    await tx.talentProfile.updateMany({
      where: { id: { in: top.map((r) => r.c.id) } },
      data: { shortlistCount: { increment: 1 }, lastShownAt: new Date() },
    });

    await tx.jobDescription.update({ where: { id: jd.id }, data: { status: "slate_ready" } });
    return created;
  });

  // Outside the transaction on purpose: a bounced email must not undo a slate
  // that was built correctly.
  try {
    // The local Jd type carries only matching inputs, so the employer is
    // resolved from the row rather than assumed to be in scope.
    const row = await db.jobDescription.findUnique({
      where: { id: jd.id },
      select: {
        employer: { select: { companyName: true, user: { select: { id: true, email: true } } } },
      },
    });
    const employer = row?.employer;
    if (employer) {
      // In-app row and email are separate deliveries of the same fact. The
      // email can bounce; the bell has to be right either way.
      await notify({
        userId: employer.user.id,
        type: "slate_delivered",
        payload: {
          company: employer.companyName,
          jobTitle: jd.title,
          count: top.length,
          jdId: jd.id,
        },
      });

      await mail.slateDelivered(employer.user.email, {
        company: employer.companyName,
        jobTitle: jd.title,
        count: top.length,
        jdId: jd.id,
      });
    }
  } catch (e) {
    console.error("[matching] slate-ready email failed", e);
  }

  return { slateId: slate.id, scanned: pool.length, entries: top.length };
}

type Ranked = { c: Candidate; dims: Dims; score: number; skills: { name: string; confirmed: boolean }[] };

/** Prose only. If this call fails the slate still ships, just without narration. */
async function explain(jd: Jd, ranked: Ranked[]): Promise<string[][]> {
  if (ranked.length === 0) return [];
  try {
    const res = await openai().responses.create({
      model: MODELS.extract,
      input: [
        {
          role: "system",
          content:
            "You write the 'why shortlisted' bullets an employer reads on a candidate slate. " +
            "Use ONLY the supplied structured facts — never invent experience. " +
            "2-3 bullets each, one short sentence per bullet, concrete and specific. " +
            "If a dimension scored poorly, say so plainly — honest flags build trust. " +
            'Return JSON: {"candidates":[{"index":0,"reasons":["..."]}]}',
        },
        {
          role: "user",
          content: JSON.stringify({
            job: { title: jd.title, mustHaves: jd.mustHaves, budget: [jd.budgetMin, jd.budgetMax], hours: jd.hoursPerWeek, overlap: jd.overlap },
            candidates: ranked.map((r, index) => ({
              index,
              headline: r.c.headline,
              city: r.c.city,
              years: r.c.yearsExperience,
              rateUsd: r.c.rateUsd,
              availability: r.c.availability,
              verified: r.c.verifiedTier === "id_verified",
              skills: r.skills,
              scores: r.dims,
            })),
          }),
        },
      ],
      text: { format: { type: "json_object" } },
    });

    // Same trust-nothing rule as resume.ts: model output is validated, never
    // cast. A malformed reply throws into the catch below and degrades to
    // empty reason bullets instead of propagating a wrong shape.
    const parsed = ReasonsOutput.parse(JSON.parse(res.output_text ?? "{}"));
    const out: string[][] = ranked.map(() => []);
    for (const c of parsed.candidates ?? []) {
      if (out[c.index]) out[c.index] = c.reasons.slice(0, 3);
    }
    return out;
  } catch (e) {
    console.error("[matching] reason generation failed", e);
    return ranked.map(() => []);
  }
}

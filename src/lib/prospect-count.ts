import "server-only";
import { db } from "./db";

/**
 * How many published, active, matchable profiles roughly fit a role — shown to
 * an employer on the open funnel BEFORE they sign up.
 *
 * Deliberately keyword-and-band SQL, NOT the embedding/vector match the real
 * slate uses. Two reasons: embedding every anonymous submission would bill
 * OpenAI for unauthenticated traffic and hand out a cheap way to run up that
 * bill, and the funnel only needs an honest ballpark ("about 140 so far"), not
 * a ranked shortlist. The real matching still runs, unchanged, once they have
 * an account and a JD.
 */

export type ProspectQuery = {
  skills?: string[];
  budgetMax?: number | null; // employer's ceiling; a candidate over it won't fit
  hoursPerWeek?: number | null; // hours the role needs free, not hours worked
};

const STOPWORDS = new Set([
  "and", "or", "the", "with", "for", "a", "an", "to", "of", "in", "on",
  "strong", "experience", "years", "skills", "knowledge", "must", "have",
]);

/** Pull the words worth matching on out of free text or a skills list. */
export function keywordsFrom(input: string[] | string): string[] {
  const text = Array.isArray(input) ? input.join(" ") : input;
  const seen = new Set<string>();
  for (const raw of text.toLowerCase().split(/[^a-z0-9+#.]+/)) {
    const w = raw.trim();
    if (w.length < 2 || STOPWORDS.has(w)) continue;
    seen.add(w);
    if (seen.size >= 12) break; // cap the OR-fan, keep the query cheap
  }
  return [...seen];
}

/**
 * A count, never names. Baseline is the whole matchable pool; each supplied
 * filter can only narrow it. Returns the baseline (not zero) when nothing
 * usable was supplied, so an empty form still shows the pool exists.
 */
export async function prospectCount(q: ProspectQuery): Promise<number> {
  try {
    const words = q.skills?.length ? keywordsFrom(q.skills) : [];

    // The pool gate, copied condition-for-condition from the candidate query in
    // lib/matching.ts. Dropping dormantAt/embedding here counted people the
    // engine would never surface, so the funnel promised a bigger pool than the
    // slate could ever draw from.
    const conditions: string[] = [
      `p."publishedAt" is not null`,
      `p.visibility = true`,
      `p."dormantAt" is null`,
      `p.embedding is not null`,
      `u.status = 'active'`,
      // Both became real pool filters when openToOffers stopped being a mere
      // rotation nudge and "booked" stopped depending on the Stage 0 flag.
      // Omitting them here would put people in the funnel number that the
      // engine can no longer return.
      `p."openToOffers" = true`,
      `p.availability <> 'booked'`,
    ];

    if (q.budgetMax && q.budgetMax > 0) {
      // A candidate whose rate is above the ceiling cannot fit. Null rate stays
      // in — unstated is not disqualifying at the funnel stage.
      conditions.push(`(p."rateUsd" is null or p."rateUsd" <= ${Number(q.budgetMax)})`);
    }

    // hoursPerWeek deliberately does NOT narrow the count.
    //
    // The engine stopped gating on capacity when jdHardRequirements dropped its
    // hoursPerWeekMin derivation: `committedHours` defaults to 0 and is guessed
    // from resumes, so a hard floor eliminated most of the pool on a routine
    // 40h brief. This query kept the gate after the engine dropped it, which
    // meant the public funnel reported roughly nobody for exactly the briefs
    // employers most often write — the opposite error, on the number the whole
    // pre-signup funnel is sold on. Hours still shape the RANKING through
    // scoreOverlap; they no longer decide who exists.

    let joinFilter = "";
    if (words.length > 0) {
      // Skill rows only. Headline and summary are embedded, not LIKE-matched —
      // reaching them would need the vector path this function exists to avoid.
      const likeList = words
        .map((w) => `'%' || ${escapeLiteral(w)} || '%'`)
        .join(", ");
      joinFilter = `
        and exists (
          select 1 from "Skill" s
          where s."profileId" = p.id
            and lower(s."normalizedName") like any (array[${likeList}])
        )`;
    }

    const rows = await db.$queryRawUnsafe<{ n: number }[]>(
      `select count(*)::int as n
         from "TalentProfile" p
         join "user" u on u.id = p."userId"
        where ${conditions.join(" and ")}${joinFilter}`,
    );
    return rows[0]?.n ?? 0;
  } catch (e) {
    // The count is a nice-to-have on a marketing page — never 500 the funnel
    // over it. The caller decides how to show "we're still counting".
    //
    // But it MUST be logged. A silent 0 is indistinguishable from "nobody in
    // the pool matches", and this is the number the entire pre-signup employer
    // funnel is sold on — a broken query would have read as an empty market.
    console.error("[prospect-count] query failed, reporting 0", e);
    return 0;
  }
}

// Minimal single-quote escape for values interpolated into a raw query. The
// keyword set is already restricted to [a-z0-9+#.] by keywordsFrom, so this is
// belt-and-braces rather than the only guard.
function escapeLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

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
  hoursPerWeek?: number | null;
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

    // Base: published, visible, from an active account. Same gate the real
    // matching pool uses.
    const conditions: string[] = [
      `p."publishedAt" is not null`,
      `p.visibility = true`,
      `u.status = 'active'`,
    ];

    if (q.budgetMax && q.budgetMax > 0) {
      // A candidate whose rate is above the ceiling cannot fit. Null rate stays
      // in — unstated is not disqualifying at the funnel stage.
      conditions.push(`(p."rateUsd" is null or p."rateUsd" <= ${Number(q.budgetMax)})`);
    }

    let joinFilter = "";
    if (words.length > 0) {
      // Match on a confirmed/known skill OR a word appearing in headline/summary.
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
  } catch {
    // The count is a nice-to-have on a marketing page — never 500 the funnel
    // over it. The caller decides how to show "we're still counting".
    return 0;
  }
}

// Minimal single-quote escape for values interpolated into a raw query. The
// keyword set is already restricted to [a-z0-9+#.] by keywordsFrom, so this is
// belt-and-braces rather than the only guard.
function escapeLiteral(value: string): string {
  return `'${value.replace(/'/g, "''")}'`;
}

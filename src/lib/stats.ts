import "server-only";
import { db } from "./db";

export type PublicStats = {
  /** Every talent profile on record. Not the same as the matchable pool. */
  profiles: number;
  /** Profiles matching can actually see: published and visible. */
  matchable: number;
  avgYears: number;
  medianRateUsd: number;
};

type Row = {
  profiles: number;
  matchable: number;
  avg_years: number | null;
  median_rate: number | null;
};

/**
 * Homepage figures, read from the database rather than typed into the markup.
 *
 * Returns null if the query fails so an unreachable database hides the stat
 * block instead of failing the build or, worse, falling back to stale numbers
 * that would quietly become false.
 */
export async function getPublicStats(): Promise<PublicStats | null> {
  try {
    const rows = await db.$queryRaw<Row[]>`
      select
        (select count(*)::int from "TalentProfile") as profiles,
        (select count(*)::int from "TalentProfile"
           where "publishedAt" is not null and visibility = true) as matchable,
        (select avg("yearsExperience")::float8 from "TalentProfile") as avg_years,
        (select (percentile_cont(0.5) within group (order by "rateUsd"))::float8
           from "TalentProfile" where "rateUsd" is not null) as median_rate
    `;

    const row = rows[0];
    if (!row) return null;

    return {
      profiles: row.profiles,
      matchable: row.matchable,
      avgYears: Math.round((row.avg_years ?? 0) * 10) / 10,
      medianRateUsd: Math.round(row.median_rate ?? 0),
    };
  } catch {
    return null;
  }
}

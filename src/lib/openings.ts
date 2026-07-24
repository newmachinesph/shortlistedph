import "server-only";
import { db } from "./db";
import { toPublicOpening, type OpeningRow, type PublicOpening } from "./openings-shape";

export type { PublicOpening };

/**
 * Public openings board queries (docs/redesign-plan.md §3). The mapper and the
 * listable shape live in openings-shape.ts (pure, tested); this file only adds
 * the db access. The `select` never names an employer field — the shape guard
 * plus this select are the two independent locks on the hidden-JD promise.
 */

const SELECT = {
  id: true,
  publicTitle: true,
  roleFamily: true,
  industry: true,
  clientRegion: true,
  budgetMin: true,
  budgetMax: true,
  hoursPerWeek: true,
  overlap: true,
  status: true,
  listedAt: true,
} satisfies Record<keyof OpeningRow, true>;

export type OpeningFilters = {
  roleFamily?: string;
  industry?: string;
  clientRegion?: string;
};

/** Listed openings, newest first, filtered by the URL's search params. */
export async function listOpenings(filters: OpeningFilters = {}): Promise<PublicOpening[]> {
  const rows = await db.jobDescription.findMany({
    where: {
      listedAt: { not: null },
      publicTitle: { not: null },
      ...(filters.roleFamily ? { roleFamily: filters.roleFamily } : {}),
      ...(filters.industry ? { industry: filters.industry } : {}),
      ...(filters.clientRegion ? { clientRegion: filters.clientRegion } : {}),
    },
    select: SELECT,
    orderBy: { listedAt: "desc" },
    take: 100,
  });
  return rows.map(toPublicOpening).filter((o): o is PublicOpening => o !== null);
}

/** One opening by id, or null if it is not listable. */
export async function getOpening(id: string): Promise<PublicOpening | null> {
  const row = await db.jobDescription.findUnique({ where: { id }, select: SELECT });
  return row ? toPublicOpening(row) : null;
}

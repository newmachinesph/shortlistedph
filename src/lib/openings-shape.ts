/**
 * The public shape of an opening and the single mapper that produces it. Pure —
 * imports only the pure `rateBand` formatter, no db, no server-only — so the
 * leak test exercises the exact guard production uses without booting a server.
 *
 * The guard is this TYPE. `PublicOpening` contains only listable fields, and
 * `toPublicOpening` is the one door an internal JD row passes through. No page
 * can render an employer name, the raw title, must-haves, or the exact budget,
 * because the shape it receives has no such field. See docs/redesign-plan.md §3.
 */
import { rateBand } from "./format.ts";
import { roleFamilyLabel } from "./openings-taxonomy.ts";

export type PublicOpening = {
  id: string;
  title: string; // the admin-approved publicTitle, never the raw employer title
  roleFamily: string | null;
  industry: string | null;
  clientRegion: string | null;
  /** Coarse band ("$8–12/hr"), never the exact ceiling. */
  rateBand: string | null;
  hoursPerWeek: number | null;
  overlap: string | null;
  isMatching: boolean;
  listedAt: Date;
};

/** The internal columns the mapper reads — never select employer fields into it. */
export type OpeningRow = {
  id: string;
  publicTitle: string | null;
  roleFamily: string | null;
  industry: string | null;
  clientRegion: string | null;
  budgetMin: number | null;
  budgetMax: number | null;
  hoursPerWeek: number | null;
  overlap: string | null;
  status: string;
  listedAt: Date | null;
};

/**
 * Pure. Returns null for a row that must not be listed — no approved public
 * title, or never stamped listed — so the board fails closed on the raw
 * employer `title`, which can contain a client name.
 */
export function toPublicOpening(row: OpeningRow): PublicOpening | null {
  if (!row.publicTitle || !row.listedAt) return null;
  return {
    id: row.id,
    title: row.publicTitle,
    roleFamily: row.roleFamily,
    industry: row.industry,
    clientRegion: row.clientRegion,
    rateBand: rateBand(row.budgetMin, row.budgetMax),
    hoursPerWeek: row.hoursPerWeek,
    overlap: row.overlap,
    isMatching: row.status === "matching" || row.status === "slate_ready",
    listedAt: row.listedAt,
  };
}

/**
 * The only role name a CANDIDATE may ever be shown — consent email, consent
 * page, invitations list. Same reasoning as the board above: the raw employer
 * `title` can name the client, so it is never a source here. An admin-approved
 * `publicTitle` wins; otherwise the controlled role-family label, which comes
 * from a fixed vocabulary and cannot carry an employer name.
 *
 * Unlike the board this cannot fail closed — the candidate was already invited
 * and has to be told *something* — so the last resort is a generic label that
 * is honest about how little it says.
 */
export function candidateRoleLabel(row: {
  publicTitle: string | null;
  roleFamily: string | null;
}): string {
  return row.publicTitle?.trim() || roleFamilyLabel(row.roleFamily) || "Remote role";
}

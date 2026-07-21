/**
 * Availability freshness + display helpers. Pure — no db, no server-only, so
 * both server components and the confirm control can share one definition of
 * "what does this availability read as, and is it still fresh".
 *
 * Availability is a LIVE signal (read off TalentProfile at view time), never
 * frozen into a snapshot — so these take the live fields, not a FrozenProfile.
 */

/** Three weeks. Past this, a confirmation is stale and worth re-prompting. */
export const STALE_DAYS = 21;

export type AvailabilityInput = {
  openToOffers: boolean;
  availability: string; // open | partial | booked
  noticePeriodDays: number | null;
  availabilityConfirmedAt: Date | string | null;
};

const STATUS_LABEL: Record<string, string> = {
  open: "Open",
  partial: "Partially committed",
  booked: "Fully booked",
};

function toDate(at: Date | string | null): Date | null {
  if (!at) return null;
  const d = at instanceof Date ? at : new Date(at);
  return Number.isNaN(d.getTime()) ? null : d;
}

function daysSince(at: Date, now: number): number {
  return Math.floor((now - at.getTime()) / 86_400_000);
}

/** True when a confirmation is missing or older than the stale window. */
export function isStale(
  confirmedAt: Date | string | null,
  days = STALE_DAYS,
  now = Date.now(),
): boolean {
  const d = toDate(confirmedAt);
  if (!d) return true;
  return daysSince(d, now) >= days;
}

/** "confirmed 3 days ago" / "not confirmed yet". */
export function freshnessNote(confirmedAt: Date | string | null, now = Date.now()): string {
  const d = toDate(confirmedAt);
  if (!d) return "not confirmed yet";
  const days = daysSince(d, now);
  if (days <= 0) return "confirmed today";
  if (days === 1) return "confirmed 1 day ago";
  if (days < 7) return `confirmed ${days} days ago`;
  const weeks = Math.floor(days / 7);
  if (weeks === 1) return "confirmed 1 week ago";
  return `confirmed ${weeks} weeks ago`;
}

function noticeLabel(days: number | null): string | null {
  if (days == null) return null;
  if (days <= 0) return "available now";
  if (days < 7) return days === 1 ? "~1-day notice" : `~${days}-day notice`;
  if (days < 28) {
    const w = Math.round(days / 7);
    return w <= 1 ? "~1-week notice" : `~${w}-week notice`;
  }
  const m = Math.round(days / 30);
  return m <= 1 ? "~1-month notice" : `~${m}-month notice`;
}

/**
 * Status + notice, no freshness — "Open · ~2-week notice". Always composes
 * (never a prompt), so the employer view can pair it with its own dated note.
 */
export function availabilityStatus(p: AvailabilityInput): string {
  if (!p.openToOffers) return "Not open to offers";
  const status = STATUS_LABEL[p.availability] ?? p.availability;
  const notice = noticeLabel(p.noticePeriodDays);
  return notice ? `${status} · ${notice}` : status;
}

/**
 * Talent-facing one-liner. Falls back to a call to action when nothing has been
 * confirmed or the confirmation has gone stale — "Confirm your availability".
 */
export function availabilityLabel(p: AvailabilityInput, now = Date.now()): string {
  if (isStale(p.availabilityConfirmedAt, STALE_DAYS, now)) return "Confirm your availability";
  return `${availabilityStatus(p)} · ${freshnessNote(p.availabilityConfirmedAt, now)}`;
}

/**
 * Non-identifying hint safe to show on a locked/masked slate row. Returns null
 * unless the candidate is fresh AND actually open — so a badge, when present,
 * reveals nothing beyond "someone here is available and recently said so".
 */
export function availabilityHint(p: AvailabilityInput, now = Date.now()): string | null {
  if (isStale(p.availabilityConfirmedAt, STALE_DAYS, now)) return null;
  if (!p.openToOffers || p.availability === "booked") return null;
  return "Available · confirmed recently";
}

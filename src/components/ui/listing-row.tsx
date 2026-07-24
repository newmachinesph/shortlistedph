import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Tag } from "./chip";

/**
 * The Workze-style dense listing row — used by the public openings board and
 * the homepage "live demand" strip. Presentational only: it takes explicit
 * props rather than a domain type, so it never depends on employer-derived data
 * and cannot leak a field the openings mapper is meant to drop.
 *
 * Deliberately no apply button. On this platform matching is automatic and
 * applying is not a thing — the row's action is a link to the anonymized
 * detail, and `note` carries the "your profile is matched automatically" line
 * that keeps the board from reading as a job board.
 */
export type ListingRowProps = {
  href: string;
  eyebrow?: string;
  title: string;
  /** e.g. "US retail client · Apparel" — never an employer name. */
  meta: string;
  /** e.g. "$7–10/hr · 40 h/wk · 6h US Eastern overlap". */
  facts?: string;
  blurb?: string;
  tags?: string[];
  /** "matching now" / "closed" state, shown as a dot + label. */
  status?: { label: string; live: boolean };
  /** The one-line "not an application" explainer. */
  note?: string;
};

export function ListingRow({
  href,
  eyebrow,
  title,
  meta,
  facts,
  blurb,
  tags,
  status,
  note,
}: ListingRowProps) {
  return (
    <Link
      href={href}
      className="group block border-b border-line py-6 transition-colors hover:bg-[var(--color-surface-sunk)]"
    >
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-2">
        <div className="min-w-0 flex-1 basis-72">
          <div className="flex items-center gap-3">
            {eyebrow && (
              <span className="text-xs font-medium uppercase tracking-[0.16em] text-ember">
                {eyebrow}
              </span>
            )}
            {status && (
              <span className="inline-flex items-center gap-1.5 text-xs text-ink-faint">
                <span
                  className={`h-1.5 w-1.5 rounded-full ${status.live ? "bg-brand" : "bg-ink-faint"}`}
                />
                {status.label}
              </span>
            )}
          </div>
          <h3 className="font-display mt-1.5 text-lg font-semibold tracking-tight text-ink group-hover:text-brand">
            {title}
          </h3>
          <p className="mt-1 text-sm text-ink-soft">{meta}</p>
          {blurb && <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-soft">{blurb}</p>}
        </div>
        <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-ink-faint transition-transform group-hover:translate-x-0.5 group-hover:text-brand" />
      </div>

      {facts && <p className="mt-3 text-sm font-medium text-ink">{facts}</p>}

      {(tags?.length || note) && (
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
          {tags?.length ? (
            <div className="flex flex-wrap gap-1.5">
              {tags.map((t) => (
                <Tag key={t}>{t}</Tag>
              ))}
            </div>
          ) : null}
          {note && <span className="text-xs text-ink-faint">{note}</span>}
        </div>
      )}
    </Link>
  );
}

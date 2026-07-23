import type { Metadata } from "next";
import Link from "next/link";
import { ListChecks, Loader, ShieldCheck } from "lucide-react";
import { NOINDEX } from "@/lib/site";
import { listSlates, listStuckJds, timeAgo } from "@/lib/admin";
import { ApproveSlateButton, StuckJdActions } from "./actions";

export const metadata: Metadata = { title: "Admin · Slates", ...NOINDEX };

const jdChip: Record<string, string> = {
  matching: "bg-ember-soft text-ember",
  rematching: "bg-brand-soft text-brand",
  failed: "bg-line text-ink-soft",
  no_matches: "bg-ember-soft text-ember",
};

const SLATE_STATUSES = ["pending_review", "preview", "unlocked"] as const;

const slateChip: Record<string, string> = {
  pending_review: "bg-ember-soft text-ember",
  preview: "bg-ember-soft text-ember",
  unlocked: "bg-brand-soft text-brand",
};

export default async function AdminSlates({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const filter = (SLATE_STATUSES as readonly string[]).includes(status ?? "")
    ? (status as (typeof SLATE_STATUSES)[number])
    : undefined;
  const [slates, pending, stuck] = await Promise.all([
    listSlates(filter),
    listSlates("pending_review"),
    listStuckJds(),
  ]);

  return (
    <>
      <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">Slates</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Every shortlist delivered, newest first. Unlocked means the employer paid.
      </p>

      {pending.length > 0 && (
        <section className="mt-7">
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-ink-faint">
            Awaiting approval
            <span className="ml-2 rounded-full bg-line px-2 py-0.5 text-[11px] font-medium normal-case tracking-normal text-ink-soft">
              {pending.length}
            </span>
          </h2>
          <div className="overflow-hidden rounded-2xl border border-line bg-white">
            {pending.map((s, i) => (
              <div
                key={s.id}
                className={`flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-4 sm:px-6 ${
                  i < pending.length - 1 ? "border-b border-line" : ""
                }`}
              >
                <ShieldCheck className="h-4 w-4 shrink-0 text-ink-faint" strokeWidth={1.75} />
                <div className="min-w-0 flex-1 basis-48">
                  <p className="truncate text-sm font-medium text-ink">{s.jd.title}</p>
                  <p className="truncate text-xs text-ink-faint">
                    {s.jd.employer.companyName} · {s._count.entries} candidate
                    {s._count.entries === 1 ? "" : "s"} · built {timeAgo(s.deliveredAt)}
                  </p>
                </div>
                <ApproveSlateButton slateId={s.id} />
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-ink-faint">
            The employer sees nothing until you approve. Approving releases the preview and sends
            the &ldquo;shortlist ready&rdquo; notification and email.
          </p>
        </section>
      )}

      {stuck.length > 0 && (
        <section className="mt-7">
          <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-ink-faint">
            Briefs needing attention
            <span className="ml-2 rounded-full bg-line px-2 py-0.5 text-[11px] font-medium normal-case tracking-normal text-ink-soft">
              {stuck.length}
            </span>
          </h2>
          <div className="overflow-hidden rounded-2xl border border-line bg-white">
            {stuck.map((jd, i) => (
              <div
                key={jd.id}
                className={`flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-4 sm:px-6 ${
                  i < stuck.length - 1 ? "border-b border-line" : ""
                }`}
              >
                <Loader className="h-4 w-4 shrink-0 text-ink-faint" strokeWidth={1.75} />
                <div className="min-w-0 flex-1 basis-48">
                  <p className="truncate text-sm font-medium text-ink">{jd.title}</p>
                  <p className="truncate text-xs text-ink-faint">
                    {jd.employer.companyName} · published{" "}
                    {timeAgo(jd.publishedAt ?? jd.createdAt)}
                  </p>
                </div>
                <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ${
                      jdChip[jd.status] ?? jdChip.matching
                    }`}
                  >
                    {jd.status.replace(/_/g, " ")}
                  </span>
                  <StuckJdActions jdId={jd.id} status={jd.status} />
                </div>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-ink-faint">
            Matching runs inside the publish request. A brief still matching means that request never
            finished — re-run it, or mark it failed so the employer stops waiting. &ldquo;No
            matches&rdquo; means the run finished with nobody above the bar: tune the must-haves,
            then re-run.
          </p>
        </section>
      )}

      <div className="mt-7 flex flex-wrap gap-2">
        <Link
          href="/admin/slates"
          className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
            !filter ? "bg-brand text-white" : "bg-white text-ink-soft ring-1 ring-inset ring-line hover:bg-paper"
          }`}
        >
          All
        </Link>
        {SLATE_STATUSES.map((s) => (
          <Link
            key={s}
            href={`/admin/slates?status=${s}`}
            className={`rounded-full px-3 py-1 text-xs font-medium capitalize transition-colors ${
              filter === s ? "bg-brand text-white" : "bg-white text-ink-soft ring-1 ring-inset ring-line hover:bg-paper"
            }`}
          >
            {s.replace(/_/g, " ")}
          </Link>
        ))}
      </div>

      <div className="mt-3 overflow-hidden rounded-2xl border border-line bg-white">
        {slates.length === 0 ? (
          <div className="px-6 py-14 text-center">
            <ListChecks className="mx-auto h-8 w-8 text-ink-faint" strokeWidth={1.75} />
            <h2 className="font-display mt-4 text-lg font-semibold text-ink">
              {filter ? `No ${filter} slates` : "No slates yet"}
            </h2>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-ink-soft">
              {filter
                ? "Nothing with that status right now."
                : "Slates appear once a job description finishes matching."}
            </p>
          </div>
        ) : (
          slates.map((s, i) => (
            <div
              key={s.id}
              className={`flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-4 sm:px-6 ${
                i < slates.length - 1 ? "border-b border-line" : ""
              }`}
            >
              <div className="min-w-0 flex-1 basis-48">
                <p className="truncate text-sm font-medium text-ink">{s.jd.title}</p>
                <p className="truncate text-xs text-ink-faint">
                  {s.jd.employer.companyName} · {s._count.entries} candidate
                  {s._count.entries === 1 ? "" : "s"} · delivered{" "}
                  {s.deliveredAt.toLocaleDateString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                  })}
                  {s.unlockedAt
                    ? ` · unlocked ${s.unlockedAt.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
                    : ""}
                </p>
              </div>
              <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ${
                    slateChip[s.status] ?? slateChip.preview
                  }`}
                >
                  {s.status.replace(/_/g, " ")}
                </span>
                <Link
                  href={`/employer/briefs/${s.jd.id}`}
                  className="inline-flex min-h-11 items-center rounded-xl px-3 py-1.5 text-xs font-medium text-ink-soft ring-1 ring-inset ring-line transition-colors hover:bg-paper sm:min-h-0"
                >
                  Open
                </Link>
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );
}

import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, FileText, ShieldCheck } from "lucide-react";
import { NOINDEX } from "@/lib/site";
import { listReports, timeAgo } from "@/lib/admin";
import { ReportActions } from "./actions";

export const metadata: Metadata = { title: "Admin · Reports", ...NOINDEX };

const statusChip: Record<string, string> = {
  open: "bg-ember-soft text-ember",
  resolved: "bg-brand-soft text-brand",
  dismissed: "bg-line text-ink-soft",
};

const REPORT_STATUSES = ["open", "resolved", "dismissed"] as const;

export default async function AdminReports({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  // Open is the working queue; resolved and dismissed are the archive.
  const filter = (REPORT_STATUSES as readonly string[]).includes(status ?? "") ? status! : "open";
  const reports = await listReports(filter);

  return (
    <>
      <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">Reports</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Evidence in, judgment out. Bans bind to identity — banned users don&rsquo;t come back with a new email.
      </p>

      <div className="mt-6 flex flex-wrap gap-2">
        {REPORT_STATUSES.map((s) => (
          <Link
            key={s}
            href={s === "open" ? "/admin/reports" : `/admin/reports?status=${s}`}
            aria-current={filter === s ? "page" : undefined}
            className={`rounded-full px-3 py-1 text-xs font-medium capitalize transition-colors ${
              filter === s
                ? "bg-brand text-white"
                : "bg-white text-ink-soft ring-1 ring-inset ring-line hover:bg-paper"
            }`}
          >
            {s}
          </Link>
        ))}
      </div>

      {reports.length === 0 ? (
        <div className="mt-7 rounded-2xl border border-line bg-white px-6 py-14 text-center">
          <ShieldCheck className="mx-auto h-8 w-8 text-ink-faint" strokeWidth={1.75} />
          <h2 className="font-display mt-4 text-lg font-semibold text-ink">
            {filter === "open" ? "No open reports" : `No ${filter} reports`}
          </h2>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-ink-soft">
            {filter === "open"
              ? "Nobody has flagged anyone. When they do, it lands here with the evidence attached."
              : `Nothing has been ${filter} yet.`}
          </p>
        </div>
      ) : (
        <div className="mt-7 space-y-5">
          {reports.map((r) => (
            <div key={r.id} className="rounded-2xl border border-line bg-white p-4 sm:p-6">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${
                    r.status === "open" ? "bg-ember-soft text-ember" : "border border-line text-ink-soft"
                  }`}
                >
                  <AlertTriangle className="h-3 w-3" strokeWidth={1.75} /> {r.reason}
                </span>
                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                    statusChip[r.status] ?? statusChip.open
                  }`}
                >
                  {r.status}
                </span>
                <span className="min-w-0 break-all text-xs text-ink-faint">
                  {r.id} · filed {timeAgo(r.createdAt)}
                </span>
              </div>

              <p className="mt-3 text-sm text-ink-soft">
                <span className="font-medium text-ink">{r.filedBy.name}</span>{" "}
                <span className="text-xs text-ink-faint">({r.filedBy.role})</span>{" "}
                against{" "}
                <span className="font-medium text-ink">{r.against.name}</span>{" "}
                <span className="break-all text-xs text-ink-faint">
                  ({r.against.role} · {r.against.email} · {r.against.status})
                </span>
              </p>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">{r.detail}</p>

              {r.evidence.length > 0 && (
                <div className="mt-3">
                  <div className="flex flex-wrap gap-2">
                    {r.evidence.map((e, i) =>
                      e.url ? (
                        <a
                          key={e.key}
                          href={e.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-xs text-ink-soft transition-colors hover:border-brand hover:text-brand"
                        >
                          <FileText className="h-3 w-3" strokeWidth={1.75} /> Evidence {i + 1}
                        </a>
                      ) : (
                        <span
                          key={e.key}
                          title={e.key}
                          className="inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-xs text-ink-faint"
                        >
                          <FileText className="h-3 w-3" strokeWidth={1.75} /> Unavailable
                        </span>
                      ),
                    )}
                  </div>
                  <p className="mt-2 text-xs text-ink-faint">
                    Links are signed for this page load and expire in ten minutes.
                  </p>
                </div>
              )}

              {r.status === "open" ? (
                <ReportActions
                  reportId={r.id}
                  targetName={r.against.name}
                  targetStatus={r.against.status}
                />
              ) : (
                <div className="mt-4 border-t border-line pt-4">
                  <p className="text-xs text-ink-faint">Resolution</p>
                  <p className="mt-1 text-sm text-ink-soft">{r.resolution ?? "No note recorded."}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

import type { Metadata } from "next";
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

export default async function AdminReports() {
  const reports = await listReports();

  return (
    <>
      <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">Reports</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Evidence in, judgment out. Bans bind to identity — banned users don&rsquo;t come back with a new email.
      </p>

      {reports.length === 0 ? (
        <div className="mt-7 rounded-2xl border border-line bg-white px-6 py-14 text-center">
          <ShieldCheck className="mx-auto h-8 w-8 text-ink-faint" strokeWidth={1.75} />
          <h2 className="font-display mt-4 text-lg font-semibold text-ink">No reports filed</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-ink-soft">
            Nobody has flagged anyone. When they do, it lands here with the evidence attached.
          </p>
        </div>
      ) : (
        <div className="mt-7 space-y-5">
          {reports.map((r) => (
            <div key={r.id} className="rounded-2xl border border-line bg-white p-6">
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
                <span className="text-xs text-ink-faint">
                  {r.id} · filed {timeAgo(r.createdAt)}
                </span>
              </div>

              <p className="mt-3 text-sm text-ink-soft">
                <span className="font-medium text-ink">
                  {r.filedBy.role} · {r.filedBy.name}
                </span>{" "}
                against{" "}
                <span className="font-medium text-ink">
                  {r.against.role} · {r.against.name}
                </span>{" "}
                <span className="text-xs text-ink-faint">({r.against.email} · {r.against.status})</span>
              </p>
              <p className="mt-2 text-sm leading-relaxed text-ink-soft">{r.detail}</p>

              {r.evidenceKeys.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {r.evidenceKeys.map((key) => (
                    <span
                      key={key}
                      className="inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-xs text-ink-soft"
                    >
                      <FileText className="h-3 w-3" strokeWidth={1.75} /> {key}
                    </span>
                  ))}
                </div>
              )}

              {r.status === "open" ? (
                <ReportActions reportId={r.id} />
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

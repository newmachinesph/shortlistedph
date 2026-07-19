import type { Metadata } from "next";
import { NOINDEX } from "@/lib/site";

export const metadata: Metadata = { title: "Admin · Reports", ...NOINDEX };

import { AlertTriangle, FileText } from "lucide-react";

type Report = {
  id: string;
  filedBy: string;
  against: string;
  reason: string;
  detail: string;
  evidence: string[];
  when: string;
  severity: "high" | "medium";
};

const reports: Report[] = [
  {
    id: "rpt-014",
    filedBy: "Talent · Rowena Lim",
    against: "Employer account 'BrightStaff Solutions'",
    reason: "Asked for money",
    detail:
      "Claims the employer moved the conversation to Messenger and asked for a ₱2,500 'training materials fee' before starting. Screenshots attached. Account has no confirmed hires and a domain registered 12 days ago.",
    evidence: ["messenger-screenshots.pdf", "conversation export"],
    when: "5h ago",
    severity: "high",
  },
  {
    id: "rpt-013",
    filedBy: "Employer · Ledgerline",
    against: "Talent profile (name withheld pending review)",
    reason: "Fabricated experience",
    detail:
      "Employer reports the candidate's claimed 4-year engagement failed a reference check — the named company says they never worked there. Claim was self-reported (not outcome-confirmed), so slate ranking impact was already limited.",
    evidence: ["reference-check notes"],
    when: "Jul 17",
    severity: "medium",
  },
];

export default function AdminReports() {
  return (
    <>
      <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">Reports</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Evidence in, judgment out. Bans bind to identity — banned users don&rsquo;t come back with a new email.
      </p>

      <div className="mt-7 space-y-5">
        {reports.map((r) => (
          <div key={r.id} className="rounded-2xl border border-line bg-white p-6">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${
                  r.severity === "high" ? "bg-ember-soft text-ember" : "border border-line text-ink-soft"
                }`}
              >
                <AlertTriangle className="h-3 w-3" /> {r.reason}
              </span>
              <span className="text-xs text-ink-faint">{r.id} · filed {r.when}</span>
            </div>
            <p className="mt-3 text-sm text-ink-soft">
              <span className="font-medium text-ink">{r.filedBy}</span> against{" "}
              <span className="font-medium text-ink">{r.against}</span>
            </p>
            <p className="mt-2 text-sm leading-relaxed text-ink-soft">{r.detail}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {r.evidence.map((e) => (
                <span key={e} className="inline-flex items-center gap-1.5 rounded-full border border-line px-2.5 py-1 text-xs text-ink-soft">
                  <FileText className="h-3 w-3" /> {e}
                </span>
              ))}
            </div>
            <div className="mt-4 flex flex-wrap gap-3 border-t border-line pt-4">
              <button className="rounded-xl bg-ember px-4 py-2 text-sm font-medium text-white transition-colors hover:opacity-90">
                Ban permanently
              </button>
              <button className="rounded-xl px-4 py-2 text-sm font-medium text-brand ring-1 ring-inset ring-brand/30 transition-colors hover:bg-brand-soft">
                Request more evidence
              </button>
              <button className="rounded-xl px-4 py-2 text-sm font-medium text-ink-soft ring-1 ring-inset ring-line transition-colors hover:bg-paper">
                Dismiss
              </button>
              <span className="ml-auto self-center text-xs text-ink-faint">
                Records preserved for lawful requests
              </span>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

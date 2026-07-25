import type { Metadata } from "next";
import Link from "next/link";
import { NOINDEX } from "@/lib/site";
import { CREDIT_KINDS, getCreditReconciliation, requireAdminPage } from "@/lib/admin";

export const metadata: Metadata = { title: "Admin · Credits", ...NOINDEX };

const KIND_LABEL: Record<string, string> = {
  credit: "Shortlist credits",
  interview_credit: "Interview credits",
};

const COLUMNS: [key: "sold" | "granted" | "spent" | "revoked" | "available" | "balance", label: string][] = [
  ["sold", "Sold"],
  ["granted", "Granted"],
  ["spent", "Spent"],
  ["revoked", "Revoked"],
  ["available", "Entitlements left"],
  ["balance", "Balance"],
];

export default async function AdminCredits() {
  await requireAdminPage();
  const { rows, totals, drifting } = await getCreditReconciliation();

  return (
    <>
      <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">Credits</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Every credit is both a counter on the employer and a row in the ledger. They are supposed
        to agree: unspent, unrevoked entitlements should equal the balance. Where they don&rsquo;t,
        money moved without leaving a trace.
      </p>

      {drifting > 0 && (
        <p className="mt-4 rounded-2xl border border-ember/30 bg-ember-soft px-4 py-3 text-sm text-ember sm:px-6">
          {drifting} balance{drifting === 1 ? "" : "s"} disagree with the ledger. A positive drift
          means unspent entitlements nobody can spend; negative means a balance backed by nothing.
        </p>
      )}

      {CREDIT_KINDS.map((kind) => {
        const of = rows.filter((r) => r.kind === kind);
        const total = totals[kind];
        return (
          <section key={kind} className="mt-8">
            <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-ink-faint">
              {KIND_LABEL[kind] ?? kind}
              <span className="ml-2 rounded-full bg-line px-2 py-0.5 text-[11px] font-medium normal-case tracking-normal text-ink-soft">
                {of.length}
              </span>
            </h2>
            <div className="overflow-hidden rounded-2xl border border-line bg-white">
              {of.length === 0 ? (
                <p className="px-6 py-8 text-center text-sm text-ink-soft">
                  No employer holds credits of this kind yet.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[46rem] text-sm">
                    <thead>
                      <tr className="border-b border-line text-xs uppercase tracking-wider text-ink-faint">
                        <th className="px-6 py-3 text-left font-medium">Employer</th>
                        {COLUMNS.map(([key, label]) => (
                          <th key={key} className="px-3 py-3 text-right font-medium">
                            {label}
                          </th>
                        ))}
                        <th className="px-6 py-3 text-right font-medium">Drift</th>
                      </tr>
                    </thead>
                    <tbody>
                      {of.map((r) => (
                        <tr key={r.key} className="border-t border-line">
                          <td className="px-6 py-3">
                            <Link
                              href={`/admin/users?q=${encodeURIComponent(r.company)}`}
                              className="text-sm font-medium text-ink hover:text-brand"
                            >
                              {r.company}
                            </Link>
                          </td>
                          {COLUMNS.map(([key]) => (
                            <td key={key} className="px-3 py-3 text-right text-ink-soft">
                              {r[key]}
                            </td>
                          ))}
                          <td className="px-6 py-3 text-right">
                            {r.drift === 0 ? (
                              <span className="text-xs text-ink-faint">—</span>
                            ) : (
                              <span className="rounded-full bg-ember-soft px-2.5 py-1 text-[11px] font-medium text-ember">
                                {r.drift > 0 ? `+${r.drift}` : r.drift}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                      <tr className="border-t-2 border-line bg-paper">
                        <td className="px-6 py-3 text-sm font-medium text-ink">All employers</td>
                        {COLUMNS.map(([key]) => (
                          <td key={key} className="px-3 py-3 text-right font-medium text-ink">
                            {total[key]}
                          </td>
                        ))}
                        <td className="px-6 py-3 text-right font-medium text-ink">
                          {total.available - total.balance || "—"}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        );
      })}

      <p className="mt-4 text-xs leading-relaxed text-ink-faint">
        Sold = bought through a provider. Granted = laid down by an admin adjustment. Spent = tied
        to a slate unlock or an interview. Revoked = clawed back by a refund or deduction and never
        spendable again. Balance is the counter the app actually spends against.
      </p>
    </>
  );
}

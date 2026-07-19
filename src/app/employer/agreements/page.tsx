import { ArrowLeftRight, Download } from "lucide-react";

export default function EmployerAgreementsPage() {
  return (
    <>
      <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">Agreements</h1>
      <p className="mt-1 text-sm text-ink-soft">
        E-signed engagement terms between you and the talent you&rsquo;ve connected with. shortlisted.ph never touches salary.
      </p>

      <div className="mt-7 rounded-2xl border border-line bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="font-display flex h-10 w-10 items-center justify-center rounded-xl bg-brand-soft font-semibold text-brand">
              HD
            </span>
            <ArrowLeftRight className="h-4 w-4 shrink-0 text-ink-faint" />
            <span className="font-display flex h-10 w-10 items-center justify-center rounded-xl bg-brand-soft font-semibold text-brand">
              KB
            </span>
            <div>
              <h2 className="font-medium text-ink">Medical VA — full-time</h2>
              <p className="text-sm text-ink-soft">Harbor Dental Group & Kristine Bautista</p>
            </div>
          </div>
          <span className="rounded-full bg-brand-soft px-2.5 py-1 text-[11px] font-medium text-brand">
            Active
          </span>
        </div>

        <div className="mt-5 rounded-xl bg-paper p-4 text-sm text-ink-soft">
          $9/hr · 40h/wk · starts Aug 3, 2026
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <p className="text-xs text-ink-faint">E-signed by both parties · Jul 18, 2026</p>
          <button className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium text-brand ring-1 ring-inset ring-brand/30 transition-colors hover:bg-brand-soft">
            <Download className="h-4 w-4" /> Download PDF
          </button>
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-line bg-brand-soft/50 p-6">
        <h3 className="font-medium text-ink">How outcome confirmation works</h3>
        <p className="mt-2 text-sm leading-relaxed text-ink-soft">
          Each month, both of you confirm whether the engagement is &ldquo;paid&rdquo; and &ldquo;delivered.&rdquo; Two matching confirmations build the payment-verified history employers and talent both rely on.
        </p>
        <p className="mt-2 text-xs text-ink-faint">First confirmation due Sep 1, 2026.</p>
      </div>

      <h2 className="mt-9 mb-3 text-sm font-medium uppercase tracking-wider text-ink-faint">
        Past agreements
      </h2>
      <div className="rounded-2xl border border-line bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="font-display flex h-10 w-10 items-center justify-center rounded-xl bg-paper font-semibold text-ink-faint">
              JD
            </span>
            <div>
              <h3 className="font-medium text-ink">Bookkeeper, part-time</h3>
              <p className="text-sm text-ink-soft">Jerome Dela Cruz · Mar – Jun 2026</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-brand-soft px-2.5 py-1 text-[11px] font-medium text-brand">
              4/4 outcomes confirmed
            </span>
            <span className="rounded-full border border-line px-2.5 py-1 text-[11px] text-ink-faint">
              Completed
            </span>
          </div>
        </div>
      </div>

      <p className="mt-8 text-xs text-ink-faint">
        shortlisted.ph never processes salary or payroll — you pay Kristine and Jerome directly. We only ever charge for the shortlist.
      </p>
    </>
  );
}

import { Calculator, Download, Eye, FileText, Lock } from "lucide-react";

export default function TalentLegalPage() {
  return (
    <>
      <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">Legal</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Your contracts, who&rsquo;s seen your profile, and where your documents live (hint: not here).
      </p>

      <section className="mt-7 rounded-2xl border border-line bg-white p-6">
        <h2 className="flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-ink-faint">
          <FileText className="h-4 w-4" /> My contracts
        </h2>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-paper p-4">
          <div>
            <p className="font-medium text-ink">Harbor Dental Group — Medical VA agreement</p>
            <p className="text-sm text-ink-soft">E-signed Jul 18, 2026</p>
          </div>
          <button className="inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-medium text-brand ring-1 ring-inset ring-brand/30 transition-colors hover:bg-brand-soft">
            <Download className="h-4 w-4" /> Download
          </button>
        </div>
      </section>

      <section className="mt-5 rounded-2xl border border-line bg-white p-6">
        <h2 className="flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-ink-faint">
          <Eye className="h-4 w-4" /> Who saw my profile
        </h2>
        <ul className="mt-4 space-y-3.5 text-sm">
          <li className="flex items-start justify-between gap-3">
            <span className="text-ink-soft">Harbor Dental Group viewed your full snapshot</span>
            <span className="shrink-0 text-xs text-ink-faint">Jul 16, 2026 — after you consented</span>
          </li>
          <li className="flex items-start justify-between gap-3">
            <span className="text-ink-soft">Your anonymized preview appeared in 2 locked slates</span>
            <span className="shrink-0 text-xs text-ink-faint">Jul 2026 — names blurred, contact hidden</span>
          </li>
        </ul>
        <p className="mt-4 text-xs leading-relaxed text-ink-faint">
          Under the Data Privacy Act, you can request every record of how your
          data has been accessed or shared.
        </p>
        <button className="mt-4 rounded-xl px-4 py-2 text-sm font-medium text-brand ring-1 ring-inset ring-brand/30 transition-colors hover:bg-brand-soft">
          Download my data
        </button>
      </section>

      <section className="mt-5 rounded-2xl border border-line bg-white p-6">
        <h2 className="flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-ink-faint">
          <Lock className="h-4 w-4" /> Your documents
        </h2>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-ink-soft">
          Your ID and NBI clearance are never uploaded to shortlisted.ph. When
          you&rsquo;re hired, you present them directly to your employer — your
          documents, your choice.
        </p>
      </section>

      <section className="mt-5 rounded-2xl border border-line bg-white p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 className="flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-ink-faint">
            <Calculator className="h-4 w-4" /> Tax helper
          </h2>
          <span className="rounded-full border border-line px-2.5 py-1 text-xs text-ink-soft">guide</span>
        </div>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-ink-soft">
          A plain-language guide to BIR registration for freelancers, plus a
          quarterly tax estimator so you know what to set aside from every
          payout.
        </p>
      </section>
    </>
  );
}

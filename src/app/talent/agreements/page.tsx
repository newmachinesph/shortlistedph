import { Building2, CheckCircle2, FileSignature } from "lucide-react";

export default function TalentAgreementsPage() {
  return (
    <>
      <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">Agreements</h1>
      <p className="mt-1 text-sm text-ink-soft">
        Signed, active, and past terms — your pay is agreed here, not negotiated in chat.
      </p>

      <section className="mt-7 rounded-2xl border border-line bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="font-display flex h-11 w-11 items-center justify-center rounded-xl bg-brand-soft font-semibold text-brand">
              HD
            </span>
            <div>
              <h2 className="font-medium text-ink">Harbor Dental Group</h2>
              <p className="text-sm text-ink-soft">Medical VA · $9/hr · 40h/week</p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-brand-soft px-2.5 py-1 text-xs font-medium text-brand">
            <CheckCircle2 className="h-3.5 w-3.5" /> Active
          </span>
        </div>
        <div className="mt-5 grid gap-3 rounded-xl bg-paper p-4 text-sm text-ink-soft sm:grid-cols-2">
          <p>
            Starts <span className="font-medium text-ink">August 3, 2026</span>
          </p>
          <p>
            E-signed by both parties <span className="font-medium text-ink">Jul 18, 2026</span>
          </p>
        </div>
        <button className="mt-5 rounded-xl px-4 py-2 text-sm font-medium text-brand ring-1 ring-inset ring-brand/30 transition-colors hover:bg-brand-soft">
          Download PDF
        </button>
      </section>

      <section className="mt-5 rounded-2xl border border-line bg-white p-6">
        <h2 className="flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-ink-faint">
          <FileSignature className="h-4 w-4" /> How outcomes get confirmed
        </h2>
        <p className="mt-3 max-w-2xl text-sm leading-relaxed text-ink-soft">
          Once a month, you and Harbor Dental Group both confirm the work was
          delivered and paid. Each matching confirmation adds one
          payment-verified engagement to your profile — proof employers can
          see, not just a claim.
        </p>
        <p className="mt-3 text-xs text-ink-faint">First confirmation window opens Sep 1, 2026.</p>
      </section>

      <h2 className="mt-9 mb-3 text-sm font-medium uppercase tracking-wider text-ink-faint">
        Past agreements
      </h2>
      <section className="rounded-2xl border border-line bg-white p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-paper">
              <Building2 className="h-5 w-5 text-ink-faint" />
            </span>
            <div>
              <h3 className="font-medium text-ink">US medspa chain</h3>
              <p className="text-sm text-ink-soft">EA / front-desk support · 2023 – 2025 · Completed</p>
            </div>
          </div>
          <span className="rounded-full bg-brand-soft px-2.5 py-1 text-xs font-medium text-brand">
            24/24 outcomes confirmed · payment-verified
          </span>
        </div>
      </section>

      <p className="mt-5 text-xs leading-relaxed text-ink-faint">
        Your salary is paid directly to you by your employer. shortlisted.ph
        never holds or takes a cut of your pay.
      </p>
    </>
  );
}

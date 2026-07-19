import { Copy, Gift, Smartphone, Wallet } from "lucide-react";

export default function TalentPayoutsPage() {
  return (
    <>
      <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">Referral earnings</h1>
      <p className="mt-1 text-sm text-ink-soft">
        The only money that moves through shortlisted.ph — and it flows to you.
      </p>

      <section className="mt-7 rounded-2xl border border-line bg-white p-6">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand-soft">
            <Gift className="h-5 w-5 text-brand" />
          </span>
          <p className="max-w-xl text-sm leading-relaxed text-ink-soft">
            Refer an employer who hasn&rsquo;t used shortlisted.ph before. When
            they buy their first shortlist, you earn 20% of that purchase —
            paid to you, no cap.
          </p>
        </div>
      </section>

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <section className="rounded-2xl border border-line bg-white p-6">
          <h2 className="text-sm font-medium uppercase tracking-wider text-ink-faint">Balance</h2>
          <p className="font-display mt-3 text-3xl font-semibold text-ink">₱0.00</p>
          <p className="mt-1 text-sm text-ink-soft">available</p>
          <div className="mt-4 flex items-center justify-between gap-3 rounded-xl bg-paper p-3.5">
            <div>
              <p className="text-sm font-medium text-ink">₱276 pending</p>
              <p className="mt-0.5 text-xs text-ink-faint">
                Dental practice owner you referred signed up Jul 14 — hasn&rsquo;t purchased yet.
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-ember-soft px-2.5 py-1 text-[11px] font-medium text-ember">
              Pending
            </span>
          </div>
        </section>

        <section className="rounded-2xl border border-line bg-white p-6">
          <h2 className="flex items-center gap-2 text-sm font-medium uppercase tracking-wider text-ink-faint">
            <Smartphone className="h-4 w-4" /> Payout method
          </h2>
          <div className="mt-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-paper">
                <Wallet className="h-4 w-4 text-ink-faint" />
              </span>
              <span className="text-sm font-medium text-ink">GCash ····4821</span>
            </div>
            <button className="text-sm font-medium text-brand hover:underline">Change</button>
          </div>
          <p className="mt-4 text-xs text-ink-faint">Minimum payout ₱500</p>
        </section>
      </div>

      <section className="mt-5 rounded-2xl border border-line bg-white p-6">
        <h2 className="text-sm font-medium uppercase tracking-wider text-ink-faint">History</h2>
        <div className="mt-6 flex flex-col items-center py-6 text-center">
          <p className="text-sm text-ink-soft">No payouts yet — share your link</p>
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-line bg-paper px-4 py-2.5">
            <span className="text-sm text-ink">shortlisted.ph/r/kristine-b</span>
            <Copy className="h-3.5 w-3.5 text-ink-faint" />
          </div>
        </div>
      </section>

      <p className="mt-5 text-center text-xs font-medium text-ink-faint">
        Talent never pays shortlisted.ph anything. Ever.
      </p>
    </>
  );
}

import { Receipt } from "lucide-react";

const plans = [
  { name: "Single unlock", price: "$49", note: "one shortlist", cta: "Buy credit", popular: false },
  { name: "Three-pack", price: "$119", note: "three shortlists", cta: "Buy credits", popular: true },
  { name: "Hiring desk", price: "$249/mo", note: "unlimited shortlists", cta: "Subscribe", popular: false },
];

const invoices = [
  { date: "Jul 18", desc: "Unlock — Medical VA slate", amount: "$49", status: "Paid" },
  { date: "Jul 12", desc: "Three-pack", amount: "$119", status: "Paid" },
];

export default function EmployerBillingPage() {
  return (
    <>
      <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">Billing</h1>
      <p className="mt-1 text-sm text-ink-soft">
        You only ever pay shortlisted.ph for shortlists — never a cut of what you pay talent.
      </p>

      <div className="mt-7 rounded-2xl border border-line bg-white p-6">
        <p className="text-sm text-ink-faint">Balance</p>
        <p className="font-display mt-1 text-3xl font-semibold text-ink">2 shortlist credits</p>
        <p className="mt-1 text-sm text-ink-soft">Never expire.</p>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-3">
        {plans.map((p) => (
          <div key={p.name} className="relative rounded-2xl border border-line bg-white p-5">
            {p.popular && (
              <span className="absolute -top-2.5 right-5 rounded-full bg-ember-soft px-2.5 py-0.5 text-[11px] font-medium text-ember">
                Popular
              </span>
            )}
            <p className="text-sm font-medium text-ink">{p.name}</p>
            <p className="font-display mt-1.5 text-2xl font-semibold text-ink">{p.price}</p>
            <p className="mt-0.5 text-xs text-ink-faint">{p.note}</p>
            <button
              className={
                p.popular
                  ? "mt-4 w-full rounded-xl bg-brand px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-brand-dark"
                  : "mt-4 w-full rounded-xl px-4 py-2.5 text-sm font-medium text-brand ring-1 ring-inset ring-brand/30 transition-colors hover:bg-brand-soft"
              }
            >
              {p.cta}
            </button>
          </div>
        ))}
      </div>

      <h2 className="mt-9 mb-3 text-sm font-medium uppercase tracking-wider text-ink-faint">
        Invoice history
      </h2>
      <div className="rounded-2xl border border-line bg-white">
        {invoices.map((inv, i) => (
          <div
            key={inv.date + inv.desc}
            className={`flex flex-wrap items-center justify-between gap-3 px-6 py-4 ${
              i < invoices.length - 1 ? "border-b border-line" : ""
            }`}
          >
            <div>
              <p className="text-sm font-medium text-ink">{inv.desc}</p>
              <p className="text-xs text-ink-faint">
                {inv.date} · {inv.amount}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-brand-soft px-2.5 py-1 text-[11px] font-medium text-brand">
                {inv.status}
              </span>
              <button className="inline-flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-sm font-medium text-brand ring-1 ring-inset ring-brand/30 transition-colors hover:bg-brand-soft">
                <Receipt className="h-3.5 w-3.5" /> Receipt
              </button>
            </div>
          </div>
        ))}
      </div>

      <p className="mt-8 text-xs text-ink-faint">
        You pay for shortlists only — never a percentage of salary.
      </p>
    </>
  );
}

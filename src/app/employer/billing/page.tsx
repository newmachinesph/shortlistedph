import { db } from "@/lib/db";
import { employerOrOnboard, requirePageUser } from "@/lib/queries";
import { PRODUCTS } from "@/lib/payments";
import { BuyButton } from "./buy-button";
import { CaptureOnReturn } from "./capture-on-return";

const symbol = (currency: string) => (currency === "USD" ? "$" : "₱");

export default async function BillingPage({
  searchParams,
}: {
  searchParams: Promise<{ paid?: string; cancelled?: string }>;
}) {
  const { paid, cancelled } = await searchParams;
  const user = await requirePageUser("employer");
  const employer = await employerOrOnboard(user.id);

  const payments = await db.payment.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    take: 20,
  });

  // Per currency, never one number: dollars and pesos were being added together
  // and printed with a "$" in front, so a ₱60 verification read as $60 of spend.
  const spent = new Map<string, number>();
  for (const p of payments.filter((p) => p.status === "paid")) {
    spent.set(p.currency, (spent.get(p.currency) ?? 0) + Number(p.amount));
  }

  return (
    <>
      <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">Billing</h1>
      <p className="mt-1 text-sm text-ink-soft">
        You pay for shortlists only — never a percentage of anyone&rsquo;s salary.
      </p>

      <div className="mt-7">
        <CaptureOnReturn shouldCapture={paid === "1"} />
      </div>

      {cancelled === "1" && (
        <div className="mb-5 rounded-2xl bg-paper px-5 py-4 text-sm text-ink-soft">
          Checkout cancelled — nothing was charged.
        </div>
      )}

      <div className="rounded-2xl border border-line bg-white p-6">
        <p className="text-xs text-ink-faint">Shortlist credits</p>
        <p className="font-display mt-1.5 text-4xl font-semibold text-brand">{employer.credits}</p>
        <p className="mt-1 text-sm text-ink-soft">
          {employer.credits === 0
            ? "Previewing a slate is always free — a credit unlocks names and connections."
            : "Credits never expire."}
        </p>
      </div>

      <h2 className="mt-8 mb-3 text-sm font-medium uppercase tracking-wider text-ink-faint">
        Buy credits
      </h2>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-line bg-white p-6">
          <h3 className="font-medium text-ink">{PRODUCTS.single.label}</h3>
          <p className="font-display mt-2 text-3xl font-semibold text-ink">
            ${PRODUCTS.single.amount}
          </p>
          <p className="mt-1 mb-5 text-sm text-ink-soft">1 credit</p>
          <BuyButton productId="single" label="Buy 1 credit" variant="ghost" />
        </div>
        <div className="rounded-2xl border-2 border-brand bg-white p-6">
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-ink">{PRODUCTS.three_pack.label}</h3>
            <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-medium text-brand">
              best value
            </span>
          </div>
          <p className="font-display mt-2 text-3xl font-semibold text-ink">
            ${PRODUCTS.three_pack.amount}
          </p>
          <p className="mt-1 mb-5 text-sm text-ink-soft">3 credits · $39.67 each</p>
          <BuyButton productId="three_pack" label="Buy 3 credits" />
        </div>
      </div>

      <h2 className="mt-8 mb-3 text-sm font-medium uppercase tracking-wider text-ink-faint">
        Payment history
      </h2>
      {payments.length === 0 ? (
        <div className="rounded-2xl border border-line bg-white p-8 text-center">
          <p className="text-sm text-ink-soft">No payments yet.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-line bg-white">
          {payments.map((p, i) => (
            <div
              key={p.id}
              className={`flex flex-wrap items-center justify-between gap-3 px-6 py-4 ${
                i < payments.length - 1 ? "border-b border-line" : ""
              }`}
            >
              <div>
                <p className="text-sm font-medium text-ink">
                  {PRODUCTS[p.purpose as keyof typeof PRODUCTS]?.label ?? p.purpose}
                </p>
                <p className="text-xs text-ink-faint">
                  {p.createdAt.toISOString().slice(0, 10)} · {p.provider}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-sm text-ink">
                  {symbol(p.currency)}
                  {p.amount.toFixed(2)}
                </span>
                <span
                  className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${
                    p.status === "paid"
                      ? "bg-brand-soft text-brand"
                      : p.status === "refunded"
                        ? "border border-line text-ink-faint"
                        : "bg-ember-soft text-ember"
                  }`}
                >
                  {p.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="mt-6 text-xs leading-relaxed text-ink-faint">
        Total spent:{" "}
        {spent.size === 0
          ? "$0.00"
          : [...spent.entries()]
              .map(([currency, amount]) => `${symbol(currency)}${amount.toFixed(2)}`)
              .join(" · ")}
        . shortlisted.ph never holds or takes a cut of wages — you pay your hires directly.
      </p>
    </>
  );
}

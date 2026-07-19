import type { Metadata } from "next";
import { Gift } from "lucide-react";
import { NOINDEX, SITE_URL } from "@/lib/site";
import { requirePageUser } from "@/lib/queries";
import {
  REFERRAL_REWARD,
  claimAttributionFromCookie,
  getAffiliateStats,
  getOrCreateReferral,
} from "@/lib/referral";
import { ReferralLink } from "@/components/referral-link";

export const metadata: Metadata = { title: "Referrals & earnings", ...NOINDEX };

const peso = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" });

/** Renders in whatever currency the payment actually cleared in. No FX here. */
function money(amount: number, currency: string | null) {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency: currency ?? "PHP",
  }).format(amount);
}

const statusChip: Record<string, string> = {
  signed_up: "bg-paper text-ink-soft",
  qualified: "bg-brand-soft text-brand",
  void: "bg-line text-ink-soft",
  pending: "bg-ember-soft text-ember",
  paid: "bg-brand-soft text-brand",
  rejected: "bg-line text-ink-soft",
};

const statusLabel: Record<string, string> = {
  signed_up: "Signed up",
  qualified: "Qualified",
  void: "Void",
};

function date(d: Date) {
  return d.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border border-line bg-white p-5">
      <p className="text-xs font-medium uppercase tracking-wider text-ink-faint">{label}</p>
      <p className="font-display mt-2 text-2xl font-semibold text-ink">{value}</p>
      {sub && <p className="mt-1 text-xs text-ink-faint">{sub}</p>}
    </div>
  );
}

/** One tile per currency — totals are never added across them. */
function Earnings({ earned }: { earned: { currency: string; amount: number }[] }) {
  if (earned.length === 0) return <Stat label="Earned" value={peso.format(0)} />;
  return (
    <>
      {earned.map((e) => (
        <Stat
          key={e.currency}
          label={`Earned (${e.currency})`}
          value={money(e.amount, e.currency)}
        />
      ))}
    </>
  );
}

export default async function TalentPayoutsPage() {
  const user = await requirePageUser("talent");
  await claimAttributionFromCookie(user.id);
  const referral = await getOrCreateReferral(user.id, user.name);
  const stats = await getAffiliateStats(user.id);

  return (
    <>
      <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">
        Referrals &amp; earnings
      </h1>
      <p className="mt-1 text-sm text-ink-soft">
        The only money that moves through shortlisted.ph — and it flows to you.
      </p>

      <section className="mt-7 rounded-2xl border border-line bg-white p-6">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-soft">
            <Gift className="h-5 w-5 text-brand" strokeWidth={1.75} />
          </span>
          <div className="max-w-xl text-sm leading-relaxed text-ink-soft">
            <p>
              Share your link with an employer who has never used shortlisted.ph. If they sign up
              through it and buy their first shortlist, you earn{" "}
              {Math.round(REFERRAL_REWARD.rate * 100)}% of that purchase. No cap, and no limit on
              how many people you refer.
            </p>
            <ul className="mt-3 space-y-1 text-ink-faint">
              <li>A person can only be referred once, by whoever they clicked first.</li>
              <li>Referring yourself does not count.</li>
              <li>
                Payouts go out by GCash or bank transfer once your unpaid balance is worth{" "}
                {peso.format(REFERRAL_REWARD.minPayout)} or more.
              </li>
            </ul>
          </div>
        </div>
      </section>

      <section className="mt-5 rounded-2xl border border-line bg-white p-6">
        <ReferralLink code={referral.code} base={SITE_URL} />
      </section>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Clicks" value={String(stats.clicks)} />
        <Stat label="Signups" value={String(stats.signups)} />
        <Stat label="Qualified" value={String(stats.qualified)} />
        <Earnings earned={stats.earned} />
        <Stat label="Paid out" value={peso.format(stats.paidPhp)} />
        <Stat
          label="Unpaid"
          value={stats.unpaidPhp === null ? "—" : peso.format(stats.unpaidPhp)}
          sub={stats.unpaidPhp === null ? "Settled at payout" : undefined}
        />
      </div>

      <p className="mt-3 text-xs leading-relaxed text-ink-faint">
        Earnings are held in the currency the employer paid in. Payouts are always sent in pesos —
        anything earned in another currency is converted at the rate on the day it is paid, so the
        peso amount you receive will not match the figure above exactly.
      </p>

      <section className="mt-5 overflow-hidden rounded-2xl border border-line bg-white">
        <h2 className="border-b border-line px-6 py-4 text-sm font-medium uppercase tracking-wider text-ink-faint">
          Recent activity
        </h2>
        {stats.activity.length === 0 ? (
          <p className="px-6 py-8 text-center text-sm text-ink-soft">
            No one has signed up through your link yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <tbody>
                {stats.activity.map((a, i) => (
                  <tr key={a.id} className={i > 0 ? "border-t border-line" : ""}>
                    <td className="px-6 py-3.5 font-medium text-ink">{a.name}</td>
                    <td className="px-3 py-3.5 text-xs text-ink-faint">{a.source ?? "direct"}</td>
                    <td className="px-3 py-3.5 text-xs text-ink-faint">{date(a.createdAt)}</td>
                    <td className="px-3 py-3.5 text-right text-ink">
                      {a.reward ? money(a.reward, a.currency) : "—"}
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      <span
                        className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${statusChip[a.status]}`}
                      >
                        {statusLabel[a.status] ?? a.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="mt-5 overflow-hidden rounded-2xl border border-line bg-white">
        <h2 className="border-b border-line px-6 py-4 text-sm font-medium uppercase tracking-wider text-ink-faint">
          Payout history
        </h2>
        {stats.payouts.length === 0 ? (
          <p className="px-6 py-8 text-center text-sm text-ink-soft">No payouts yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <tbody>
                {stats.payouts.map((p, i) => (
                  <tr key={p.id} className={i > 0 ? "border-t border-line" : ""}>
                    <td className="px-6 py-3.5 font-medium text-ink">{peso.format(p.amount)}</td>
                    <td className="px-3 py-3.5 text-xs uppercase text-ink-faint">{p.method}</td>
                    <td className="px-3 py-3.5 text-xs text-ink-faint">{p.reference ?? "—"}</td>
                    <td className="px-3 py-3.5 text-xs text-ink-faint">
                      {date(p.paidAt ?? p.createdAt)}
                    </td>
                    <td className="px-6 py-3.5 text-right">
                      <span
                        className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${statusChip[p.status]}`}
                      >
                        {p.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="mt-5 text-center text-xs font-medium text-ink-faint">
        Talent never pays shortlisted.ph anything. Ever.
      </p>
    </>
  );
}

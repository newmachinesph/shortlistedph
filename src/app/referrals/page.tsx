import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Gift } from "lucide-react";
import { Logo } from "@/components/logo";
import { ReferralLink } from "@/components/referral-link";
import { ReferralPayout } from "@/components/referral-payout";
import { getSessionUser } from "@/lib/session";
import { NOINDEX, SITE_URL } from "@/lib/site";
import {
  REFERRAL_REWARD,
  claimAttributionFromCookie,
  getAffiliateStats,
  getOrCreateReferral,
} from "@/lib/referral";

export const metadata: Metadata = { title: "Referrals", ...NOINDEX };

const peso = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" });

/** Renders in whatever currency the payment cleared in. No FX anywhere. */
function money(amount: number, currency: string | null) {
  return new Intl.NumberFormat("en-PH", { style: "currency", currency: currency ?? "PHP" }).format(
    amount,
  );
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
      <p className="font-display mt-2 break-words text-2xl font-semibold text-ink">{value}</p>
      {sub && <p className="mt-1 text-xs text-ink-faint">{sub}</p>}
    </div>
  );
}

export default async function ReferralsPage() {
  // Any signed-in account can refer — the referrer's own role is irrelevant,
  // only whether the person they referred is a company that pays.
  const user = await getSessionUser();
  if (!user) redirect("/login");
  // Matches requireUser(): a suspended account should not be accruing credit.
  if (user.status !== "active") redirect("/login");

  await claimAttributionFromCookie(user.id);
  const referral = await getOrCreateReferral(user.id, user.name);
  const stats = await getAffiliateStats(user.id);
  const bounty = money(REFERRAL_REWARD.amount, REFERRAL_REWARD.currency);

  const home = user.role === "employer" ? "/employer" : user.role === "admin" ? "/admin" : "/talent";

  return (
    <div className="min-h-screen bg-paper">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-4 sm:px-8">
          <Link href="/">
            <Logo />
          </Link>
          <Link
            href={home}
            className="ml-auto inline-flex items-center gap-1.5 text-sm text-ink-soft transition-colors hover:text-ink"
          >
            <ArrowLeft className="h-4 w-4" strokeWidth={1.75} />
            Back to workspace
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-8">
        <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">Referrals</h1>
        <p className="mt-1 text-sm text-ink-soft">
          Refer a company that hires through shortlisted.ph and take a cut of what they spend.
        </p>

        <section className="mt-7 rounded-2xl border border-line bg-white p-4 sm:p-6">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-soft">
              <Gift className="h-5 w-5 text-brand" strokeWidth={1.75} />
            </span>
            <div className="max-w-2xl text-sm leading-relaxed text-ink-soft">
              <p className="text-ink">
                {bounty} for every company you refer that buys their first shortlist.
              </p>
              <ul className="mt-3 space-y-1.5 text-ink-faint">
                <li>
                  <span className="font-medium text-ink-soft">The same {bounty} either way.</span>{" "}
                  It does not matter whether they buy one shortlist or a three-pack — the amount is
                  flat.
                </li>
                <li>
                  <span className="font-medium text-ink-soft">It pays once per company.</span> You
                  earn on their first purchase only. Anything they buy after that earns you nothing.
                </li>
                <li>
                  <span className="font-medium text-ink-soft">Only companies earn.</span> Referring
                  a jobseeker pays nothing — they never buy anything, and the one fee talent does
                  pay is passed straight through at cost.
                </li>
                <li>
                  <span className="font-medium text-ink-soft">A signup is not a sale.</span> You are
                  paid when the company buys, not when they register.
                </li>
                <li>
                  A company can only be referred once, by whoever they clicked first. Referring
                  yourself does not count.
                </li>
                <li>
                  Payouts are sent to your PayPal in USD, settled by hand. The minimum is the
                  equivalent of {peso.format(REFERRAL_REWARD.minPayout)}, which one conversion
                  normally covers. No cap on how many companies you refer.
                </li>
              </ul>
            </div>
          </div>
        </section>

        <section className="mt-5 rounded-2xl border border-line bg-white p-4 sm:p-6">
          <ReferralLink code={referral.code} base={SITE_URL} bounty={bounty} />
        </section>

        <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Clicks" value={String(stats.clicks)} />
          <Stat
            label="Companies referred"
            value={String(stats.companies)}
            sub={stats.otherSignups > 0 ? `${stats.otherSignups} jobseekers (no reward)` : undefined}
          />
          <Stat label="Paid for a shortlist" value={String(stats.qualified)} />
          {stats.earned.length === 0 ? (
            <Stat label="Earned" value={peso.format(0)} />
          ) : (
            stats.earned.map((e) => (
              <Stat
                key={e.currency}
                label={`Earned (${e.currency})`}
                value={money(e.amount, e.currency)}
              />
            ))
          )}
          {stats.paid.length === 0 ? (
            <Stat label="Paid out" value={money(0, REFERRAL_REWARD.currency)} />
          ) : (
            stats.paid.map((p) => (
              <Stat
                key={p.currency}
                label={`Paid out (${p.currency})`}
                value={money(p.amount, p.currency)}
              />
            ))
          )}
          {stats.owed.length === 0 ? (
            <Stat label="Unpaid" value={money(0, REFERRAL_REWARD.currency)} />
          ) : (
            stats.owed.map((o) => (
              <Stat
                key={o.currency}
                label={`Unpaid (${o.currency})`}
                value={money(o.amount, o.currency)}
                sub="Not yet requested"
              />
            ))
          )}
        </div>

        <p className="mt-3 text-xs leading-relaxed text-ink-faint">
          Earnings are held in the currency the company paid in, and payout requests are recorded in
          that same currency. Transfers are settled by hand to your PayPal, so allow a few days for
          them to arrive.
        </p>

        <section className="mt-5 rounded-2xl border border-line bg-white p-4 sm:p-6">
          <ReferralPayout
            method={stats.payoutMethod}
            payoutEmail={stats.payoutEmail}
            owed={stats.owed.map((o) => ({
              currency: o.currency,
              formatted: money(o.amount, o.currency),
            }))}
            hasPendingRequest={stats.hasPendingRequest}
          />
        </section>

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
              {/* Five columns cannot fit 360px legibly — scroll the table, never the page. */}
              <table className="w-full min-w-[34rem] text-sm">
                <tbody>
                  {stats.activity.map((a, i) => (
                    <tr key={a.id} className={i > 0 ? "border-t border-line" : ""}>
                      <td className="px-6 py-3.5">
                        <p className="font-medium text-ink">{a.name}</p>
                        <p className="text-xs text-ink-faint">
                          {a.isCompany ? "Company" : "Jobseeker — does not earn"}
                        </p>
                      </td>
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
              <table className="w-full min-w-[34rem] text-sm">
                <tbody>
                  {stats.payouts.map((p, i) => (
                    <tr key={p.id} className={i > 0 ? "border-t border-line" : ""}>
                      <td className="px-6 py-3.5 font-medium text-ink">
                        {money(p.amount, p.currency)}
                      </td>
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
      </main>
    </div>
  );
}

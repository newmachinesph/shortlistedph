import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { NOINDEX } from "@/lib/site";
import { HttpError, requireAdmin } from "@/lib/session";
import { REFERRAL_REWARD, getSelfReferralSignals, type RiskFlag } from "@/lib/referral";

export const metadata: Metadata = { title: "Admin · Affiliates", ...NOINDEX };

const peso = new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" });

/** Payments clear in the provider's currency and are never converted here. */
function money(amount: number, currency: string) {
  return new Intl.NumberFormat("en-PH", { style: "currency", currency }).format(amount);
}

function date(d: Date) {
  return d.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
}

async function load() {
  const [referrals, pendingPayouts] = await Promise.all([
    db.referral.findMany({
      include: {
        user: { select: { name: true, email: true } },
        conversions: {
          select: {
            status: true,
            rewardAmount: true,
            currency: true,
            user: { select: { employer: { select: { id: true } } } },
          },
        },
        _count: { select: { clicks: true } },
      },
    }),
    db.referralPayout.findMany({
      where: { status: "pending" },
      orderBy: { createdAt: "asc" },
      include: { user: { select: { name: true, email: true } } },
    }),
  ]);

  const signals = await getSelfReferralSignals();

  const rows = referrals
    .map((r) => {
      const qualified = r.conversions.filter((c) => c.status === "qualified");
      // Totalled per currency — PayPal clears USD, PayMongo clears PHP, and
      // there is no rate in this codebase to reconcile them with.
      const byCurrency = new Map<string, number>();
      for (const c of qualified) {
        const key = c.currency ?? "PHP";
        byCurrency.set(key, (byCurrency.get(key) ?? 0) + (c.rewardAmount ?? 0));
      }
      return {
        id: r.id,
        code: r.code,
        name: r.user.name,
        email: r.user.email,
        flags: signals.get(r.userId) ?? [],
        clicks: r._count.clicks,
        // Split, because only companies can ever earn — a combined count next
        // to zero earnings looks like broken tracking rather than the rule.
        companies: r.conversions.filter((c) => c.status !== "void" && c.user.employer).length,
        jobseekers: r.conversions.filter((c) => c.status !== "void" && !c.user.employer).length,
        qualified: qualified.length,
        earned: [...byCurrency.entries()]
          .map(([currency, amount]) => ({ currency, amount }))
          .sort((a, b) => a.currency.localeCompare(b.currency)),
      };
    })
    // Conversions are what the programme is for — rank on those, not on traffic.
    .filter((r) => r.clicks > 0 || r.companies > 0 || r.jobseekers > 0)
    .sort(
      (a, b) => b.qualified - a.qualified || b.companies - a.companies || b.clicks - a.clicks,
    )
    .slice(0, 50);

  return {
    rows,
    pendingPayouts: pendingPayouts.map((p) => ({ ...p, flags: signals.get(p.userId) ?? [] })),
  };
}

/**
 * Hints, not a verdict. An empty list means nothing cheap was detectable — it
 * is not a clearance, which is why there is no "looks fine" state.
 */
function RiskChips({ flags }: { flags: RiskFlag[] }) {
  if (flags.length === 0) return null;
  return (
    <div className="mt-1.5 flex flex-wrap gap-1.5">
      {flags.map((f) => (
        <span
          key={f.code}
          title={f.detail}
          className="rounded-full bg-ember-soft px-2.5 py-1 text-[11px] font-medium text-ember"
        >
          check: {f.label}
        </span>
      ))}
    </div>
  );
}

export default async function AdminAffiliates() {
  try {
    await requireAdmin();
  } catch (e) {
    if (e instanceof HttpError) redirect("/");
    throw e;
  }

  const { rows, pendingPayouts } = await load();
  const owed = pendingPayouts.reduce((sum, p) => sum + p.amount, 0);

  return (
    <>
      <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">Affiliates</h1>
      <p className="mt-1 text-sm text-ink-soft">
        {money(REFERRAL_REWARD.amount, REFERRAL_REWARD.currency)} flat per referred company, once,
        on their first shortlist purchase. Referred jobseekers never earn.
        {pendingPayouts.length > 0
          ? ` ${peso.format(owed)} awaiting transfer across ${pendingPayouts.length} payout${pendingPayouts.length === 1 ? "" : "s"}.`
          : " No payouts awaiting transfer."}
      </p>
      <p className="mt-2 max-w-2xl text-xs leading-relaxed text-ink-faint">
        Earnings are shown in the currency each payment cleared in and are never added together —
        there is no FX rate in this system. Payouts are PHP; you pick the rate when you settle a
        non-PHP balance.
      </p>

      <h2 className="mt-8 mb-3 text-sm font-medium uppercase tracking-wider text-ink-faint">
        Pending payouts
      </h2>
      <div className="overflow-hidden rounded-2xl border border-line bg-white">
        {pendingPayouts.length === 0 ? (
          <p className="px-6 py-8 text-center text-sm text-ink-soft">Nothing to pay out.</p>
        ) : (
          pendingPayouts.map((p, i) => (
            <div
              key={p.id}
              className={`flex flex-wrap items-center gap-4 px-6 py-4 ${i > 0 ? "border-t border-line" : ""}`}
            >
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">{p.user.name}</p>
                <p className="truncate text-xs text-ink-faint">
                  {p.user.email} · {p.method} · requested {date(p.createdAt)}
                </p>
                <RiskChips flags={p.flags} />
              </div>
              <span className="font-display text-sm font-semibold text-ink">
                {peso.format(p.amount)}
              </span>
              <span className="rounded-full bg-ember-soft px-2.5 py-1 text-[11px] font-medium text-ember">
                pending
              </span>
              <code className="rounded-lg bg-paper px-2 py-1 text-[11px] text-ink-faint">{p.id}</code>
            </div>
          ))
        )}
      </div>
      {pendingPayouts.length > 0 && (
        <p className="mt-2 text-xs text-ink-faint">
          Settle with PATCH /api/admin/affiliates/&lt;payout id&gt; — a transfer reference is
          required to mark one paid.
        </p>
      )}
      <p className="mt-2 max-w-2xl text-xs leading-relaxed text-ink-faint">
        A &ldquo;check&rdquo; chip means something about the pair is worth a look before you send
        money — hover it for what to verify. Nothing here blocks a payout, and no chip does not mean
        the referral was checked: signing up a second account under a different email is the obvious
        way to claim {money(REFERRAL_REWARD.amount, REFERRAL_REWARD.currency)} back off your own
        purchase, and only some of that is detectable from what we store.
      </p>

      <h2 className="mt-8 mb-3 text-sm font-medium uppercase tracking-wider text-ink-faint">
        Top affiliates
      </h2>
      <div className="overflow-hidden rounded-2xl border border-line bg-white">
        {rows.length === 0 ? (
          <p className="px-6 py-8 text-center text-sm text-ink-soft">
            No referral link has been clicked yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line text-xs uppercase tracking-wider text-ink-faint">
                  <th className="px-6 py-3 text-left font-medium">Affiliate</th>
                  <th className="px-3 py-3 text-right font-medium">Clicks</th>
                  <th className="px-3 py-3 text-right font-medium">Companies</th>
                  <th className="px-3 py-3 text-right font-medium">Jobseekers</th>
                  <th className="px-3 py-3 text-right font-medium">Qualified</th>
                  <th className="px-6 py-3 text-right font-medium">Earned</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.id} className={i > 0 ? "border-t border-line" : ""}>
                    <td className="px-6 py-3.5">
                      <p className="text-sm font-medium text-ink">{r.name}</p>
                      <p className="text-xs text-ink-faint">
                        /r/{r.code} · {r.email}
                      </p>
                      <RiskChips flags={r.flags} />
                    </td>
                    <td className="px-3 py-3.5 text-right text-ink-soft">{r.clicks}</td>
                    <td className="px-3 py-3.5 text-right text-ink-soft">{r.companies}</td>
                    <td className="px-3 py-3.5 text-right text-ink-faint">{r.jobseekers}</td>
                    <td className="px-3 py-3.5 text-right text-ink">{r.qualified}</td>
                    <td className="px-6 py-3.5 text-right font-medium text-ink">
                      {r.earned.length === 0
                        ? "—"
                        : r.earned.map((e) => (
                            <span key={e.currency} className="block whitespace-nowrap">
                              {money(e.amount, e.currency)}
                            </span>
                          ))}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

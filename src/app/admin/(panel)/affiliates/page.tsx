import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { NOINDEX } from "@/lib/site";
import { HttpError, requireAdmin } from "@/lib/session";
import { ReferralSettle, ReferralVoid } from "@/components/referral-admin-actions";
import {
  EARNED,
  REFERRAL_REWARD,
  getSelfReferralSignals,
  type RiskFlag,
} from "@/lib/referral";

export const metadata: Metadata = { title: "Admin · Affiliates", ...NOINDEX };

/** Payments clear in the provider's currency and are never converted here. */
function money(amount: number, currency: string) {
  return new Intl.NumberFormat("en-PH", { style: "currency", currency }).format(amount);
}

function date(d: Date) {
  return d.toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
}

async function load() {
  const [referrals, pendingPayoutsRaw] = await Promise.all([
    db.referral.findMany({
      include: {
        user: { select: { name: true, email: true } },
        conversions: {
          select: {
            status: true,
            user: { select: { employer: { select: { id: true } } } },
          },
        },
        commissions: { select: { amount: true, currency: true } },
        _count: { select: { clicks: true } },
      },
    }),
    db.referralPayout.findMany({
      where: { status: "pending" },
      orderBy: { createdAt: "asc" },
      include: { user: { select: { name: true, email: true } } },
    }),
  ]);

  const pendingPayouts = pendingPayoutsRaw.map((p) => ({ ...p, amount: Number(p.amount) }));

  const signals = await getSelfReferralSignals();

  // Payout destination per affiliate, keyed by userId so a pending payout can
  // show where the money is going — the PayPal email on file.
  const details = new Map(
    referrals.map((r) => [r.userId, { email: r.payoutAccountNumber }]),
  );

  // Only conversions belonging to a flagged affiliate: the chips said "worth a
  // look" and this is the list you actually look at, with the lever attached.
  const flaggedUserIds = [...signals.keys()];
  const flaggedConversionsRaw = flaggedUserIds.length
    ? await db.referralConversion.findMany({
        where: {
          status: "qualified",
          // Something is still owed on it — that is what voiding can reverse.
          commissions: { some: { payoutId: null } },
          referral: { userId: { in: flaggedUserIds } },
        },
        orderBy: { qualifiedAt: "desc" },
        take: 50,
        select: {
          id: true,
          qualifiedAt: true,
          createdAt: true,
          commissions: { where: { payoutId: null }, select: { amount: true, currency: true } },
          user: { select: { email: true, employer: { select: { companyName: true } } } },
          referral: { select: { code: true, userId: true, user: { select: { email: true } } } },
        },
      })
    : [];
  const flaggedConversions = flaggedConversionsRaw.map((c) => ({
    ...c,
    unpaid: c.commissions.reduce((sum, m) => sum + Number(m.amount), 0),
    unpaidCurrency: c.commissions[0]?.currency ?? null,
    purchases: c.commissions.length,
  }));

  const rows = referrals
    .map((r) => {
      // Totalled per currency — PayPal clears USD, PayMongo clears PHP, and
      // there is no rate in this codebase to reconcile them with.
      const byCurrency = new Map<string, number>();
      for (const c of r.commissions) {
        byCurrency.set(c.currency, (byCurrency.get(c.currency) ?? 0) + Number(c.amount));
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
        // One commission per qualifying purchase, so the count IS purchases.
        purchases: r.commissions.length,
        earned: [...byCurrency.entries()]
          .map(([currency, amount]) => ({ currency, amount }))
          .sort((a, b) => a.currency.localeCompare(b.currency)),
      };
    })
    // Conversions are what the programme is for — rank on those, not on traffic.
    .filter((r) => r.clicks > 0 || r.companies > 0 || r.jobseekers > 0)
    .sort(
      (a, b) => b.purchases - a.purchases || b.companies - a.companies || b.clicks - a.clicks,
    )
    .slice(0, 50);

  // Grouped, never added up: a USD request and a PHP request are two figures.
  const owedBy = new Map<string, number>();
  for (const p of pendingPayouts) {
    owedBy.set(p.currency, (owedBy.get(p.currency) ?? 0) + p.amount);
  }
  const owed = [...owedBy.entries()]
    .map(([currency, amount]) => ({ currency, amount: Math.round(amount * 100) / 100 }))
    .sort((a, b) => a.currency.localeCompare(b.currency));

  return {
    rows,
    owed,
    flaggedConversions,
    pendingPayouts: pendingPayouts.map((p) => ({
      ...p,
      flags: signals.get(p.userId) ?? [],
      payTo: details.get(p.userId) ?? null,
    })),
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
          className="rounded-full bg-ember-soft px-2.5 py-1 text-xs font-medium text-ember sm:text-[11px]"
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

  const { rows, owed, flaggedConversions, pendingPayouts } = await load();
  const owedLabel = owed.map((o) => money(o.amount, o.currency)).join(" + ");

  return (
    <>
      <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">Affiliates</h1>
      <p className="mt-1 text-sm text-ink-soft">
        {money(REFERRAL_REWARD.amount, REFERRAL_REWARD.currency)} flat per shortlist purchase by a
        referred company — every purchase, for as long as they keep buying. One purchase is one
        commission whatever it contains (a three-pack pays the same as a single). Interview credits
        and referred jobseekers never earn.
        {pendingPayouts.length > 0
          ? ` ${owedLabel} awaiting transfer across ${pendingPayouts.length} payout${pendingPayouts.length === 1 ? "" : "s"}.`
          : " No payouts awaiting transfer."}
      </p>
      <p className="mt-2 max-w-2xl text-xs leading-relaxed text-ink-faint">
        Earnings are shown in the currency each payment cleared in and are never added together —
        there is no FX rate in this system. A payout request is recorded in the currency it was
        earned in, normally {REFERRAL_REWARD.currency}; you send it by hand to the affiliate&apos;s
        PayPal and put the transfer reference in the settle field.
      </p>

      <h2 className="mt-8 mb-3 text-sm font-medium uppercase tracking-wider text-ink-faint">
        Pending payouts
        <span className="ml-2 rounded-full bg-line px-2 py-0.5 text-[11px] font-medium normal-case tracking-normal text-ink-soft">
          {pendingPayouts.length}
        </span>
      </h2>
      <div className="overflow-hidden rounded-2xl border border-line bg-white">
        {pendingPayouts.length === 0 ? (
          <p className="px-6 py-8 text-center text-sm text-ink-soft">Nothing to pay out.</p>
        ) : (
          pendingPayouts.map((p, i) => (
            <div
              key={p.id}
              className={`flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-4 sm:px-6 ${i > 0 ? "border-t border-line" : ""}`}
            >
              <div className="min-w-0 flex-1 basis-48">
                <p className="truncate text-sm font-medium text-ink">{p.user.name}</p>
                <p className="break-all text-xs text-ink-faint">
                  {p.user.email} · {p.method === "paypal" ? "PayPal" : p.method} · requested{" "}
                  {date(p.createdAt)}
                </p>
                <p className="break-all text-xs text-ink-faint">
                  Pay to {p.payTo?.email ?? "no PayPal on file"}
                </p>
                <RiskChips flags={p.flags} />
              </div>
              <div className="flex items-center gap-3">
                <span className="font-display text-sm font-semibold text-ink">
                  {money(p.amount, p.currency)}
                </span>
                <span className="shrink-0 rounded-full bg-ember-soft px-2.5 py-1 text-[11px] font-medium text-ember">
                  pending
                </span>
              </div>
              <ReferralSettle payoutId={p.id} />
            </div>
          ))
        )}
      </div>
      {pendingPayouts.length > 0 && (
        <p className="mt-2 text-xs text-ink-faint">
          A transfer reference is required to mark one paid. Rejecting releases the conversions it
          covers, so the affiliate can request the balance again.
        </p>
      )}
      <p className="mt-2 max-w-2xl text-xs leading-relaxed text-ink-faint">
        A &ldquo;check&rdquo; chip means something about the pair is worth a look before you send
        money — hover it for what to verify. Nothing here blocks a payout, and no chip does not mean
        the referral was checked: signing up a second account under a different email is the obvious
        way to claim {money(REFERRAL_REWARD.amount, REFERRAL_REWARD.currency)} back off your own
        purchase, and only some of that is detectable from what we store.
      </p>

      {flaggedConversions.length > 0 && (
        <>
          <h2 className="mt-8 mb-3 text-sm font-medium uppercase tracking-wider text-ink-faint">
            Flagged conversions
            <span className="ml-2 rounded-full bg-line px-2 py-0.5 text-[11px] font-medium normal-case tracking-normal text-ink-soft">
              {flaggedConversions.length}
            </span>
          </h2>
          <div className="overflow-hidden rounded-2xl border border-line bg-white">
            {flaggedConversions.map((c, i) => (
              <div
                key={c.id}
                className={`flex flex-wrap items-center gap-x-4 gap-y-3 px-4 py-4 sm:px-6 ${i > 0 ? "border-t border-line" : ""}`}
              >
                <div className="min-w-0 flex-1 basis-48">
                  <p className="truncate text-sm font-medium text-ink">
                    {c.user.employer?.companyName ?? c.user.email}
                  </p>
                  <p className="break-all text-xs text-ink-faint">
                    referred by /r/{c.referral.code} ({c.referral.user.email}) · first purchase{" "}
                    {date(c.qualifiedAt ?? c.createdAt)} · {c.purchases} unpaid commission
                    {c.purchases === 1 ? "" : "s"}
                  </p>
                </div>
                <div className="flex w-full flex-wrap items-center gap-3 sm:w-auto">
                  <span className="text-sm text-ink">
                    {c.unpaid > 0
                      ? money(c.unpaid, c.unpaidCurrency ?? REFERRAL_REWARD.currency)
                      : "—"}
                  </span>
                  <ReferralVoid conversionId={c.id} />
                </div>
              </div>
            ))}
          </div>
          <p className="mt-2 max-w-2xl text-xs leading-relaxed text-ink-faint">
            Referred companies with unpaid commissions belonging to an affiliate with a check chip.
            Voiding one deletes its unpaid commissions, stops all future accrual from that company,
            and takes it out of every balance. A conversion with a commission inside a payout cannot
            be voided — settle or reject that payout first.
          </p>
        </>
      )}

      <h2 className="mt-8 mb-3 text-sm font-medium uppercase tracking-wider text-ink-faint">
        Top affiliates
        <span className="ml-2 rounded-full bg-line px-2 py-0.5 text-[11px] font-medium normal-case tracking-normal text-ink-soft">
          {rows.length}
        </span>
      </h2>
      <div className="overflow-hidden rounded-2xl border border-line bg-white">
        {rows.length === 0 ? (
          <p className="px-6 py-8 text-center text-sm text-ink-soft">
            No referral link has been clicked yet.
          </p>
        ) : (
          <div className="overflow-x-auto">
            {/* min-w forces the six columns to scroll inside this box rather than
                squash to unreadable widths on a phone. */}
            <table className="w-full min-w-[44rem] text-sm">
              <thead>
                <tr className="border-b border-line text-xs uppercase tracking-wider text-ink-faint">
                  <th className="px-6 py-3 text-left font-medium">Affiliate</th>
                  <th className="px-3 py-3 text-right font-medium">Clicks</th>
                  <th className="px-3 py-3 text-right font-medium">Companies</th>
                  <th className="px-3 py-3 text-right font-medium">Jobseekers</th>
                  <th className="px-3 py-3 text-right font-medium">Purchases</th>
                  <th className="px-6 py-3 text-right font-medium">Earned</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={r.id} className={i > 0 ? "border-t border-line" : ""}>
                    <td className="px-6 py-3.5">
                      <p className="text-sm font-medium text-ink">{r.name}</p>
                      <p className="break-all text-xs text-ink-faint">
                        /r/{r.code} · {r.email}
                      </p>
                      <RiskChips flags={r.flags} />
                    </td>
                    <td className="px-3 py-3.5 text-right text-ink-soft">{r.clicks}</td>
                    <td className="px-3 py-3.5 text-right text-ink-soft">{r.companies}</td>
                    <td className="px-3 py-3.5 text-right text-ink-faint">{r.jobseekers}</td>
                    <td className="px-3 py-3.5 text-right text-ink">{r.purchases}</td>
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

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { NOINDEX } from "@/lib/site";
import { HttpError, requireAdmin } from "@/lib/session";
import { ReferralSettle, ReferralVoid } from "@/components/referral-admin-actions";
import {
  REFERRAL_REWARD,
  getSelfReferralSignals,
  maskAccount,
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

  // Payout destination per affiliate, keyed by userId so a pending payout can
  // show where the money is going. The account number is masked the moment it
  // leaves the database — the full value never reaches the page.
  const details = new Map(
    referrals.map((r) => [
      r.userId,
      {
        name: r.payoutAccountName,
        masked: r.payoutAccountNumber ? maskAccount(r.payoutAccountNumber) : null,
      },
    ]),
  );

  // Only conversions belonging to a flagged affiliate: the chips said "worth a
  // look" and this is the list you actually look at, with the lever attached.
  const flaggedUserIds = [...signals.keys()];
  const flaggedConversions = flaggedUserIds.length
    ? await db.referralConversion.findMany({
        where: {
          status: "qualified",
          payoutId: null,
          referral: { userId: { in: flaggedUserIds } },
        },
        orderBy: { qualifiedAt: "desc" },
        take: 50,
        select: {
          id: true,
          rewardAmount: true,
          currency: true,
          qualifiedAt: true,
          createdAt: true,
          user: { select: { email: true, employer: { select: { companyName: true } } } },
          referral: { select: { code: true, userId: true, user: { select: { email: true } } } },
        },
      })
    : [];

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

  const { rows, owed, flaggedConversions, pendingPayouts } = await load();
  const owedLabel = owed.map((o) => money(o.amount, o.currency)).join(" + ");

  return (
    <>
      <h1 className="font-display text-2xl font-semibold tracking-tight text-ink">Affiliates</h1>
      <p className="mt-1 text-sm text-ink-soft">
        {money(REFERRAL_REWARD.amount, REFERRAL_REWARD.currency)} flat per referred company, once,
        on their first shortlist purchase. Referred jobseekers never earn.
        {pendingPayouts.length > 0
          ? ` ${owedLabel} awaiting transfer across ${pendingPayouts.length} payout${pendingPayouts.length === 1 ? "" : "s"}.`
          : " No payouts awaiting transfer."}
      </p>
      <p className="mt-2 max-w-2xl text-xs leading-relaxed text-ink-faint">
        Earnings are shown in the currency each payment cleared in and are never added together —
        there is no FX rate in this system. A payout request is recorded in the currency it was
        earned in, normally {REFERRAL_REWARD.currency}; you convert to pesos at the rate on the day
        you transfer and put the peso reference in the settle field.
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
                <p className="truncate text-xs text-ink-faint">
                  Pay to {p.payTo?.name ?? "—"} · {p.payTo?.masked ?? "no account on file"}
                </p>
                <RiskChips flags={p.flags} />
              </div>
              <span className="font-display text-sm font-semibold text-ink">
                {money(p.amount, p.currency)}
              </span>
              <span className="rounded-full bg-ember-soft px-2.5 py-1 text-[11px] font-medium text-ember">
                pending
              </span>
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
          </h2>
          <div className="overflow-hidden rounded-2xl border border-line bg-white">
            {flaggedConversions.map((c, i) => (
              <div
                key={c.id}
                className={`flex flex-wrap items-center gap-4 px-6 py-4 ${i > 0 ? "border-t border-line" : ""}`}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink">
                    {c.user.employer?.companyName ?? c.user.email}
                  </p>
                  <p className="truncate text-xs text-ink-faint">
                    referred by /r/{c.referral.code} ({c.referral.user.email}) · qualified{" "}
                    {date(c.qualifiedAt ?? c.createdAt)}
                  </p>
                </div>
                <span className="text-sm text-ink">
                  {c.rewardAmount ? money(c.rewardAmount, c.currency ?? REFERRAL_REWARD.currency) : "—"}
                </span>
                <ReferralVoid conversionId={c.id} />
              </div>
            ))}
          </div>
          <p className="mt-2 max-w-2xl text-xs leading-relaxed text-ink-faint">
            Unpaid qualified conversions belonging to an affiliate with a check chip. Voiding one
            reverses the earning and takes it out of every balance. A conversion already attached to
            a payout cannot be voided — settle or reject that payout first.
          </p>
        </>
      )}

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

/**
 * The whole commission rule, in one place — pure (no server imports) so the
 * money path is testable.
 *
 * A flat $9 per qualifying purchase, recurring for the lifetime of the
 * referred company: every shortlist-credit purchase they ever make earns the
 * affiliate the same flat amount. It deliberately does NOT scale with what the
 * purchase contains — a $119 three-pack is one purchase and pays exactly the
 * same $9 as a $49 single. Not per credit; per purchase event.
 *
 * Only `kind: "credits"` products earn. Interview credits and the talent
 * verification fee never do — verification is billed at cost and we keep none
 * of it, so commissioning it would pay out of money that was never ours.
 *
 * Denominated in USD because that is what the credits products sell in.
 * Payouts go to the affiliate's PayPal in USD and are settled by hand; there
 * is no FX rate anywhere in this codebase and none is invented here.
 *
 * Rows written before 2026-07-25 carry the old one-time bounty of $9.99 —
 * historical amounts are never rewritten.
 */
export const REFERRAL_REWARD = {
  amount: 9.0,
  currency: "USD" as const,
  /** Fallback currency label for older rows — settlement itself is manual, via PayPal. */
  payoutCurrency: "PHP" as const,
  /** Applies to the peso-equivalent total the operator computes at payout time. */
  minPayout: 500,
} as const;

/** Mirrors PRODUCTS[id].kind in payments.ts, without the server-only import. */
export type ProductKind = "credits" | "interview_credits" | "verification";

/**
 * What a purchase of a product of `kind` earns the referring affiliate, or
 * null when it earns nothing. The payment's own amount and currency are
 * deliberately not inputs: the commission is flat, so taking them would invite
 * someone to start multiplying by them again.
 */
export function commissionFor(
  kind: ProductKind,
): { amount: number; currency: string } | null {
  if (kind !== "credits") return null;
  return { amount: REFERRAL_REWARD.amount, currency: REFERRAL_REWARD.currency };
}

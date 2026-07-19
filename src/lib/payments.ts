import "server-only";

/**
 * Single source of truth for what we sell. Prices live here, never inline in
 * routes or UI, so a change can't half-apply.
 */

export type ProductId = "single" | "three_pack" | "verification";

export const PRODUCTS = {
  // Employer side — PayPal, USD. Buys shortlist credits.
  single: {
    kind: "credits",
    label: "Unlock one shortlist",
    credits: 1,
    amount: "49.00",
    currency: "USD",
  },
  three_pack: {
    kind: "credits",
    label: "Three shortlists",
    credits: 3,
    amount: "119.00",
    currency: "USD",
  },
  // Talent side — PayMongo, PHP. Passed through to Didit at cost; we take
  // nothing. The copy says "at cost" and this is what keeps that true.
  verification: {
    kind: "verification",
    label: "Identity verification",
    credits: 0,
    amount: "60.00",
    currency: "PHP",
  },
} as const satisfies Record<ProductId, {
  kind: "credits" | "verification";
  label: string;
  credits: number;
  amount: string;
  currency: string;
}>;

export const isCreditProduct = (id: string): id is "single" | "three_pack" =>
  id === "single" || id === "three_pack";

/** Amount in the smallest currency unit — PayMongo wants centavos. */
export const toMinorUnits = (amount: string) => Math.round(Number(amount) * 100);

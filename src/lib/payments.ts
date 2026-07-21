import "server-only";
import { INTERVIEW_PRICE_USD } from "./interviews";

/**
 * Single source of truth for what we sell. Prices live here, never inline in
 * routes or UI, so a change can't half-apply.
 */

export type ProductId =
  | "single"
  | "three_pack"
  | "verification"
  | "interview_single"
  | "interview_five";

export const PRODUCTS = {
  // Employer side — PayPal, USD. Buys shortlist credits.
  single: {
    kind: "credits",
    label: "Unlock one shortlist",
    credits: 1,
    interviewCredits: 0,
    amount: "49.00",
    currency: "USD",
  },
  three_pack: {
    kind: "credits",
    label: "Three shortlists",
    credits: 3,
    interviewCredits: 0,
    amount: "119.00",
    currency: "USD",
  },
  // Employer side — PayPal, USD. Buys interview credits, one per booked
  // interview. The single credit is priced from INTERVIEW_PRICE_USD so there is
  // still exactly one interview price in the codebase; the five-pack is a flat
  // discounted bundle.
  interview_single: {
    kind: "interview_credits",
    label: "One interview credit",
    credits: 0,
    interviewCredits: 1,
    amount: INTERVIEW_PRICE_USD.toFixed(2),
    currency: "USD",
  },
  interview_five: {
    kind: "interview_credits",
    label: "Five interview credits",
    credits: 0,
    interviewCredits: 5,
    amount: "70.00",
    currency: "USD",
  },
  // Talent side — PayMongo, PHP. Passed through to Didit at cost; we take
  // nothing. The copy says "at cost" and this is what keeps that true.
  verification: {
    kind: "verification",
    label: "Identity verification",
    credits: 0,
    interviewCredits: 0,
    amount: "60.00",
    currency: "PHP",
  },
} as const satisfies Record<ProductId, {
  kind: "credits" | "interview_credits" | "verification";
  label: string;
  credits: number;
  interviewCredits: number;
  amount: string;
  currency: string;
}>;

export const isCreditProduct = (id: string): id is "single" | "three_pack" =>
  id === "single" || id === "three_pack";

export const isInterviewCreditProduct = (id: string): id is "interview_single" | "interview_five" =>
  id === "interview_single" || id === "interview_five";

/**
 * Any product bought through the PayPal "<employerId>:<productId>" reference —
 * both shortlist and interview credits settle a fixed catalog price and are
 * fulfilled by fulfillPurchase. capture/webhook resolve them through the same
 * branch, so they gate on this.
 */
export const isEmployerCreditProduct = (
  id: string,
): id is "single" | "three_pack" | "interview_single" | "interview_five" =>
  isCreditProduct(id) || isInterviewCreditProduct(id);

/** Amount in the smallest currency unit — PayMongo wants centavos. */
export const toMinorUnits = (amount: string) => Math.round(Number(amount) * 100);

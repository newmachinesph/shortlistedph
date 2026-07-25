import { fail, ok } from "@/lib/api";
import { PRODUCTS, toMinorUnits } from "@/lib/payments";
import { createQrPayment } from "@/lib/paymongo";
import { HttpError, requireRole, requireTalentProfile } from "@/lib/session";
import { hasOpenVerification } from "@/lib/verification";

/**
 * Starts the ₱60 identity-verification payment and returns a QR Ph code to
 * render in-app. Paying only buys the verification ATTEMPT — an admin reviews
 * it and approval is the only thing that writes the badge.
 */
export async function POST() {
  try {
    const user = await requireRole("talent");
    await requireTalentProfile(user.id);

    // Pending or verified means there is nothing left to buy. A REJECTED
    // attempt is deliberately not blocked: the review failed, not the payment,
    // so paying again is exactly how a retry starts. The old gate keyed on
    // "ever paid" and locked rejected applicants out forever.
    if (await hasOpenVerification(user.id)) {
      throw new HttpError(409, "You already have a verification attempt open");
    }

    const product = PRODUCTS.verification;
    const qr = await createQrPayment({
      amountCentavos: toMinorUnits(product.amount),
      description: "shortlisted.ph identity verification (at cost)",
      // The webhook resolves the payer from this — never from the browser.
      metadata: { userId: user.id, productId: "verification" },
    });

    return ok({
      intentId: qr.intentId,
      qrImageUrl: qr.qrImageUrl,
      qrData: qr.qrData,
      amountPhp: product.amount,
    });
  } catch (e) {
    return fail(e);
  }
}

import { db } from "@/lib/db";
import { fail, ok } from "@/lib/api";
import { PRODUCTS, toMinorUnits } from "@/lib/payments";
import { createQrPayment } from "@/lib/paymongo";
import { HttpError, requireRole, requireTalentProfile } from "@/lib/session";

/**
 * Starts the ₱60 identity-verification payment and returns a QR Ph code to
 * render in-app. Paying only buys the verification attempt — the badge comes
 * from Didit confirming identity, never from the payment.
 */
export async function POST() {
  try {
    const user = await requireRole("talent");
    const profile = await requireTalentProfile(user.id);

    if (profile.verifiedTier === "id_verified") {
      throw new HttpError(409, "Already verified");
    }

    const paid = await db.payment.findFirst({
      where: { userId: user.id, purpose: "verification", status: "paid" },
    });
    if (paid) throw new HttpError(409, "Verification already paid for");

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

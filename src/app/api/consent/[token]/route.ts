import { z } from "zod";
import { fail, ok, parseBody } from "@/lib/api";
import { respondToConsent } from "@/lib/consent";
import { clientIp, rateLimit } from "@/lib/rate-limit";

const Body = z.object({ action: z.enum(["accept", "decline"]) });

/**
 * PUBLIC — no session. The emailed token is the credential (128 random bits,
 * unique-indexed), exactly like a password-reset link. respondToConsent is
 * idempotent: already-answered and expired tokens come back as HttpErrors.
 */
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    // 128 bits makes guessing impractical, but "impractical" is not "throttled"
    // — an unauthenticated endpoint should not accept unlimited attempts.
    rateLimit("consentToken", clientIp(req));
    const { token } = await params;
    const { action } = await parseBody(req, Body);
    return ok(await respondToConsent(token, action));
  } catch (e) {
    return fail(e);
  }
}

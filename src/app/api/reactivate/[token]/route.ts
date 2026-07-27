import { z } from "zod";
import { fail, ok, parseBody } from "@/lib/api";
import { reactivate } from "@/lib/reactivation";
import { clientIp, rateLimit } from "@/lib/rate-limit";

const Body = z
  .object({
    decision: z.enum(["publish", "keep_private", "delete"]),
    password: z.string().min(8).max(128).optional(),
  })
  .refine((b) => b.decision === "delete" || b.password != null, {
    message: "A password is required to keep your account",
    path: ["password"],
  });

/**
 * PUBLIC — no session. The emailed token is the credential (128 random bits,
 * unique-indexed), same as /api/consent/[token]: the migrated pool has no
 * Account row, so there is nothing to sign in with yet. reactivate() spends
 * the token in a conditional update, so a replay comes back as an HttpError.
 */
export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  try {
    // Reuses the consentToken budget rather than inventing a number inline:
    // same shape of exposure — guessing at a token on an unauthenticated
    // public link — and lib/rate-limit.ts is not this change's to edit.
    rateLimit("consentToken", clientIp(req));
    const { token } = await params;
    const { decision, password } = await parseBody(req, Body);
    return ok(await reactivate({ token, password, decision }));
  } catch (e) {
    return fail(e);
  }
}

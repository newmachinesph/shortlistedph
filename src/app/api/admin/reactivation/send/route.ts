import { timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { fail, ok, parseBody, requireEnv } from "@/lib/api";
import { HttpError } from "@/lib/session";
import { sendReactivationInvites } from "@/lib/reactivation";

const Body = z.object({
  commit: z.boolean().default(false),
  limit: z.number().int().min(1).max(1000).default(25),
});

/** Length-checked constant-time compare — timingSafeEqual throws on mismatch. */
function secretMatches(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/**
 * The send path for the re-activation invitations, driven by
 * scripts/send-reactivation.ts.
 *
 * It lives in the app rather than in the script because the mailer
 * (lib/email.ts) is "server-only" and throws under plain node — the same
 * reason scripts/seed-admin.ts rebuilds its own BetterAuth. Duplicating the
 * transport in a script is how the kill switch and the sending identity
 * quietly stop applying to the one mail that goes to 785 strangers.
 *
 * Guarded by CRON_SECRET, not an admin session, so a CLI can drive it — same
 * bearer scheme the cron routes already use. There is deliberately no button
 * for this anywhere in the back office.
 */
export async function POST(req: Request) {
  try {
    const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
    if (!secretMatches(bearer, requireEnv("CRON_SECRET"))) {
      throw new HttpError(401, "Bad secret");
    }
    const { commit, limit } = await parseBody(req, Body);
    const result = await sendReactivationInvites({ limit, commit });
    console.info(
      `[reactivation] ${commit ? "SENT" : "DRY RUN"} — queued ${result.queued}, ` +
        `sent ${result.sent}, failed ${result.failed}, outreach ${result.outreachOn ? "on" : "off"}`,
    );
    return ok(result);
  } catch (e) {
    return fail(e);
  }
}

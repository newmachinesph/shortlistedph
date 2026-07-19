import { z } from "zod";
import { fail, ok, parseBody } from "@/lib/api";
import { requireUser } from "@/lib/session";
import { SITE_URL } from "@/lib/site";
import {
  claimAttributionFromCookie,
  getAffiliateStats,
  getOrCreateReferral,
  setCode,
} from "@/lib/referral";

const Body = z.object({ code: z.string().min(3).max(32) });

function link(code: string) {
  return `${SITE_URL}/r/${code}`;
}

/**
 * Open to any signed-in user, not just talent: an employer who brings another
 * employer earns the same way, and gating it would only mean a second system
 * later.
 */
export async function GET() {
  try {
    const user = await requireUser();
    // Backstop for anyone whose attribution was not claimed at signup.
    await claimAttributionFromCookie(user.id);

    const referral = await getOrCreateReferral(user.id, user.name);
    const stats = await getAffiliateStats(user.id);
    return ok({ code: referral.code, link: link(referral.code), stats });
  } catch (e) {
    return fail(e);
  }
}

export async function PATCH(req: Request) {
  try {
    const user = await requireUser();
    const { code } = await parseBody(req, Body);
    await getOrCreateReferral(user.id, user.name); // nothing to rename otherwise
    const referral = await setCode(user.id, code);
    return ok({ code: referral.code, link: link(referral.code) });
  } catch (e) {
    return fail(e);
  }
}

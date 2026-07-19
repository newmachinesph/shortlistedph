import { NextResponse } from "next/server";
import { recordClick, refCookieValue } from "@/lib/referral";
import { SITE_URL } from "@/lib/site";

/**
 * Only same-origin relative paths are honoured. An affiliate link is a URL
 * strangers click, so `?to=` is the obvious open-redirect vector: reject
 * anything absolute, protocol-relative, or backslash-smuggled.
 */
function safePath(raw: string | null): string {
  if (!raw) return "/";
  // The URL parser strips tabs and newlines, so "/\t/evil.com" would become a
  // protocol-relative URL after this check unless they are removed first.
  const to = [...raw].filter((c) => c.charCodeAt(0) > 32).join("");
  if (!to.startsWith("/")) return "/";
  if (to.startsWith("//") || to.startsWith("/\\")) return "/";
  return to;
}

export async function GET(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const url = new URL(req.url);
  const source = url.searchParams.get("s") ?? undefined;

  // A broken affiliate link must never look broken to the visitor — an unknown
  // code lands on the homepage without attribution rather than a 404.
  const referral = await recordClick(code, {
    source,
    ip: req.headers.get("x-forwarded-for")?.split(",")[0].trim(),
    userAgent: req.headers.get("user-agent") ?? undefined,
  }).catch(() => null);

  const res = NextResponse.redirect(new URL(safePath(url.searchParams.get("to")), SITE_URL));
  if (referral) res.cookies.set(refCookieValue(referral.code, source));
  return res;
}

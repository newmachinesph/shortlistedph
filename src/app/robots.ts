import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/** Signed-in and transactional surfaces. Nothing here is useful in a search result. */
const PRIVATE = [
  "/api/",
  "/admin/",
  "/employer/",
  "/talent/",
  "/onboarding",
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
];

/**
 * Answer engines get the same access as search engines, named explicitly so the
 * permission is a decision on the record rather than a side effect of the
 * wildcard rule.
 */
const ANSWER_ENGINES = [
  "GPTBot",
  "OAI-SearchBot",
  "ChatGPT-User",
  "ClaudeBot",
  "Claude-User",
  "PerplexityBot",
  "Perplexity-User",
  "Google-Extended",
  "Applebot-Extended",
  "CCBot",
];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: PRIVATE },
      { userAgent: ANSWER_ENGINES, allow: "/", disallow: PRIVATE },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}

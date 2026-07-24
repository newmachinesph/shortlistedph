import type { Metadata } from "next";

/**
 * Single source for everything that has to agree across metadata, sitemap,
 * robots and structured data.
 *
 * NEXT_PUBLIC_APP_URL is localhost during development, and a canonical tag
 * pointing at localhost would deindex the site. Local values are ignored here
 * rather than trusted, so a forgotten production env var degrades to the right
 * host instead of a silent SEO outage.
 */
const configuredUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
const isLocal = configuredUrl ? /localhost|127\.0\.0\.1|0\.0\.0\.0/.test(configuredUrl) : true;

export const SITE_URL = (isLocal ? "https://shortlisted.ph" : configuredUrl!).replace(/\/$/, "");

export const SITE_NAME = "shortlisted.ph";

export const SITE_TAGLINE = "Don't apply. Get shortlisted.";

export const SITE_DESCRIPTION =
  "Hiring Philippine remote talent, inverted. Write a job description candidates never see, and get a ranked shortlist of Filipino professionals matched against it. No job ads, no application spam, no tailored resumes.";

/** Public routes, in the order a first-time reader should meet them. */
export const PUBLIC_ROUTES = [
  "/",
  "/start",
  "/openings",
  "/for-employers",
  "/for-talent",
  "/why-it-works",
  "/pricing",
  "/interviews",
  "/resume-template",
  "/conduct",
  "/terms",
  "/privacy",
] as const;

type PageMetaInput = {
  title: string;
  description: string;
  path: string;
};

/**
 * Page metadata with the canonical and Open Graph fields filled in from one
 * place, so a new page can't quietly ship without them.
 */
export function pageMeta({ title, description, path }: PageMetaInput): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title: `${title} — ${SITE_NAME}`,
      description,
      url: path,
      siteName: SITE_NAME,
      locale: "en_PH",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} — ${SITE_NAME}`,
      description,
    },
  };
}

/** Applied to every signed-in and authentication surface. */
export const NOINDEX: Metadata = {
  robots: { index: false, follow: false, nocache: true },
};

import type { MetadataRoute } from "next";
import { PUBLIC_ROUTES, SITE_URL } from "@/lib/site";

const PRIORITY: Record<string, number> = {
  "/": 1,
  "/for-employers": 0.9,
  "/for-talent": 0.9,
  "/why-it-works": 0.8,
  "/pricing": 0.8,
};

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return PUBLIC_ROUTES.map((path) => ({
    url: `${SITE_URL}${path === "/" ? "" : path}`,
    lastModified,
    changeFrequency: "monthly" as const,
    priority: PRIORITY[path] ?? 0.4,
  }));
}

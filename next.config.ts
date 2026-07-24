import type { NextConfig } from "next";

// PayPal/PayMongo run server-side (redirect flows, no client SDK), so no
// third-party script origins are needed. script-src keeps 'unsafe-inline'
// because Next's runtime and the JSON-LD block are inline; a nonce-based CSP
// is the upgrade path if we ever add third-party scripts.
// React dev mode needs eval(); production never does.
const isDev = process.env.NODE_ENV === "development";

const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      // GA (@next/third-parties) + the beacon Cloudflare auto-injects.
      `script-src 'self' 'unsafe-inline' https://www.googletagmanager.com https://static.cloudflareinsights.com${isDev ? " 'unsafe-eval'" : ""}`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self' data:",
      // R2: resume/recording uploads PUT directly to presigned bucket URLs
      // from the browser — blocking this breaks onboarding. GA4 posts to
      // regional google-analytics endpoints; CF beacon posts to /cdn-cgi/rum.
      "connect-src 'self' https://*.r2.cloudflarestorage.com https://*.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com https://cloudflareinsights.com",
      "frame-ancestors 'none'",
      "frame-src 'none'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self' https://*.paypal.com https://*.paymongo.com",
    ].join("; "),
  },
];

// Avatars live on the R2 public CDN (every User.image is on this one host —
// verified against prod). Derive the host from R2_PUBLIC_URL so next/image can
// optimize them; fall back to the known CDN host if the env isn't set at build.
const r2Host = (() => {
  try {
    return new URL(process.env.R2_PUBLIC_URL ?? "").hostname || "cdn.shortlisted.ph";
  } catch {
    return "cdn.shortlisted.ph";
  }
})();

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      // Avatars: public R2 CDN.
      { protocol: "https", hostname: r2Host },
      // Employer logos: rendered through the same Avatar component but served
      // via short-lived presigned URLs on the R2 storage host.
      { protocol: "https", hostname: "**.r2.cloudflarestorage.com" },
    ],
  },
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;

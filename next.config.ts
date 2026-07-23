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
      `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ""}`,
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: https:",
      "font-src 'self' data:",
      // R2: resume/recording uploads PUT directly to presigned bucket URLs
      // from the browser — blocking this breaks onboarding.
      "connect-src 'self' https://*.r2.cloudflarestorage.com",
      "frame-ancestors 'none'",
      "frame-src 'none'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self' https://*.paypal.com https://*.paymongo.com",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },
};

export default nextConfig;

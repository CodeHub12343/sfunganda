/** @type {import('next').NextConfig} */

// =============================================================================
// Security headers + API forwarding.
//
// All `/api/v1/*` traffic from the browser is rewritten to the Express API,
// so the browser always talks to the site's own origin and cookies stay
// first-party. The API refuses direct traffic (middleware checks the shared
// internal secret) which this layer injects via a dedicated header, set at
// the edge by middleware.ts.
//
// CSP is nonce-based for scripts and styles — the nonce is minted per request
// in middleware.ts and consumed in layout.tsx (styled-components registry).
// =============================================================================

const API_ORIGIN = process.env.API_ORIGIN ?? "http://localhost:4000";

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  // CSP note: the final nonce-bearing header is set per request by
  // middleware.ts; this one is a safe baseline for pages that bypass the
  // middleware (static assets).
  {
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' https://js.stripe.com",
      "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
      "font-src 'self' data: https://fonts.gstatic.com",
      "img-src 'self' data: blob: https://images.unsplash.com",
      "connect-src 'self' https://api.stripe.com",
      "frame-src https://js.stripe.com https://checkout.stripe.com",
      "form-action 'self' https://checkout.stripe.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "object-src 'none'",
      "upgrade-insecure-requests",
    ].join("; "),
  },
];

const nextConfig = {
  compiler: {
    styledComponents: { ssr: true, displayName: true },
  },
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [{ protocol: "https", hostname: "images.unsplash.com" }],
  },
  reactStrictMode: true,
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: securityHeaders,
      },
      {
        source: "/api/health",
        headers: [{ key: "Cache-Control", value: "no-store" }],
      },
    ];
  },
  async rewrites() {
    // Browser-facing `/api/v1/*` is rewritten to the Express API, so the
    // session cookie travels first-party. The rewrite also strips any
    // attempt by a client to spoof `x-internal-secret` — Next.js forwards
    // only the headers it was given, so middleware.ts injects a fresh,
    // server-side value on every proxied request.
    return [
      {
        source: "/api/v1/:path*",
        destination: `${API_ORIGIN}/v1/:path*`,
      },
    ];
  },
};

export default nextConfig;

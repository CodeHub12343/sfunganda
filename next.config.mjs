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

const IS_PROD = process.env.NODE_ENV === "production";

// R2 origins the browser needs to reach for signed uploads/downloads and
// public derivative URLs. Pulled from env so staging/prod need no code change.
function hostOf(u) {
  try {
    return u ? new URL(u).origin : null;
  } catch {
    return null;
  }
}
const R2_MEDIA_HOSTS = [
  hostOf(process.env.R2_PUBLIC_DERIVATIVES_URL),
  hostOf(process.env.R2_ENDPOINT),
].filter(Boolean);

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=(), interest-cohort=()",
  },
  // HSTS and upgrade-insecure-requests are production-only. In dev the server
  // is plain HTTP on localhost; HSTS would get cached by the browser and keep
  // forcing https:// on localhost long after the dev session ends, and the
  // upgrade directive turns every /api/v1/* fetch into ERR_SSL_PROTOCOL_ERROR.
  ...(IS_PROD
    ? [
        {
          key: "Strict-Transport-Security",
          value: "max-age=63072000; includeSubDomains; preload",
        },
      ]
    : []),
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
      ["img-src 'self' data: blob: https://images.unsplash.com", ...R2_MEDIA_HOSTS].join(" "),
      ["media-src 'self' blob:", ...R2_MEDIA_HOSTS].join(" "),
      ["connect-src 'self' https://api.stripe.com", ...R2_MEDIA_HOSTS].join(" "),
      "frame-src https://js.stripe.com https://checkout.stripe.com",
      "form-action 'self' https://checkout.stripe.com",
      "frame-ancestors 'none'",
      "base-uri 'self'",
      "object-src 'none'",
      ...(IS_PROD ? ["upgrade-insecure-requests"] : []),
    ].join("; "),
  },
];

const nextConfig = {
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  compiler: {
    styledComponents: { ssr: true, displayName: true },
  },
  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      // Public R2 derivatives — host comes from env so staging and prod use
      // different buckets without a code change. The regex form supports an
      // r2.dev subdomain in dev and a custom hostname in production.
      ...(process.env.R2_PUBLIC_DERIVATIVES_URL
        ? [{ protocol: "https", hostname: new URL(process.env.R2_PUBLIC_DERIVATIVES_URL).hostname }]
        : []),
      // Signed-URL downloads from the private R2 endpoint go through
      // next/image when the HTML uses it. Allow the account's S3 host.
      ...(process.env.R2_ENDPOINT
        ? [{ protocol: "https", hostname: new URL(process.env.R2_ENDPOINT).hostname }]
        : []),
    ],
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

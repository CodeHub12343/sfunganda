import { NextResponse, type NextRequest } from "next/server";

// =============================================================================
// Edge middleware.
//
// 1. Gate /admin/*, /field/*, /mfa behind a session cookie — bounces anonymous
//    users to /sign-in. (Role + MFA are enforced by the API, but we want the
//    unauthenticated case to never render the admin layout at all.)
// 2. Mint a per-request CSP nonce; set it on the response headers so the
//    styled-components registry inside layout.tsx can tag every emitted
//    <style> with the same nonce.
// 3. Inject `x-internal-secret` on `/api/v1/*` requests so the Express API,
//    which refuses traffic without it, trusts calls coming from our site.
// =============================================================================

const SESSION_COOKIE_NAME = process.env.NEXT_PUBLIC_SESSION_COOKIE_NAME ?? "sfu_session";
const INTERNAL_PROXY_SECRET = process.env.INTERNAL_PROXY_SECRET ?? "";

const PROTECTED = [/^\/admin(\/|$)/, /^\/field(\/|$)/, /^\/mfa$/];

function cryptoRandom(bytes: number): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  let out = "";
  for (const b of arr) out += (b < 16 ? "0" : "") + b.toString(16);
  return out;
}

function hostOf(url: string | undefined): string | null {
  if (!url) return null;
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.host}`;
  } catch {
    return null;
  }
}

function buildCsp(nonce: string): string {
  const self = "'self'";
  const mediaHosts = [
    hostOf(process.env.R2_PUBLIC_DERIVATIVES_URL),
    process.env.NEXT_PUBLIC_STREAM_CUSTOMER_SUBDOMAIN
      ? `https://${process.env.NEXT_PUBLIC_STREAM_CUSTOMER_SUBDOMAIN}.cloudflarestream.com`
      : null,
  ].filter((x): x is string => !!x);
  const imgSrc = ["'self'", "data:", "blob:", "https://images.unsplash.com", ...mediaHosts].join(" ");
  const mediaSrc = ["'self'", "blob:", ...mediaHosts].join(" ");
  const connectSrc = [
    "'self'",
    "https://api.stripe.com",
    ...mediaHosts,
  ].join(" ");
  const frameSrc = [
    "https://js.stripe.com",
    "https://checkout.stripe.com",
    ...(process.env.NEXT_PUBLIC_STREAM_CUSTOMER_SUBDOMAIN
      ? [`https://${process.env.NEXT_PUBLIC_STREAM_CUSTOMER_SUBDOMAIN}.cloudflarestream.com`]
      : []),
  ].join(" ");
  return [
    `default-src ${self}`,
    `script-src ${self} 'nonce-${nonce}' 'strict-dynamic' https://js.stripe.com`,
    // Nonce covers styled-components SSR output. We keep 'unsafe-inline' as
    // a defensive fallback for the next/font injected <style> and anonymous
    // Server Component style attributes; it is paired with the nonce for
    // policy clarity and will be tightened when we move away from inline
    // styles entirely.
    `style-src ${self} 'nonce-${nonce}' 'unsafe-inline' https://fonts.googleapis.com`,
    `font-src ${self} data: https://fonts.gstatic.com`,
    // Phase 2+ media hosts: public R2 derivatives CDN, private R2 for signed
    // downloads, and Cloudflare Stream for HLS playlists. Hosts come from
    // env so a staging/production split needs no code change.
    `img-src ${imgSrc}`,
    `media-src ${mediaSrc}`,
    `connect-src ${connectSrc}`,
    `frame-src ${frameSrc}`,
    `form-action ${self} https://checkout.stripe.com`,
    `frame-ancestors 'none'`,
    `base-uri ${self}`,
    `object-src 'none'`,
    `upgrade-insecure-requests`,
  ].join("; ");
}

export function middleware(req: NextRequest) {
  const url = req.nextUrl;

  // Route gate.
  if (PROTECTED.some((rx) => rx.test(url.pathname))) {
    if (!req.cookies.get(SESSION_COOKIE_NAME)?.value) {
      const signIn = new URL("/sign-in", req.url);
      signIn.searchParams.set("next", url.pathname + url.search);
      return NextResponse.redirect(signIn);
    }
  }

  const nonce = cryptoRandom(16);
  const requestHeaders = new Headers(req.headers);
  // Expose the nonce to Server Components (layout.tsx reads it to pass into
  // the styled-components registry).
  requestHeaders.set("x-csp-nonce", nonce);

  // Inject the shared secret on proxied API calls. We only do this for the
  // forwarded path so Next can't be used as a general open proxy.
  if (url.pathname.startsWith("/api/v1/") && INTERNAL_PROXY_SECRET) {
    requestHeaders.set("x-internal-secret", INTERNAL_PROXY_SECRET);
  }

  const res = NextResponse.next({ request: { headers: requestHeaders } });
  res.headers.set("x-csp-nonce", nonce);
  res.headers.set("Content-Security-Policy", buildCsp(nonce));
  return res;
}

export const config = {
  // Skip static assets and the asset-y favicon paths.
  matcher: ["/((?!_next/static|_next/image|favicon.svg|robots.txt|sitemap.xml).*)"],
};

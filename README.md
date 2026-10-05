# Sarah's Foundation — monorepo

The site, Express API, and outbox worker for Sarah's Foundation Uganda, run
in partnership with Honest Need. Phase 0 shipped a truthful, hardened public
site; Phase 1 (this release) adds the platform foundation — identity, RBAC,
audit, admin shell, and a multi-organisation data model.

> "A movement that transforms lives by connecting compassionate people with
> children, families, and communities that need hope most."

## Tech stack

| Concern      | Choice                                   |
| ------------ | ---------------------------------------- |
| Framework    | Next.js 15 (App Router)                  |
| Language     | TypeScript (strict)                      |
| Styling      | styled-components v6 (SSR registry)      |
| Animation    | Framer Motion                            |
| Fonts        | Playfair Display + Inter (`next/font`)   |
| Tests        | Vitest (unit) + Playwright (smoke)       |
| Lint/Format  | ESLint flat config + Prettier            |
| CI           | GitHub Actions                           |
| Deployment   | Vercel                                   |

## Getting started

```bash
# 1. API + Mongo + Mailpit via docker compose
docker compose up -d mongo mailpit
cp server/.env.example server/.env
(cd server && npm install && npm run migrate && \
  SEED_FOUNDER_EMAIL=founder@sfuganda.local \
  SEED_FOUNDER_PASSWORD='FounderPassword!1' \
  npm run seed && npm run dev &)
(cd server && npm run dev:worker &)

# 2. Front end
cp .env.example .env.local
npm install
npm run dev                     # http://localhost:3000
```

See [server/README.md](server/README.md) for the API layering, endpoints,
database privileges and restore drill.

### Scripts

| Script              | What it does                                              |
| ------------------- | --------------------------------------------------------- |
| `npm run dev`       | Local dev server                                          |
| `npm run build`     | Production build                                          |
| `npm start`         | Serve the production build                                |
| `npm run lint`      | ESLint over the repo                                      |
| `npm run format`    | Prettier write                                            |
| `npm run format:check` | Prettier check (used in CI)                            |
| `npm run typecheck` | `tsc --noEmit`                                            |
| `npm test`          | Vitest unit suite (route validation, rate limiting)       |
| `npm run test:e2e`  | Playwright smoke tests (`/`, donate, volunteer, `/privacy`) |

## Environment

Required in every environment:

- `NEXT_PUBLIC_SITE_URL` — canonical origin for Stripe success/cancel URLs.
  Mandatory (D6) — the server refuses checkout if unset.
- `STRIPE_SECRET_KEY` — a **separate** `sk_test_...` key for local and preview
  deployments, with `sk_live_...` only on production.

Optional (any one sink is required for `/api/volunteer`):

- `VOLUNTEER_WEBHOOK_URL` — Google Apps Script / Zapier / Make endpoint.
- `RESEND_API_KEY`, `VOLUNTEER_NOTIFY_TO`, `VOLUNTEER_NOTIFY_FROM` — email the
  team on each signup.

With neither sink configured, the endpoint returns 503 rather than silently
drop personal information into server logs (D2).

See [`.env.example`](.env.example) for the full list.

## Project structure

```
src/
  app/
    api/
      checkout/route.ts    Hardened Stripe Checkout session creation
      volunteer/route.ts   Hardened signup intake (webhook + email sinks)
      health/route.ts      Liveness probe for uptime monitors
    privacy/page.tsx       Privacy policy
    terms/page.tsx         Terms of use
    safeguarding/page.tsx  Safeguarding policy
    error.tsx              Runtime error boundary
    not-found.tsx          404 page
    robots.ts              robots.txt
    sitemap.ts             sitemap.xml
    layout.tsx, page.tsx
  components/
    ui/            Button (polymorphic, route-aware), Logo, …
    layout/        Navbar (focus trap, Escape, aria-modal), Footer, …
    sections/      Hero, OurStory, Transparency, FeaturedStories, …
  data/content.ts  Editorial copy (one place to update)
  lib/
    providers.tsx  ThemeProvider + GlobalStyles
    registry.tsx   styled-components SSR registry
    rateLimit.ts   In-memory rate limiter (Phase 0; Redis in Phase 1)
  styles/
tests/
  unit/            Vitest suite — route validation, rate limiting
  e2e/             Playwright smoke suite
```

## Security

- Security headers set in [`next.config.mjs`](next.config.mjs): HSTS, CSP,
  `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`,
  `X-Frame-Options`, and `frame-ancestors`.
- No PII is written to server logs (D2). Volunteer sink diagnostics include
  only the responding host and HTTP status.
- IP-keyed rate limiting on both API routes (D4). In-memory for Phase 0; a
  Redis-backed limiter replaces this in Phase 1.
- Secret scanning runs on every push via gitleaks (`.gitleaks.toml`).
- No live Stripe key should ever live on a developer laptop. Rotate any key
  that has been exposed.

## Content truthfulness

Phase 0 removed figures that cannot yet be substantiated:

- No "raised so far" totals or fixed progress bars (D7). Cards show the
  planned, stakeholder-approved funding goal only.
- No "100% to the children" claim (D8) — pending a verified public finance
  projection in Phase 4.
- No invented per-dollar impact ratios (D9).
- No stock photographs of identifiable children paired with invented names,
  ages, or first-person quotes (D10). The Stories section describes the
  programme — not fictional individuals.
- Every footer, transparency, and navigation link resolves to a real
  destination (D11).

## Deploy

Push to the production branch (`main`) and Vercel builds automatically. CI
must pass on `main` — lint, typecheck, unit tests, build, smoke E2E, and
secret scan.

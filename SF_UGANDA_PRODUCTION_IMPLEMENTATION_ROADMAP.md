# SF Uganda — Production Implementation Roadmap

**Platform:** sfuganda.com (Sarah's Foundation Uganda)
**Document date:** 2026-10-05
**Revision 2 (same date):** backend stack changed, by decision of the project owner, from the originally recommended Next.js route handlers + PostgreSQL to **Express + MongoDB, with Cloudflare** for storage, video, CDN and edge protection. Sections 8–10, 12–15, 18–21 and 24–28 were rewritten accordingly. Features, phases, safeguarding rules and the MVP boundary are unchanged; the ways integrity is enforced, the deployment shape, and the estimates are not.
**Inputs:** the repository at commit `be5b79b` (branch `main`), and the requirements file [sfugandanewfeatures.md](sfugandanewfeatures.md) (WhatsApp thread 26 Aug – 25 Sep plus the "Accomplishments & Transparency Portal" blueprint).
**Method:** every tracked file (44) was read; TypeScript was type-checked (`tsc --noEmit` passes); git history was scanned for leaked credentials (none found). The app was **not** built, run, or load-tested, and the production hosting account was not inspected — see the assumptions in §2.9.

Conventions used throughout:

- **Priority:** P0 critical foundation / blocker · P1 MVP · P2 important production functionality · P3 advanced · P4 future.
- **Complexity:** S (days) · M (1–2 weeks) · L (2–4 weeks) · XL (more than 4 weeks, or blocked on outside parties).
- **NEW** marks a file, table, or service that does not exist yet. Any path not marked NEW exists in the repository today.

---

## 1. Executive Summary

**Where the codebase stands.** sfuganda.com today is a single-page marketing site: one route ([src/app/page.tsx](src/app/page.tsx)) composing twelve client-rendered sections, with copy and figures hard-coded in [src/data/content.ts](src/data/content.ts). It has two server endpoints — a Stripe Checkout session creator and a volunteer-signup forwarder — and nothing else on the server. There is **no database, no authentication, no user accounts, no admin area, no file upload, no stored donation records, no background jobs, no tests, no lint configuration, and no CI**. About 5,400 lines of TypeScript in total.

**What that means for the blueprint.** The blueprint describes a role-based, multi-entity records system with financial integrity guarantees. Of its 33 feature areas, **none is already implemented**, four have presentational pieces that can be reused, and the rest are new. The blueprint's phrase "adapt to the existing technology stack" assumes more of a stack than exists. This is a build of a new application *behind and around* a small, well-made front end.

**Architecture verdict: retain and extend — do not rebuild.** The front end (Next.js 15 App Router, React 19, TypeScript strict, a clean token-based design system) is sound and is the right base. Rebuilding it would throw away the only finished part. What must be added is the entire trusted server side. The chosen stack is an **Express API on MongoDB, with Cloudflare** (R2 storage, Stream video, CDN, WAF, Turnstile) — a separate backend service beside the Next.js front end. That stack can carry this platform, but not without cost: MongoDB does not enforce relationships or cross-record rules the way a relational database does, so the financial ledger depends on a specific set of compensating controls (§8.1, §13). They are part of the plan, not optional extras. Details in §8.

**The blueprint's 13–18 week estimate does not survive contact with the codebase.** It presumes existing auth, database and admin. A realistic figure for one senior full-stack developer is **13–17 working weeks for the MVP** and **roughly 36–48 working weeks for the full blueprint**, excluding waits on legal review and social-platform app approvals (§24.2). Two developers can bring the MVP to about 10–12 calendar weeks.

**What to build first.** (1) Fix the problems on the live site that undermine the transparency claim itself — invented fundraising totals, an unverifiable "100% to the children" statement, stock photos of children with invented names, and silent data loss in the volunteer endpoint. (2) Lay the platform foundation: database, auth, RBAC, audit log. (3) Media pipeline. (4) Projects → accomplishments → approval → public pages. (5) A minimal, append-only donation and expense ledger so public project summaries come from records rather than typed-in numbers.

**Biggest risks.** Child safeguarding (the thread asks for "pictures and stories for each child", which the blueprint's own §6 forbids in that form); financial claims without a legally registered entity behind them (the site itself lists registration as an unfunded goal); financial records treated as editable CRUD; large video uploads over Ugandan mobile networks; and automatic social cross-posting, which depends on third-party app reviews outside the team's control.

**Twelve questions need answers from James/Leon before the affected work starts** — they are collected in §28.3. The three that block the MVP are: who legally receives the Stripe funds, what the safeguarding and consent policy is for images of children, and which fundraising goal is real ($15,000 on the site, $1,500 in the blueprint, "500k" in the last message).

---

## 2. Current Codebase Assessment

### 2.1 Inventory

| Area | What exists | Evidence |
|---|---|---|
| Framework | Next.js 15.5.19 (App Router), React 19.0.0, TypeScript 5.7 strict | [package.json](package.json), [tsconfig.json](tsconfig.json) |
| Styling | styled-components v6 with SSR registry; theme tokens | [src/lib/registry.tsx](src/lib/registry.tsx), [src/lib/providers.tsx](src/lib/providers.tsx), [src/styles/theme.ts](src/styles/theme.ts) |
| Animation | framer-motion 12 | used in nearly every component |
| 3D | three + @react-three/fiber installed; one scaffold component, **not mounted** | [src/components/three/HopeScene.tsx](src/components/three/HopeScene.tsx) |
| Routes (pages) | `/` only | [src/app/page.tsx](src/app/page.tsx), [src/app/layout.tsx](src/app/layout.tsx) |
| Routes (API) | `POST /api/checkout`, `POST /api/volunteer` | [src/app/api/checkout/route.ts](src/app/api/checkout/route.ts), [src/app/api/volunteer/route.ts](src/app/api/volunteer/route.ts) |
| Content | One TypeScript module of constants | [src/data/content.ts](src/data/content.ts) |
| UI primitives | Button, Container/Section, Field/Input/Textarea/Checkbox, Logo, Reveal, SectionLabel, StatCounter | [src/components/ui/](src/components/ui/) |
| Sections | Hero, ImpactCounter, OurStory, AreasOfImpact, ImpactMap, FeaturedStories, OrphanageHub, SponsorChild, Volunteer, Transparency, Testimonials, FinalCTA | [src/components/sections/](src/components/sections/) |
| Integrations | Stripe REST (no SDK), Resend REST, a generic outbound webhook | the two route files |
| Env vars | `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_SITE_URL`, `VOLUNTEER_WEBHOOK_URL`, `RESEND_API_KEY`, `VOLUNTEER_NOTIFY_TO`, `VOLUNTEER_NOTIFY_FROM` | [.env.example](.env.example) |
| Docs | README (stale — describes the site before the API routes existed); a volunteer feature proposal | [README.md](README.md), [docs/VOLUNTEERS_FEATURE.md](docs/VOLUNTEERS_FEATURE.md) |
| Git | Two commits (26 Jun, 16 Jul 2026); remote `github.com/CodeHub12343/sfunganda` | `git log` |

### 2.2 Audit by concern

| Concern | Finding |
|---|---|
| Database / data models | **None.** No ORM, no schema, no migrations, no seed. TypeScript types in `content.ts` (`Orphanage`, `Story`, `Region`, `Stat`) are display shapes, not persisted models. |
| Authentication | **None.** No sessions, cookies, providers, or `middleware.ts`. |
| Authorization / roles | **None.** Both API routes are anonymous. |
| Admin / dashboard / CMS | **None.** Content changes require a code edit and redeploy. |
| Project functionality | Display only: `orphanages[]` renders three "funding goal" cards with a progress bar computed in the browser from constants ([OrphanageHub.tsx:158](src/components/sections/OrphanageHub.tsx#L158)). |
| Media upload / storage | **None.** `public/` holds one favicon. All photos are hot-linked Unsplash stock images applied as CSS backgrounds. `next/image` is configured ([next.config.mjs:7-12](next.config.mjs#L7-L12)) but never used. No `<video>` anywhere. |
| Donations | Stripe Checkout session creation only. **No webhook, no persistence.** The site cannot know a donation happened, its amount, donor, or purpose. Success is inferred client-side from a `?donation=success` query string ([DonationStatus.tsx:58-69](src/components/layout/DonationStatus.tsx#L58-L69)), which anyone can type. |
| Notifications / email | One transactional email to staff on volunteer signup via Resend ([volunteer/route.ts:101-134](src/app/api/volunteer/route.ts#L101-L134)). No templates, no user-facing email, no preferences, no unsubscribe. |
| Validation | Hand-written in both routes. No schema library, no length limits, no shared client/server rules (the volunteer rules are duplicated in [Volunteer.tsx:265-279](src/components/sections/Volunteer.tsx#L265-L279)). |
| Error handling | `try/catch` with generic JSON errors in routes. No `error.tsx`, `not-found.tsx`, or `global-error.tsx`. |
| Logging / monitoring | `console.log` / `console.error` only. No error tracking, uptime checks, or health endpoint. |
| Testing | **None.** No test runner, no test files. |
| Lint / format | `npm run lint` calls `next lint`, which is deprecated in Next 15.5 and has no config file here, so it would prompt interactively and cannot run in CI. No Prettier. |
| CI/CD | **None.** No `.github/`, no pipeline. |
| Deployment config | None in the repo (no `vercel.json`, Dockerfile, or `.vercel/`). README says "Vercel-ready". |
| Security controls | Honeypot on the volunteer form. Nothing else: no rate limiting, no security headers or CSP, no CSRF consideration (not yet needed without cookies), no bot protection on checkout. |
| Secrets | `.env.local` is git-ignored and was never committed. It contains a **live** Stripe key (`sk_live_` prefix) on the development machine. |
| Performance | Entire page is client components; three.js packages are installed but tree-shaken out since unused. Stock images load at `w=1400` as CSS backgrounds, with no lazy loading or responsive sizes — poor on slow networks. |
| Accessibility | Good baseline: semantic sections, `:focus-visible`, `prefers-reduced-motion` honoured, labelled form fields. Gaps listed in §5. |
| Responsive | Mobile-first with `media` helpers; solid. |
| SEO | Title/description/OpenGraph metadata in layout. No `robots`, `sitemap`, OG image, structured data, or per-page metadata (only one page). |
| Caching | Framework defaults; nothing dynamic to cache yet. |
| Backup / recovery | Nothing to back up except the volunteer sink (an external sheet, if configured). |

### 2.3 Request flow today

```
Browser ──► /                      static shell + client JS, content from content.ts
Browser ──► POST /api/checkout ──► Stripe API ──► returns hosted Checkout URL
            (donor pays on Stripe; site never hears the result)
Browser ──► POST /api/volunteer ─► optional webhook  +  optional Resend email  (or console.log)
```

### 2.4 What is genuinely good

- Clear separation of tokens, primitives, sections, and content. New pages can be composed from the same parts.
- TypeScript strict passes cleanly.
- The Stripe integration uses hosted Checkout, so no card data touches the site.
- Motion respects reduced-motion preferences globally ([GlobalStyles.tsx:33-45](src/styles/GlobalStyles.tsx#L33-L45)).
- Secrets were kept out of git from the first commit.

### 2.5 Defects found that matter regardless of the new features

| # | Defect | Evidence | Consequence |
|---|---|---|---|
| D1 | Sink failures are not detected. `fetch` only rejects on network errors; a 4xx/5xx from the webhook or Resend resolves normally and is counted as success. | [volunteer/route.ts:91-99](src/app/api/volunteer/route.ts#L91-L99), [:121-133](src/app/api/volunteer/route.ts#L121-L133), [:162](src/app/api/volunteer/route.ts#L162) | Volunteer signups can be lost while the user sees "You're in!". |
| D2 | Full PII, including postal address, is written to server logs when no sink is configured. | [volunteer/route.ts:169](src/app/api/volunteer/route.ts#L169) | Personal data in log retention. |
| D3 | `address` is passed through unvalidated as whatever object the client sent; no field has a length cap. | [volunteer/route.ts:83](src/app/api/volunteer/route.ts#L83) | Arbitrary payload forwarded to the sheet and email. |
| D4 | No rate limiting on either endpoint (the volunteer doc planned it; it was not built). | both routes | Email/sheet flooding; checkout session spam against the Stripe account. |
| D5 | Donation amount is silently rounded to whole dollars. | [checkout/route.ts:48](src/app/api/checkout/route.ts#L48) | A donor entering 10.50 is charged 11. |
| D6 | Redirect origin falls back to the request's `Origin` header if the env var is unset. | [checkout/route.ts:24-30](src/app/api/checkout/route.ts#L24-L30) | Low risk, but the success URL becomes caller-controlled. Make the env var mandatory. |
| D7 | Fundraising figures are constants presented as live progress. | `raised: 150 / 1800 / 2400` at [content.ts:307](src/data/content.ts#L307), [:324](src/data/content.ts#L324), [:341](src/data/content.ts#L341); bar fixed at 45% at [StickyDonate.tsx:113](src/components/layout/StickyDonate.tsx#L113) | Public numbers with no record behind them. |
| D8 | "100% to the children" is stated twice while card-processing fees are deducted and the blueprint itself calls for an "Operational Expenses" line. | [content.ts:391](src/data/content.ts#L391), [SponsorChild.tsx:408](src/components/sections/SponsorChild.tsx#L408) | Unverifiable financial claim. |
| D9 | Per-amount impact statements are computed from invented ratios ("meals for *amount ÷ 2* children"). | [SponsorChild.tsx:287-293](src/components/sections/SponsorChild.tsx#L287-L293) | Same. |
| D10 | Stock photographs of identifiable children are paired with invented names, ages, and first-person quotes. A one-line "representative journeys" note is the only disclosure. | [content.ts:229-285](src/data/content.ts#L229-L285), [FeaturedStories.tsx:171-174](src/components/sections/FeaturedStories.tsx#L171-L174) | Trust and safeguarding problem on a site whose next feature is "verified" records. |
| D11 | Every footer link and every transparency "document" is `href="#"`. | [Footer.tsx:112](src/components/layout/Footer.tsx#L112), [Transparency.tsx:146](src/components/sections/Transparency.tsx#L146) | Dead links under the heading "Trust isn't claimed. It's shown." |
| D12 | No privacy policy or terms, although the site collects names, emails, phones, and postal addresses. | no such route | Compliance gap. |

D7–D11 are P0 because the portal's whole premise is that public figures come from verified records. They can be fixed in days by removing or relabelling, long before the ledger exists.

### 2.6–2.8 Not applicable

No existing data to migrate, no existing users, no existing roles.

### 2.9 Assumptions (stated because they could not be verified from the repository)

1. **Hosting is Vercel.** The README says so and `.gitignore` lists `.vercel`, but there is no project link in the repo. This now concerns only the Next.js front end; the Express API and worker are hosted separately (§21).
2. **The Stripe account's legal owner is unknown.** The site says the foundation is still raising $1,000 for legal registration ([content.ts:198-205](src/data/content.ts#L198-L205)); footer contact is `hello@honestneed.com`. Funds may be flowing to Honest Need or to an individual.
3. **Whether `VOLUNTEER_WEBHOOK_URL` / Resend are set in production is unknown.** If neither is set, signups exist only in host logs.
4. **Historical donations exist only in Stripe.** They can be backfilled from the Stripe API.
5. **Team size is one or two developers** (Creative Design Networks), with James as decision-maker and Leon as primary field user.

---

## 3. Existing Architecture

```
┌────────────────────────── Next.js app (single deployable) ──────────────────────────┐
│  app/layout.tsx ── Providers (styled-components registry + ThemeProvider)           │
│  app/page.tsx ──── 12 "use client" sections ◄── data/content.ts (constants)         │
│  app/api/checkout/route.ts ─────► Stripe REST                                       │
│  app/api/volunteer/route.ts ────► webhook URL / Resend REST / console               │
└──────────────────────────────────────────────────────────────────────────────────────┘
        no database · no auth · no storage · no queue · no observability
```

Characteristics:

- **Stateless.** Nothing is persisted by the application.
- **Client-heavy.** Every component, including static ones, is marked `"use client"` because styled-components requires it. Server Components are used only for the two root files.
- **Content as code.** `content.ts` is the CMS.
- **Direct REST calls** to third parties, no SDKs, no retry, no idempotency keys, no webhook receivers.
- **Single tenant, single page.** Navigation is in-page anchors ([content.ts:37-44](src/data/content.ts#L37-L44)); `Logo` links to `#top` ([Logo.tsx:50](src/components/ui/Logo.tsx#L50)); `Button` is always an `<a>` ([Button.tsx:72](src/components/ui/Button.tsx#L72)). None of this works unchanged once there is a second route.

---

## 4. Existing Features That Can Be Reused

| Existing asset | Reuse for | Change needed |
|---|---|---|
| [theme.ts](src/styles/theme.ts) tokens | Entire portal and admin. The blueprint's palette (forest green, white, gold, warm earth) is already present as `forestGreen`, `hopeGold`, `warmCream`. | Add semantic status colours (draft / pending / approved / rejected) and a denser spacing/type scale for admin tables. |
| [Container.tsx](src/components/ui/Container.tsx) `Container`, `Section` | All public pages | None |
| [Button.tsx](src/components/ui/Button.tsx) | All CTAs | Make polymorphic (`<a>`, `next/link`, `<button type>`), add `loading`/`disabled`. Then delete the two hand-copied button clones in [SponsorChild.tsx:213-237](src/components/sections/SponsorChild.tsx#L213-L237) and `Volunteer.tsx`. |
| [Field.tsx](src/components/ui/Field.tsx) `Field`, `Input`, `Textarea`, `Checkbox` | Every form (field report, admin CRUD, sign-in) | Add `Select`, `RadioGroup`, `DateInput`, `MoneyInput`, `FileDrop`. Wire `aria-describedby` to the error text. |
| [StatCounter.tsx](src/components/ui/StatCounter.tsx) + [ImpactCounter.tsx](src/components/sections/ImpactCounter.tsx) | Portal dashboard statistics, `/impact` | Take data via props from a server component instead of importing constants. |
| [OurStory.tsx](src/components/sections/OurStory.tsx) timeline (track, dot, item) | Accomplishments timeline | It is a fixed three-column horizontal layout; extract the dot/track styling into a vertical, paginated `Timeline` component. |
| [OrphanageHub.tsx](src/components/sections/OrphanageHub.tsx) card + `Track`/`Fill` progress bar | Project cards, funding progress, milestone progress | Extract `ProgressBar` and `ProjectCard`; percentage comes from the server. The same bar is duplicated in `StickyDonate.tsx`. |
| [ImpactMap.tsx](src/components/sections/ImpactMap.tsx) | Community map (MVP version) | Its outline is explicitly decorative ([:125](src/components/sections/ImpactMap.tsx#L125)) and pins are placed by percentage. That is acceptable — even desirable — for approximate locations in the MVP. Replace with a real map library in P2. |
| [Transparency.tsx](src/components/sections/Transparency.tsx) stat cards and document tiles | `/transparency` page | Feed from ledger aggregates; tiles link to real published documents. |
| [FeaturedStories.tsx](src/components/sections/FeaturedStories.tsx) before/after rows | Before-and-after gallery captions | Add an image comparison slider (NEW). |
| [DonationStatus.tsx](src/components/layout/DonationStatus.tsx) banner | Generic toast/notice component | Generalise; keep the donation use. |
| [Volunteer.tsx](src/components/sections/Volunteer.tsx) form state machine (`idle → submitting → success/error`), conditional fields with `AnimatePresence` | Pattern for the mobile field-report form | Extract a small `useFormSubmit` hook. |
| [checkout/route.ts](src/app/api/checkout/route.ts) | Donation entry point | Add project designation metadata, cents-accurate amounts, idempotency key, rate limit; pair with a webhook receiver (NEW). |
| [volunteer/route.ts](src/app/api/volunteer/route.ts) | Volunteer records; later "volunteer hours" statistic | Persist to the database; fix D1–D4. |
| Resend integration | All transactional email | Move behind a mail service with templates and delivery logging. |
| `next/font` setup, metadata base in [layout.tsx](src/app/layout.tsx) | All pages | Add per-route `generateMetadata`. |

Not reusable: `HopeScene.tsx` and the three.js dependencies (unused; remove or defer to the P4 "3D community model" idea), and the constants in `content.ts` that represent facts (stats, raised amounts, stories) — those become database-driven.

---

## 5. Current Technical Debt

Ordered by how much it obstructs the new work.

| # | Debt | Why it matters now | Fix in |
|---|---|---|---|
| T1 | No persistence layer of any kind | Blocks every feature | Phase 1 |
| T2 | No auth, sessions, or roles | Blocks admin, field reporting, supporters | Phase 1 |
| T3 | No Stripe webhook; donations unrecorded | "Total contributions" cannot be computed; supporter dashboards impossible | Phase 4 |
| T4 | Facts hard-coded as constants (D7–D10) | Contradicts the portal's purpose | Phase 0 |
| T5 | No tests, lint config, or CI | Financial and permission logic cannot ship untested | Phase 0 |
| T6 | Single-page assumptions in `Navbar`, `Logo`, `Button`, `Footer`, `content.nav` | Break on the first new route | Phase 0 |
| T7 | Everything is a client component; data is imported, not fetched | Public pages must become server-rendered with cached database reads | Phases 1–3 (incremental) |
| T8 | Images via CSS `background-image` from a third-party host | No optimisation, no lazy loading; wrong pattern for an image-heavy portal used on slow connections | Phase 2 |
| T9 | No security headers, CSP, or rate limiting; no `middleware.ts` | Required before any authenticated surface exists | Phase 0–1 |
| T10 | No error boundaries or 404 page; no observability | Cannot operate a multi-user system blind | Phase 0 |
| T11 | Unused dependencies: `three`, `@react-three/fiber`, `@types/three` (the last is in `dependencies`) | Install weight, audit noise | Phase 0 |
| T12 | styled-components is in maintenance mode upstream and forces client rendering | Not urgent; a long-term consideration (decision TD-9) | Re-evaluate at P4 |
| T13 | Live Stripe key used in local development | One mistaken test creates a real charge; key sits on a laptop | Phase 0 |
| T14 | Accessibility gaps: mobile menu has no focus trap, Escape handler, or `aria-modal` ([Navbar.tsx:203-233](src/components/layout/Navbar.tsx#L203-L233)); the frequency toggle uses tab roles without tab panels ([SponsorChild.tsx:308](src/components/sections/SponsorChild.tsx#L308)); map pins are 20–26px targets ([ImpactMap.tsx:39-40](src/components/sections/ImpactMap.tsx#L39-L40)); the Logo's SVG gradient `id` is duplicated when the logo renders more than once ([Logo.tsx:54](src/components/ui/Logo.tsx#L54)) | Portal must pass an accessibility audit (§23 of the blueprint) | Phase 0 / Phase 5 |
| T15 | Stale docs: README predates the API routes; the volunteer doc is marked "Proposal" though implemented | Misleads the next developer | Phase 0 |
| T16 | A no-op expression in global styles ([GlobalStyles.tsx:31](src/styles/GlobalStyles.tsx#L31)) | Cosmetic | Phase 0 |

---

## 6. SF Uganda Requirements Summary

The requirements file contains two layers. Both are in scope.

### 6.1 Requests from the message thread (not in the formal blueprint)

| Ref | Date | Request | Notes |
|---|---|---|---|
| R-A | 26 Aug | Leon will send "pictures and stories for each child to be added to sfuganda.com" | **Conflicts with blueprint §6 and §8** (no full names, exact locations, or personal histories of children in public). Needs a safeguarding decision before any work — §19.3. |
| R-B | 3 Sep | Give Leon website access to upload a video daily; videos show on the site | Covered by media pipeline + media-manager role. |
| R-C | 3 Sep | After upload, each video "needs to automatically post to his channels" | Third-party publishing APIs; app reviews required. P3. |
| R-D | 3 Sep | "Options to view video summary in any language" | Transcript → AI summary → translation. P3. |
| R-E | 25 Sep | "First self-sustainable community … built to pay it forward to help other orphanages" | Drives the sustainability tracker and inter-organisation transfers (future). |
| R-F | 25 Sep | "Most orphanages after Sarah's Foundation will be the same setup just different details" | Multi-organisation data model from day one (§8.6). |
| R-G | 25 Sep | "Add the picture to sfuganda.com and say we are raising 500k to start this land project" | The picture is not in the repository; currency and relation to the existing $15,000 goal are unstated. Needs clarification (§28.3 Q3). |

### 6.2 The blueprint, grouped

| Group | Blueprint sections | Core content |
|---|---|---|
| Records | §1, §3, §5 | Accomplishments with permanent IDs (`SFU-2026-0001`), timeline, detail pages with description, financials, media, challenges, next steps, related items |
| Projects | §4 | Projects with weighted milestones; progress computed, not typed; per-stage history |
| Media | §6, R-B | Photos, video, before/after sliders; safeguarding for images of children |
| Finance | §7, §8, §9, §10 | Transparency centre; fund separation (donations, loans, business revenue, restricted, children's funds); children's future fund with private per-child records; sustainability ratio; per-business tracking |
| Geography | §11 | Map with approximate locations |
| Supporters | §12, §13 | Accounts, impact dashboard, receipts, follow projects, notifications with preferences |
| Administration | §14, §19 | Eight roles, nine-step approval workflow, mobile field reporting |
| Automation | §15, §16, R-C, R-D | AI drafting assistant (never auto-publishes, never invents facts); monthly/annual PDF reports |
| Presentation | §2, §17 | Dashboard of 15 statistics computed from approved records; navigation and URL structure |
| Non-functional | §18, §23 | Secure storage, backups, encryption, audit logging; acceptance demo: phone submission → approval → public page → stats update |
| Future | §22, R-F | Multi-community, multi-organisation, translation, QR codes, certificates |

The blueprint's own acceptance test (§23) is adopted as the MVP exit criterion in §23 of this document.

---

## 7. Feature-by-Feature Gap Analysis

Classification key: **A** already implemented · **B** partially implemented · **C** can be extended from existing functionality · **D** requires new implementation · **E** requires architectural refactoring · **F** requires external service · **G** requires business clarification · **H** legally or safeguarding sensitive, needs review. A feature can carry more than one.

No feature is classified **A**.

For each feature the table gives the classification with its reason, reusable code, dependencies, priority and complexity. Database, API, and UI work per feature is specified once, in §9, §10 and §11, and security and test obligations in §19 and §20, to avoid repeating them 33 times.

| # | Feature | Class | Why / existing code | Must be created | Depends on | Pri | Cx |
|---|---|---|---|---|---|---|---|
| 1 | Accomplishments portal (`/accomplishments`, dashboard) | D, C | No records exist. Layout primitives and `ImpactCounter` are reusable. | Tables, services, public pages, admin CRUD | 14, 20, 21, 23 | P1 | L |
| 2 | Accomplishments timeline | C, D | `OurStory.tsx` timeline styling is reusable; it is static and horizontal. | Vertical paginated timeline fed by query; filters by project/category/year | 1 | P1 | M |
| 3 | Individual accomplishment pages | D | Nothing. | `/accomplishments/[publicId]`, revisioned content, related items, media, financial block | 1, 7, 9 | P1 | M |
| 4 | Project development tracker | C, D | `OrphanageHub.tsx` cards and progress bar; data is three constants. | `projects`, per-project dashboard, stage history | 20, 32 | P1 | L |
| 5 | Milestones and progress calculation | D | Progress today is `raised/goal` in the browser. | Weighted milestones; server-side calculation | 4 | P1 | M |
| 6 | Before-and-after gallery | C, D | `FeaturedStories.tsx` has before/after *text*. No slider, no real images. | Paired media model; comparison slider component | 7, 31 | P2 | M |
| 7 | Photo and video management | D, F | No upload or storage. | Object storage, managed video, processing, library UI | 20, 30 | P1 | L |
| 8 | Financial transparency centre | C, D, G | `Transparency.tsx` shows four constants and dead links. | Ledger aggregates, per-project breakdown, published documents | 9, 10 | P2 (summary P1) | L |
| 9 | Financial transaction tracking | D, E | Nothing is recorded. | Append-only ledger, approvals, documents, corrections by reversal | 20, 21, 30 | P1 (core) | XL |
| 10 | Donation allocation tracking | C, D, F | `checkout/route.ts` creates sessions with no designation and no record. | Stripe webhooks, donations table, allocation to funds/projects, offline donations | 9 | P1 (capture) / P2 (allocation) | L |
| 11 | Children's future fund | D, G, H | Nothing. | Private beneficiary records, per-child sub-ledger, public aggregate only | 9, 31; legal sign-off | P3 | L |
| 12 | Self-sustainability tracker | D, G | Mentioned only as copy. | Recurring income vs. operating expense classification; ratio per community per month | 9, 13 | P2 | M |
| 13 | Community business portal | D | Nothing. | Businesses, revenue/expense/production records | 9, 32 | P2 | L |
| 14 | Community development map | B, C, F | `ImpactMap.tsx` is a decorative outline with percentage pins. | Communities with approximate coordinates; real map later | 32, 31 | P1 (stylised) / P2 (real map) | M |
| 15 | Supporter accounts | D | No accounts. | Auth for supporters, profile, link to donations by verified email | 20, 10 | P2 | M |
| 16 | Supporter impact dashboard | D | Nothing. | `/dashboard`, contribution history, receipts | 15, 10 | P2 | M |
| 17 | Project following | D | Nothing. | Follow table, UI | 15, 4 | P2 | S |
| 18 | Automated progress notifications | C, D, F | Resend call exists for one staff email. | Outbox, templates, preferences, unsubscribe, delivery log | 15, 17, 21 | P2 | L |
| 19 | Administrative management system | D | Nothing. | `/admin` shell and all management screens | 20 | P0/P1 | XL |
| 20 | Role-based access control | D, E | Nothing. | Roles, scoped assignments, policy layer, middleware | — | P0 | L |
| 21 | Approval workflows | D | Nothing. | State machine, approval events, separation of duties | 20 | P1 | L |
| 22 | Mobile field reporting | C, D | `Volunteer.tsx` is the form pattern; `Field.tsx` primitives. | Field form, drafts, resumable upload, idempotent submit | 7, 20, 21 | P1 | L |
| 23 | Media uploads | D, F | Nothing. | Signed direct uploads, validation, scanning, derivatives | 7 | P1 | (in 7) |
| 24 | AI accomplishment assistant | D, F | Nothing. | Server-side drafting with grounding checks and logging | 1, 21 | P3 | M |
| 25 | Monthly impact reports | D | Nothing. | Report compilation from approved records | 1, 9, 12 | P2 | M |
| 26 | Annual impact reports | D | Nothing. | Same, with year-over-year | 25 | P3 | S |
| 27 | PDF generation | D | Nothing. | Server-side PDF in a background job | 25 | P2 | M |
| 28 | Impact statistics | C, D, G | `StatCounter`, `ImpactCounter` render constants. Several stats (meals, volunteer hours, jobs) have no defined data source. | Metric entries tied to approved records; aggregate queries | 1, 9 | P1 (subset) | M |
| 29 | Public transparency features | B, D | Section exists with placeholder content. | Real documents, redaction workflow, public financial archive | 8, 9 | P2 | M |
| 30 | Security and audit logging | D | Honeypot only. | Audit log, headers, rate limits, MFA, session policy | — | P0 | L |
| 31 | Privacy and child safeguarding | D, G, H | A "privacy-safe representative journeys" comment ([content.ts:229](src/data/content.ts#L229)); no policy, no controls. | Consent records, media flags, EXIF stripping, visibility tiers, policy pages | 20 | P0 | M + legal |
| 32 | Multi-community architecture | D | `orphanages[]` naming hints at it; single tenant. | `communities` entity; all records scoped | — | P0 (schema) | S |
| 33 | Multi-foundation expansion | D, E, G | Brand and copy are constants. | `organizations` entity and scoping from day one; tenant routing later | 32 | P0 (schema) / P4 (product) | S now, L later |
| — | R-C social auto-posting | D, F, G | Share-intent links exist in `Volunteer.tsx` (not publishing). | OAuth connections, per-platform publishers, status tracking | 7 | P3 | XL |
| — | R-D multilingual video summaries | D, F | Nothing. | Transcription, summary, translation cache | 7, 24 | P3 | M |

**Items requiring business clarification before implementation (G):** 8, 10, 11, 12, 28, 31, 33, R-A, R-C, R-G — see §28.3.
**Items requiring legal or safeguarding review (H):** 11, 31, R-A, and tax receipts under 16.

---

## 8. Recommended Target Architecture

### 8.1 Verdict and stack decision

**Retain the front end; add a separate backend service beside it.**

- **Retain:** Next.js App Router, React, TypeScript, the theme and UI primitives, Stripe Checkout, Resend.
- **Modify:** routing (multi-page), `Button`/`Navbar`/`Footer`/`Logo`, how content reaches components (fetched from the API by server components instead of imported constants). The two existing Next.js API routes are fixed in place in Phase 0 and then moved into the Express API.
- **Add:** an Express API and a worker process (TypeScript, one codebase in a NEW `server/` directory), MongoDB, an auth system, a central policy module, Cloudflare R2 and Stream, an outbox, observability, tests, CI.

**Chosen stack (revision 2)**

| Layer | Choice | Role |
|---|---|---|
| Front end | Existing Next.js app | Public pages, admin, field, and supporter UI. No business logic, no database access. |
| API | **Express** (Node 20+, TypeScript) | All business rules, permissions, and data access |
| Worker | Same codebase as the API, second process | Outbox handlers, media processing, scheduled jobs |
| Database | **MongoDB** as a replica set (MongoDB Atlas) | All application data |
| Edge and media | **Cloudflare**: DNS, CDN, WAF and rate-limiting rules, Turnstile, R2 (files), Stream (video) | Delivery, protection, storage |

**Can this stack carry the platform?** Yes — with conditions. An honest assessment of each part:

| Part | Assessment |
|---|---|
| **Cloudflare** | Strong fit. R2 and Stream cover the storage and video needs in §14 directly; the WAF and Turnstile cover edge rate limiting and bot protection that the first revision listed as separate items to source. |
| **Express** | Works well. It costs a second deployable to build, secure, deploy and monitor. In return, an always-on process removes the constraints of serverless functions: a real background worker, no request-size limits, long-running jobs such as PDF rendering and image processing. |
| **MongoDB — content side** | Natural fit. Accomplishments with revisions, media, projects with milestones, and reports are document-shaped. |
| **MongoDB — financial side** | Workable, but it is where this stack is weakest, and the reason the first revision recommended PostgreSQL. The table below lists what a relational database would have enforced by itself and what must replace it. |

**Compensating controls required by the choice of MongoDB**

| A relational database would give | MongoDB situation | Required replacement |
|---|---|---|
| Foreign keys (a transaction cannot reference a non-existent fund or project) | No referential integrity | Services verify every reference inside the same transaction; a **nightly integrity job** scans for orphaned or dangling references and alerts |
| Triggers that reject edits to posted financial rows | No blocking triggers | Posted money lives in a separate **insert-only collection** (`ledger_entries`). The API's database user is given only `find` and `insert` on it through a custom database role, so an update or delete is refused by MongoDB itself |
| Check constraints across columns and rows (lines sum to zero; approver ≠ creator) | Per-document validation only | `$jsonSchema` validators with `validationAction: "error"` on every collection; `$expr` rules for same-document comparisons; cross-document rules in services and re-verified by the integrity job |
| Multi-row ACID transactions | Supported on replica sets | **Multi-document transactions** with majority write concern for every state change that touches more than one document; retry on transient errors |
| Row locks for gapless ID allocation and job claiming | No explicit locks | Atomic `findOneAndUpdate` (`$inc` for counters; status flip for job claims) |
| Exact numeric types | JavaScript numbers are floating point | Money stored as BSON 64-bit integers (`Long`) in minor units; validators require `bsonType: "long"`; a lint rule forbids arithmetic on amounts outside the money module |
| Row-level security for beneficiary data | Not available | A **separate database with its own database user**, reachable only from one service module, plus field-level encryption |
| Views with fixed column lists for public data | Read-only views exist | Public endpoints read through MongoDB views with explicit `$project` allow-lists, using a database user that can read only those views |
| A fixed schema changed by reviewed migrations | Schemaless by default | Mongoose schemas with `strict: "throw"`; validators, indexes and roles managed by versioned migration scripts |

If these controls are built and tested as specified (§13, §20), the result is sound for an organisation of this size. If they are skipped under time pressure, the ledger becomes ordinary editable data — which is the outcome this roadmap exists to prevent. Risk R27 tracks this.

### 8.2 Evaluation against the required qualities

| Quality | Current | Target approach |
|---|---|---|
| Scalability | Trivially scalable because it is static | Public pages served from cache with tag-based revalidation on publish; database behind a pooled connection; media on object storage and CDN. Expected load is small (thousands of visits a day at most); the design need not be exotic. |
| Maintainability | Good structure, no tests | Layered: routes → services → repositories; shared zod schemas; CI gates |
| Security | Minimal | §19 |
| Data integrity | n/a | MongoDB multi-document transactions for every multi-document state change; `$jsonSchema` validators and unique indexes; reference checks in services plus a nightly integrity job (MongoDB has no foreign keys) |
| RBAC | None | Central `can(actor, action, resource)` policy; enforced in services, never only in UI |
| Financial integrity | None | Insert-only ledger collection (the API's database user has no update or delete privilege on it); maker-checker; nightly verification (§13) |
| Media storage | None | Private bucket for originals; processed public derivatives; never the app filesystem |
| Large video uploads | Impossible (serverless request bodies are capped at a few MB) | Browser uploads directly to the video provider with a resumable protocol; the app only issues upload tickets and receives webhooks |
| Concurrent users | n/a | Optimistic concurrency (`version` field) on editable documents; atomic `findOneAndUpdate` for ID allocation and job claims |
| Public traffic | Fine | Cached server-rendered pages; DB outage does not take down already-cached pages |
| Admin traffic | n/a | Low volume; dynamic rendering, no caching |
| Mobile field submissions / slow networks | n/a | Text-first submit, client-side image compression, resumable uploads, idempotency keys, local drafts (§16) |
| Background jobs | None | Transactional outbox + workers (§18) |
| Notifications | One inline email | Outbox-driven, preference-aware, logged |
| Report generation | None | Background job → stored PDF |
| AI | None | Server-only, assistive, logged, grounded (§17) |
| Auditability | None | Append-only `audit_log` written in the same transaction as the change |
| DB consistency | n/a | Single MongoDB replica set; no dual writes — external effects go through the outbox |
| Backup / DR | None | Atlas continuous backup with point-in-time restore; nightly dump to R2; write-once media originals with a second copy; quarterly restore drill |
| Observability | `console.*` | Error tracking, structured logs with request IDs, health endpoint, uptime checks |
| Deployment reliability | Manual | CI-gated deploys, preview environments, migrations as a pipeline step, instant rollback of the app tier |

### 8.3 Target component diagram

```
                              ┌────────────── Cloudflare (DNS · CDN · WAF · rate limits · Turnstile) ──────────────┐
  Public visitors ──────────► │                                                                                    │
  Supporters ───────────────► │   www.sfuganda.com ──► Next.js front end (existing app, extended)                  │
  Staff / field ────────────► │        public pages: server-rendered, cached, tag-revalidated                      │
                              │        /admin /field /dashboard: dynamic                                           │
                              │        /api/v1/*  ── forwarded ──►  Express API  (NEW, always-on Node process)     │
                              │                                      routes → services → policy · audit · outbox   │
                              └──────────────────────────────────────────────┬─────────────────────────────────────┘
                                                                             │ MongoDB driver (transactions)
                                    ┌────────────────────────────────────────▼───────┐
                                    │  MongoDB Atlas (replica set)                   │
                                    │   main database        private database        │
                                    │   (app user; insert-   (beneficiary user;      │
                                    │    only on ledger,      encrypted fields)      │
                                    │    audit, approvals)                           │
                                    └────────────────────▲───────────────────────────┘
                                                         │ outbox
                                    ┌────────────────────┴───────────────────────────┐
                                    │  Worker process (same codebase as the API)     │──► Resend (email)
                                    │   outbox handlers · image processing ·         │──► Next.js revalidation route
                                    │   scheduled jobs · integrity checks · PDFs     │──► AI provider · social (P3)
                                    └────────────────────────────────────────────────┘
   Browser ══ presigned multipart, direct ══► Cloudflare R2   (private originals / public derivatives)
   Browser ══ tus resumable, direct ════════► Cloudflare Stream (transcode, HLS, thumbnails) ──webhook──► API
   Stripe ──signed webhook──► Express API  /api/webhooks/stripe
```

### 8.4 Technology choices

The first three rows are decided. The rest are recommendations recorded with alternatives in §26.

| Concern | Choice | Notes |
|---|---|---|
| API framework | **Express** (decided) | TypeScript; `helmet`, strict CORS, JSON body limit, central error handler |
| Database | **MongoDB Atlas**, replica set (decided) | Transactions require a replica set; Atlas clusters are replica sets on every tier. Continuous backup needs a dedicated tier (§21.8). |
| Edge, storage, video | **Cloudflare** (decided) | DNS, CDN, WAF, Turnstile, R2, Stream |
| Data access | Mongoose with `strict: "throw"`, plus the native driver's sessions for transactions | Familiar to MERN developers. Verify during Phase 1 that amounts round-trip as `Long` and never as doubles. |
| Schema management | Versioned migration scripts (for example `migrate-mongo`) that create indexes, `$jsonSchema` validators, views, and database roles | The database, not just the ODM, must reject malformed documents |
| API hosting | An always-on Node host (container or VM platform) in a region close to the Atlas cluster, reachable only through Cloudflare | Not Cloudflare Workers: running Express with the MongoDB driver there is not an established path and has not been verified for this project (TD-18) |
| Front-end hosting | Stays on its current host, placed behind Cloudflare | Moving it onto Cloudflare is possible later (TD-20) |
| Web ↔ API connection | Browser requests go to the site's own origin at `/api/v1/*` and are forwarded to Express, so the session cookie is first-party and no cross-origin rules are needed | TD-19 |
| Auth | Sessions stored in MongoDB (TTL-indexed, revocable); argon2id password hashing or passkeys; **TOTP MFA for staff**; invitations. Use a maintained library with a MongoDB adapter where it covers these, otherwise assemble from well-known components — do not write cryptography | TD-4 |
| Authorisation | Hand-written policy module in the service layer; separate database and user for beneficiary data | One place to read and test every rule |
| Jobs | Transactional outbox collection drained by the worker process | No third-party queue needed (TD-7) |
| Email | Resend (already integrated) | Keep |
| Validation | zod schemas in a NEW `shared/` directory, imported by both the front end and the API | Removes today's duplicated rules |
| Rate limiting | Cloudflare rate-limiting rules at the edge, plus per-user limits in Express backed by MongoDB | |
| Bot protection | Cloudflare Turnstile on volunteer, sign-up, and donation-start forms | Replaces reliance on the honeypot alone |
| Image processing | `sharp` in the worker | Possible because the worker is a normal Node process |
| Charts | Recharts, lazy-loaded | As the blueprint suggests |
| Map | Stylised SVG for MVP; MapLibre GL with a tile provider in P2 | |
| PDF | React-based server PDF renderer run in the worker | |
| AI | A hosted LLM API behind a `DraftingProvider` interface. Recommended default: a current Claude model via the Anthropic API; the blueprint names OpenAI, which fits the same interface | Behaviour is defined by §17, not by vendor |
| Errors / logs | An error-tracking service on web, API, and worker; structured JSON logs | |
| Tests | Vitest (unit; integration against a real MongoDB replica set), supertest (API), Playwright (end-to-end) | |

### 8.5 Rendering and caching model

- **Public pages** are server components that fetch the API's public read endpoints and render existing styled client components with props. Each fetch is tagged (`accomplishments`, `project:{id}`, `stats`, `finance:public`). Approval/publish writes an outbox event whose handler calls a secret-guarded revalidation route on the Next.js app (NEW), which invalidates those tags. Result: fast first paint on slow connections, and an API or database blip does not blank pages that are already cached.
- **Admin, field, and supporter areas** are dynamic and never cached. The browser's session cookie is forwarded to the API on every request.
- **Public read endpoints** return only fields from explicit public projections (§9.6) — never a whole document from a base collection.

### 8.6 Multi-community and multi-organisation

James has said later orphanages will be "the same set up just different details". Retrofitting tenancy into a finished schema is one of the most expensive refactors there is, so:

- **Now (P0):** `organizations` and `communities` collections exist; every domain document carries `organization_id` (and every index starts with it); every service call takes an actor whose organisation scopes all queries; public IDs are prefixed per organisation (`SFU-…`). Brand strings currently in `content.ts` move into an organisation settings record over time.
- **Not now:** tenant sign-up, per-tenant domains, cross-tenant "pay it forward" transfers, tenant admin UI. These are P4 and are additive once the field and scoping exist.

---

## 9. Database Architecture and Schema Changes

### 9.1 Starting point

There is no existing database, so there is nothing to migrate *from* except (a) Stripe's record of past donations and (b) whatever sheet the volunteer webhook writes to. The blueprint lists 29 tables and assumes PostgreSQL. With MongoDB chosen, each "table" below is a **collection**, and the design is adjusted in two directions: toward embedding where a document owns its parts, and toward extra structure where MongoDB would otherwise leave integrity unguarded.

### 9.2 Where this design departs from the blueprint's table list

| Blueprint | This design | Reason |
|---|---|---|
| `roles`, `permissions` tables | Roles as a fixed enum; `role_assignments` with scope; permissions defined in code | Eight roles with stable meanings. A data-driven permission editor adds an attack surface and a test matrix nobody needs. Scoping (which project, which community) is the part that must be data. |
| `business_revenue`, `business_expenses` as separate tables | Ledger entries tagged with `business_id` | Two sources of truth for money guarantee the public totals will disagree. One ledger; businesses are a dimension. |
| `sustainability_metrics` | Computed by aggregation over the ledger (optionally cached in a summary collection rebuilt by a job) | It is a derived number. Storing it as primary data invites drift. |
| `donation_allocations` | Kept, but implemented as ledger transfer transactions | An allocation *is* a movement between funds; it needs the same approval and immutability. |
| `financial_transactions` as one editable table | Split in two: `financial_transactions` (the workflow document, with its lines embedded) and **`ledger_entries`** (insert-only, one document per posted line) | This split is what makes posted money immutable in MongoDB. Balances are computed **only** from `ledger_entries`. |
| `accomplishment_updates` | `accomplishment_revisions` (immutable snapshots, separate collection) | Published content must be reproducible as approved; edits create a new revision that goes back through approval. |
| `accomplishment_approvals` | Generic `approval_events` for any approvable entity, insert-only | Financial transactions, media, and reports need the same trail. |
| `accomplishment_media` | `media_assets` + `media_links` (link with role: cover / gallery / before / after / receipt) | Media attaches to projects, milestones, businesses, and transactions too. |
| `project_tasks` | Omitted for now | Milestones cover the public tracker. Internal task management is a different product. |
| `beneficiary_*` in the same database | A **separate database** with its own database user | MongoDB has no row-level security; isolation is by database and credentials. |
| not listed | `organizations`, `funds`, `outbox_events`, `id_sequences`, `metric_definitions` / `metric_entries`, `consent_records`, `stripe_events`, `ai_generations`, `social_connections` / `social_posts`, `sessions`, `integrity_reports` | Required by tenancy, fund separation, reliable side effects, gapless IDs, verifiable statistics, safeguarding, webhook idempotency, AI logging, R-C, and the nightly integrity job. |

**Embedding rules used:** embed when the parent owns the children, the list is small and bounded, and they are always read together (transaction lines inside a transaction; role assignments could be embedded in the user). Use a separate collection when items are queried independently, grow without bound, or must be immutable by themselves (revisions, approval events, ledger entries, audit log, media).

### 9.3 Entities

Each "table" below is a MongoDB collection and each "column" a field. Common fields on every document unless noted: `_id`, `organization_id`, `created_at`, `created_by`, `updated_at`, and `version` (integer, optimistic concurrency) on editable documents. References between collections are stored IDs with **no database enforcement** — see §9.4 for how they are checked.

**Identity and access**

| Collection | Key fields | Notes |
|---|---|---|
| `organizations` | `slug`, `name`, `public_id_prefix` ('SFU'), `base_currency`, `settings` (JSON: brand strings, safeguarding policy flags) | One row at launch |
| `users` | `email` (unique, case-insensitive), `display_name`, `status` (active / suspended), `mfa_enrolled_at`, `last_login_at` | Staff and supporters share the table; what they can do comes from assignments |
| `role_assignments` | `user_id`, `role` (founder / director / project_manager / finance_manager / media_manager / field_member / supporter), `scope_type` (organization / community / project), `scope_id`, `granted_by`, `revoked_at` | Unique on (user, role, scope). Never deleted; revoked. |
| `sessions` | managed by the auth layer; must be server-revocable | |
| `audit_log` | `actor_id`, `actor_role`, `action`, `entity_type`, `entity_id`, `before` (JSON), `after` (JSON), `ip`, `user_agent`, `request_id`, `at` | **Insert-only**: the API's database user holds only `find` and `insert` on this collection |

**Structure**

| Collection | Key fields | Notes |
|---|---|---|
| `communities` | `name`, `slug`, `region_label` ("Central Uganda"), `public_lat`, `public_lng` (deliberately coarse), `status`, `summary` | Exact coordinates are **never stored in this table** |
| `project_categories` | `name`, `slug` | |
| `projects` | `community_id` (nullable), `category_id`, `slug`, `title`, `summary`, `status` (planned / active / paused / completed / cancelled), `budget_minor`, `budget_currency`, `funding_goal_minor`, `manager_id`, `visibility`, `started_on`, `completed_on` | Unique (`organization_id`, `slug`) |
| `project_milestones` | `project_id`, `title`, `position`, `weight` (integer > 0), `status` (not_started / in_progress / completed / blocked), `responsible_label`, `blocker_note`, `expected_on`, `completed_on` | Progress = Σ weight of completed ÷ Σ weight; computed server-side |

**Accomplishments and approval**

| Collection | Key fields | Notes |
|---|---|---|
| `accomplishments` | `project_id` (required), `milestone_id` (nullable), `public_id` (nullable until published; unique), `status` (see §15), `current_revision_id`, `published_revision_id`, `occurred_on`, `submitted_by`, `idempotency_key` (unique per submitter), `contains_minors` (bool), `ai_assisted` (bool), `published_at` | |
| `accomplishment_revisions` | `accomplishment_id`, `revision_no`, `title`, `body`, `why_it_matters`, `challenges`, `solutions`, `next_steps`, `location_label`, `content_hash` | Immutable once created |
| `approval_events` | `entity_type`, `entity_id`, `revision_id`, `from_status`, `to_status`, `actor_id`, `actor_role`, `comment`, `at` | Append-only. The permanent approval record the blueprint requires. |
| `id_sequences` | `organization_id`, `kind`, `year`, `next_value` | Incremented atomically (`findOneAndUpdate` with `$inc`) inside the publish transaction when allocating `SFU-2026-0001`; allocated at publication so rejected drafts do not consume numbers |
| `metric_definitions` | `key` (meals_provided, homes_constructed, land_acres, jobs_created, volunteer_hours, children_supported…), `kind` (counter / gauge), `unit`, `public_label` | |
| `metric_entries` | `metric_key`, `quantity`, `effective_on`, `accomplishment_id` (nullable), `status`, `approved_by` | Counters are summed; gauges take the latest approved value. This is what makes "automatically calculated from approved records" true. |

**Media**

| Collection | Key fields | Notes |
|---|---|---|
| `media_assets` | `kind` (image / video / document), `storage_key`, `provider` + `provider_asset_id` (video), `mime`, `bytes`, `sha256`, `width`, `height`, `duration_s`, `processing_status`, `scan_status`, `visibility` (private / internal / public), `contains_minors`, `consent_record_id`, `captured_on`, `uploaded_by`, `alt_text`, `caption` | Originals are private. `visibility = public` can only be set by approval. |
| `media_links` | `media_id`, `entity_type`, `entity_id`, `role` (cover / gallery / before / after / receipt / evidence), `position` | |
| `consent_records` | `subject_type` (child / adult / guardian-for-child), `subject_ref` (internal reference, not a name), `scope` (web / social / print), `granted_on`, `expires_on`, `withdrawn_on`, `document_media_id`, `recorded_by` | Withdrawal triggers unpublishing of linked media |

**Finance** (detailed in §13)

| Collection | Key fields | Notes |
|---|---|---|
| `funds` | `code`, `name`, `type` (unrestricted / restricted_project / loan / business / children_future / reserve / operations), `project_id` or `business_id` (nullable), `is_public` | Enforces the blueprint's rule that fund types are never merged into one total |
| `financial_transactions` | `kind` (donation / expense / transfer / loan_receipt / loan_repayment / business_revenue / business_expense / distribution / adjustment / reversal), `status` (draft / submitted / approved / posted / rejected / void), `occurred_on`, `description`, `counterparty_label` (redactable), `reverses_id`, `source` (stripe / manual / import), `external_ref`, `submitted_by`, `approved_by`, `posted_at`, `accomplishment_id` | Header |
| lines (embedded array in `financial_transactions`) | `fund_id`, `project_id`, `business_id`, `category_id`, `amount_minor` (signed 64-bit integer), `currency`, `base_amount_minor`, `fx_rate`, `fx_rate_source` | Editable only while the transaction is a draft |
| `ledger_entries` | One document per posted line: `transaction_id`, `line_no`, all line fields above, `kind`, `occurred_on`, `posted_at`, `posted_by`, `prev_hash`, `hash` | **Insert-only** (database privilege). The single source of every balance and public total. Unique on (`transaction_id`, `line_no`). |
| `expense_categories` | `name`, `is_operating`, `is_recurring_default`, `public_label` | Drives the sustainability ratio |
| `financial_documents` | `transaction_id`, `media_id`, `redacted_media_id`, `doc_type` | Public pages only ever reference `redacted_media_id` |
| `donations` | `transaction_id`, `stripe_payment_intent_id` / `stripe_invoice_id` (unique), `donor_email_hash`, `donor_user_id` (nullable), `gross_minor`, `fee_minor`, `net_minor`, `currency`, `is_recurring`, `designation_project_id`, `donor_country`, `refunded_minor`, `disputed` | Donor email itself is stored once, encrypted, in `supporter_profiles` or a donor contact table |
| `stripe_events` | `event_id` (unique), `type`, `received_at`, `processed_at`, `payload` | Idempotency for webhooks |
| `reconciliations` | `period`, `source` (stripe payout / bank), `expected_minor`, `actual_minor`, `status`, `notes`, `performed_by` | |

**Businesses**

| Collection | Key fields | Notes |
|---|---|---|
| `businesses` | `community_id`, `name`, `slug`, `type`, `status`, `launched_on` | Chicken farm, water exchange, gardens, solar |
| `business_production` | `business_id`, `metric_key` (eggs, litres, kg harvested, kWh), `quantity`, `period_start`, `period_end`, `status`, `approved_by` | Non-monetary output only. Money lives in the ledger. |

**Beneficiaries — separate private database** (see §19.3)

| Collection | Key fields | Notes |
|---|---|---|
| `beneficiary_private_records` | internal reference code, encrypted name and date of birth, guardian details, status | Separate MongoDB database; separate database user used only by the beneficiary service module; names and birth dates encrypted at field level; **no document in the main database stores a reference into this one** |
| `beneficiary_fund_accounts` | `beneficiary_id`, `fund_id` | |
| `beneficiary_fund_transactions` | realised as ledger lines with a private `beneficiary_account_id` dimension held in the private database | Public surface sees only the fund total and a participant count |

**Supporters and notifications**

| Collection | Key fields | Notes |
|---|---|---|
| `supporter_profiles` | `user_id`, `stripe_customer_id`, `country`, `display_publicly` (default false) | |
| `project_follows` | `user_id`, `project_id` | Unique pair |
| `notification_preferences` | `user_id`, `category`, `channel` (email / in-app), `enabled` | |
| `notifications` | `user_id`, `category`, `payload`, `read_at` | In-app |
| `email_deliveries` | `to_hash`, `template`, `provider_message_id`, `status`, `error`, `attempts` | |
| `outbox_events` | `type`, `payload`, `dedupe_key` (unique), `status`, `attempts`, `available_at`, `processed_at`, `last_error` | Written in the same transaction as the state change |

**Reports and AI**

| Collection | Key fields |
|---|---|
| `impact_reports` | `period_type`, `period_start`, `period_end`, `status`, `data_snapshot` (JSON of every figure used), `approved_by`, `published_at` |
| `report_exports` | `report_id`, `media_id`, `format`, `generated_at`, `sha256` |
| `ai_generations` | `purpose`, `actor_id`, `entity_type`, `entity_id`, `model`, `input_snapshot`, `output`, `validation_result`, `accepted` (bool), `tokens`, `latency_ms` |
| `volunteer_signups` | fields from the existing payload type in `volunteer/route.ts`, `consent_at` |
| `social_connections`, `social_posts` (P3) | encrypted tokens; per-video per-platform status |

### 9.4 Validators, privileges, and indexes that carry the design

MongoDB enforces less by default than a relational database, so each rule below names where it is enforced. "Validator" means a collection-level `$jsonSchema` (with `$expr` where noted), `validationLevel: "strict"`, `validationAction: "error"`.

| Rule | Enforced by |
|---|---|
| Amount fields are 64-bit integers, non-zero | Validator (`bsonType: "long"`); money module |
| A posted ledger entry can never be changed or removed | **Database privilege**: custom role grants the API user `find` + `insert` only on `ledger_entries`. Same for `audit_log`, `approval_events`, `stripe_events`. |
| Approver is not the submitter | Validator with `$expr` on `financial_transactions` and `accomplishments`; service check |
| A transfer's lines sum to zero per currency | Service, before posting; re-verified nightly by the integrity job |
| Every posted transaction has exactly its lines in `ledger_entries`, and nothing else | Written together in one multi-document transaction; unique index (`transaction_id`, `line_no`); integrity job |
| Every stored reference points to an existing document in the same organisation | Service checks inside the transaction; integrity job |
| A published accomplishment has a published revision and a public ID | Validator (conditional `required`); partial unique index on `public_id` |
| Milestone weight is a positive integer | Validator |
| Status values are from the allowed set | Validator (`enum`) |
| No unknown fields are stored | Mongoose `strict: "throw"`; validator `additionalProperties: false` on finance and audit collections |
| One webhook event is processed once | Unique index on `stripe_events.event_id` |
| One field submission creates one record | Unique index on (`submitted_by`, `idempotency_key`) |

**Indexes** (all prefixed with `organization_id`): `accomplishments` (`status`, `published_at` desc) and (`project_id`, `published_at` desc); `ledger_entries` (`fund_id`), (`project_id`), (`business_id`), (`occurred_on`); `financial_transactions` (`status`, `occurred_on`); `outbox_events` (`status`, `available_at`); `media_links` (`entity_type`, `entity_id`); `donations` (`donor_user_id`); TTL index on `sessions.expires_at`.

**Database users** (created by migration, least privilege):

| User | Can do |
|---|---|
| API | Read/write on workflow collections; `find` + `insert` only on the insert-only collections; nothing on the private database |
| Public-read | `find` on the public views only — used by the public endpoints |
| Beneficiary | Read/write on the private database only — used by one service module |
| Worker | As API, plus index-safe maintenance on summary collections |
| Migration | Schema, index, validator, and role management — used only by the pipeline |

**The integrity job** (worker, nightly, results in `integrity_reports`, alert on any finding): dangling references; posted transactions whose embedded lines differ from their ledger entries; transfers not summing to zero; hash-chain breaks; documents failing current validators; fund balances recomputed from scratch versus any cached summary.

### 9.5 Migrations and seeding

- Migration scripts live in NEW `server/migrations/` and are applied by a pipeline step before the new API version receives traffic. They create and alter indexes, validators, views, and database roles, and run data backfills. Document shape changes follow expand → backfill → contract, so the previous API version keeps working and rollback of the application never needs a data rollback. Tightening a validator is always the last step.
- Index builds on existing collections are run as rolling builds and never block deploys.
- Seed script (NEW): one organisation, one community, the fixed fund set, expense categories, metric definitions, and a founder account bound to James's email.
- **Data imports:** (1) Stripe backfill — page through historical Checkout sessions/charges and insert them as `source: "import"` transactions pending a finance manager's bulk approval; (2) volunteer sheet import if one exists. Both are idempotent on external ID.

### 9.6 Public projections

Public reads go through read-only **MongoDB views** whose pipelines `$match` on `status: "published"` / `visibility: "public"` / `is_public: true` and then `$project` an explicit allow-list of fields. Examples: `public_accomplishments`, `public_projects`, `public_project_finance` (grouped by category, no counterparty), `public_fund_totals`, `public_children_fund_summary` (two numbers and a count, suppressed when the participant count is below a threshold so an individual balance cannot be inferred — produced by the beneficiary module and copied into the main database as an aggregate, never read across databases at request time). The public endpoints connect as the public-read user, which cannot read the underlying collections. A test enumerates every public route and asserts the response contains no field outside the allow-list.

---

## 10. Backend/API Implementation Plan

### 10.1 Layering

```
server/                       NEW  Express API + worker — own package.json and tsconfig
  src/app.ts                       express app: helmet, CORS allow-list, body limits, request ID, error handler
  src/routes/**                    thin: parse (zod) → authenticate → call service → map errors
  src/services/*                   business rules, MongoDB transactions, policy checks, audit, outbox
  src/policy/*                     can(actor, action, resource) — the only place permissions are decided
  src/models/*                     Mongoose schemas, repositories, public projections
  src/worker/*                     outbox handlers, scheduled jobs, integrity job (second process, same code)
  src/integrations/*               stripe, mail, r2, stream, ai, social
  migrations/                      indexes, validators, views, roles, backfills
shared/schemas/*              NEW  zod schemas imported by both the front end and the API
src/lib/api.ts                NEW  typed API client used by server components and the browser
src/app/api/**/route.ts            the two existing Next.js routes: fixed in Phase 0, then retired
```

Rules: route files contain no business logic; services never trust a role or organisation ID from the request body; every mutating service method that touches more than one document runs in one MongoDB transaction that also writes the audit entry and any outbox events; no file under `src/` (the front end) imports from `server/`, and the front end holds no database credentials.

All paths in §10.3 are served by Express. The browser reaches them on the site's own origin (`/api/v1/*` forwarded to the API), so cookies are first-party.

### 10.2 Cross-cutting behaviour

- **Errors:** one error type with a stable `code`, mapped to HTTP status; responses are `{ error: { code, message, fields? } }`. Internal messages never reach the client.
- **Validation:** zod at the boundary; maximum lengths on every string; unknown keys stripped. Request values reach MongoDB filters only as validated scalars, never as objects, so operator injection (a body containing `{"$ne": null}`) cannot alter a query.
- **Idempotency:** `Idempotency-Key` header required on field-report submit, donation checkout, and transaction creation; stored with a unique constraint.
- **Concurrency:** updates carry `version`; mismatch returns 409 with the current record.
- **Rate limits:** per IP on anonymous endpoints, per user on authenticated ones; stricter on auth, upload-ticket, and AI endpoints.
- **Request IDs** propagated into logs, audit rows, and error reports.
- **CSRF:** once cookies exist — `SameSite=Lax` session cookie, `Origin` check on every non-GET, JSON-only bodies.

### 10.3 Endpoints

Access labels: **PUBLIC** · **AUTH** (any signed-in user) · **SELF** (own data only) · **FIELD+** (field member or above, within scope) · **PM** (project manager of the scoped project, or director/founder) · **MEDIA** · **FIN** (finance manager) · **DIR+** (director or founder) · **FOUNDER** · **SYSTEM** (signature or secret, no user).

**Public reads** — all PUBLIC, cached, from projections only

| Method & path | Returns |
|---|---|
| `GET /api/v1/public/stats` | Dashboard statistics |
| `GET /api/v1/public/accomplishments?project&category&year&cursor` | Timeline page |
| `GET /api/v1/public/accomplishments/{publicId}` | Published revision, public media, public financial block, related items |
| `GET /api/v1/public/projects`, `…/projects/{slug}` | Project, milestones, computed progress, funding progress |
| `GET /api/v1/public/projects/{slug}/finance` | Category breakdown from posted lines |
| `GET /api/v1/public/communities`, `…/{slug}` | Coarse location, counts |
| `GET /api/v1/public/transparency` | Fund totals by type (never merged), operating expenses, business net |
| `GET /api/v1/public/sustainability?community` | Monthly recurring income vs. operating expense, ratio |
| `GET /api/v1/public/children-fund` | Aggregate only |
| `GET /api/v1/public/reports`, `…/{id}/download` | Published reports |

Server components fetch these endpoints from the Express API with cache tags; the browser uses the same endpoints for pagination, as would any future mobile app.

**Authentication**

| Path | Access | Notes |
|---|---|---|
| sign-in / sign-out / email verification / MFA enrol / MFA verify (provided by the auth layer) | PUBLIC → AUTH | Staff roles require MFA before any `/admin` or `/field` access |
| `GET /api/v1/me` | AUTH | Profile, roles, scopes |
| `POST /api/v1/admin/users/invite`, `PATCH …/users/{id}/roles`, `POST …/users/{id}/suspend` | FOUNDER (director may invite field members) | Invitation-only for staff; no self-signup into staff roles |

**Accomplishments and workflow**

| Method & path | Access | Responsibility |
|---|---|---|
| `POST /api/v1/field/reports` | FIELD+ | Create draft from the mobile form (idempotent) |
| `PATCH /api/v1/field/reports/{id}` | author while `draft` / `changes_requested` | Save draft |
| `POST /api/v1/field/reports/{id}/submit` | author | `draft → submitted` |
| `GET /api/v1/admin/accomplishments?status&project` | FIELD+ sees own; PM sees scoped; DIR+ sees all | Queue |
| `PATCH /api/v1/admin/accomplishments/{id}` | PM, DIR+ | Edit → new revision |
| `POST …/{id}/review` `{decision, comment}` | PM (not the author) | `submitted → pm_approved` or `changes_requested` |
| `POST …/{id}/verify-finance` | FIN | Required when linked transactions exist |
| `POST …/{id}/approve` | DIR+ (not the author) | Approves and publishes — one transaction (§15.3) |
| `POST …/{id}/unpublish` `{reason}` | DIR+ | Retraction, recorded |
| `GET …/{id}/history` | PM, DIR+, FIN | Revisions and approval events |

**Projects, milestones, communities, businesses**

| Method & path | Access |
|---|---|
| `POST/PATCH /api/v1/admin/projects` | DIR+ (create); PM (edit own) |
| `POST/PATCH/DELETE /api/v1/admin/projects/{id}/milestones` | PM; weight changes on an active project also need DIR+ because they move public progress |
| `POST /api/v1/admin/milestones/{id}/status` | PM |
| `POST/PATCH /api/v1/admin/communities` | DIR+ |
| `POST/PATCH /api/v1/admin/businesses`; `POST …/businesses/{id}/production` | DIR+; PM submits production; DIR+ approves |
| `POST /api/v1/admin/metrics/entries`; `POST …/{id}/approve` | PM submits; DIR+ approves |

**Media**

| Method & path | Access | Responsibility |
|---|---|---|
| `POST /api/v1/media/upload-ticket` `{kind, mime, bytes, sha256}` | FIELD+, MEDIA | Authorise, enforce size/type limits, create `media_assets` row, return signed resumable upload target |
| `POST /api/v1/media/{id}/complete` | uploader | Enqueue processing |
| `POST /api/webhooks/video` | SYSTEM (provider signature) | Asset ready / errored |
| `PATCH /api/v1/admin/media/{id}` | MEDIA, PM | Alt text, caption, `contains_minors`, consent link |
| `POST /api/v1/admin/media/{id}/publish` / `unpublish` | DIR+; MEDIA only under the daily-video rule in §14.6 | |
| `GET /api/v1/media/{id}/signed-url` | role-dependent | Short-lived URL for private originals and receipts |

**Finance** — nothing here is ever PUBLIC

| Method & path | Access | Responsibility |
|---|---|---|
| `POST /api/v1/donations/checkout` (replaces the existing Next.js `/api/checkout`) | PUBLIC, rate-limited, Turnstile | Create Checkout session with designation metadata |
| `POST /api/webhooks/stripe` | SYSTEM (Stripe signature, verified against the raw request body — mount `express.raw` on this route before any JSON parser) | Record donations, refunds, disputes, payouts |
| `POST /api/v1/admin/finance/transactions` | FIN; FIELD+ may create `expense` drafts only via a field report | Draft |
| `POST …/transactions/{id}/submit` | creator | |
| `POST …/transactions/{id}/approve` | FIN or DIR+, **not the creator**; above a configurable threshold, FOUNDER as second approver | Posts atomically |
| `POST …/transactions/{id}/reverse` `{reason}` | FIN creates; DIR+ approves | The only way to correct a posted transaction |
| `POST …/finance/allocations` | FIN creates; DIR+ approves | Transfer between funds |
| `POST …/transactions/{id}/documents`; `POST …/documents/{id}/redacted` | FIN | Attach evidence; attach redacted public copy |
| `GET …/finance/ledger`, `…/funds`, `…/reconciliation` | FIN, DIR+, FOUNDER | |
| `POST …/finance/reconciliations` | FIN | |
| `POST …/finance/import/stripe` | FOUNDER | Backfill |

**Beneficiaries** (P3) — FOUNDER and explicitly designated safeguarding lead only; every read is audited

`/api/v1/admin/beneficiaries/**`, `/api/v1/admin/children-fund/**`

**Supporters**

| Method & path | Access |
|---|---|
| `GET /api/v1/supporter/dashboard` | SELF |
| `GET /api/v1/supporter/donations`, `…/{id}/receipt` | SELF |
| `PUT/DELETE /api/v1/supporter/follows/{projectId}` | SELF |
| `GET/PUT /api/v1/supporter/notification-preferences` | SELF |
| `GET /api/v1/supporter/notifications`, `POST …/{id}/read` | SELF |
| `POST /api/v1/supporter/export`, `POST …/delete-account` | SELF |
| `GET /api/unsubscribe?token` | PUBLIC (signed token) |

**AI, reports, system**

| Method & path | Access |
|---|---|
| `POST /api/v1/admin/ai/draft-accomplishment` `{reportId}` | PM, DIR+, MEDIA |
| `POST /api/v1/admin/reports` (generate), `…/{id}/approve`, `…/{id}/publish` | DIR+ generate/approve; FIN must sign the financial section |
| Outbox drain, monthly report draft, Stripe reconciliation, integrity job | SYSTEM — run inside the worker process; not exposed over HTTP |
| `POST /api/revalidate` (on the Next.js app, NEW) | SYSTEM (shared secret; called by the worker to invalidate cache tags) |
| `GET /api/health` | PUBLIC (no detail); detailed variant SYSTEM |
| `GET /api/v1/admin/audit` | FOUNDER; DIR+ excluding finance and beneficiary entries |
| `POST /api/v1/volunteers` (replaces the existing Next.js `/api/volunteer`) | PUBLIC, rate-limited, Turnstile |

### 10.4 Server-side calculations (never accepted from the client)

Project progress; funding progress; every figure on the public dashboard; fund balances; remaining budget; fee and net amounts (taken from Stripe's balance transaction, not computed); sustainability ratio; children's fund totals; report figures; accomplishment public IDs; all status transitions; FX conversion.

---

## 11. Frontend/UI Implementation Plan

### 11.1 Principles

Reuse the theme and primitives from §4. New pages are server components that fetch from the Express API (through NEW `src/lib/api.ts`) and pass props to styled client components — no component imports facts from `content.ts`. Marketing copy (headlines, button labels) may stay there.

### 11.2 Routes

| Route | Purpose | Pri | Built from |
|---|---|---|---|
| `/` (exists) | Home; stats and project cards become database-driven | P0/P1 | existing sections |
| `/accomplishments` NEW | Dashboard statistics + timeline + filters | P1 | `ImpactCounter`, `Timeline` (from `OurStory`) |
| `/accomplishments/[publicId]` NEW | Detail page | P1 | `Section`, gallery, finance block |
| `/projects` NEW, `/projects/[slug]` NEW | List; tracker with milestones, history, finance | P1 | `ProjectCard`, `ProgressBar` (from `OrphanageHub`) |
| `/impact` NEW | Statistics with definitions and "how we count" | P1 | `StatCounter` |
| `/transparency` NEW | Fund-type totals, project selector, documents | P1 summary / P2 full | `Transparency` cards, charts |
| `/communities` NEW, `/communities/[slug]` NEW | Map and community pages | P1 stylised / P2 | `ImpactMap` |
| `/sustainability` NEW | Business table, ratio, trend | P2 | charts |
| `/videos` NEW | Daily video feed (R-B) | P1 | media player |
| `/gallery` NEW | Before/after | P2 | comparison slider NEW |
| `/reports` NEW | Report archive, downloads | P2 | document tiles |
| `/dashboard` NEW | Supporter impact dashboard | P2 | |
| `/sign-in`, `/verify`, `/mfa` NEW | Auth | P0 | `Field` |
| `/privacy`, `/terms`, `/safeguarding` NEW | Policies | P0 | `Container $narrow` |
| `/field`, `/field/new`, `/field/drafts` NEW | Mobile field reporting | P1 | `Field`, upload components |
| `/admin` NEW and children: `queue`, `accomplishments`, `projects`, `media`, `finance/*`, `metrics`, `businesses`, `communities`, `reports`, `users`, `audit`, `settings` | Staff console | P0 shell, then per phase | new admin primitives |

Navigation: the blueprint's bar (Home · Our Story · Accomplishments · Projects · Communities · Transparency · Our Impact · Support Us) replaces the anchor list in `content.nav`. Existing in-page anchors become `/#story`, `/#sponsor`.

### 11.3 New shared components (all NEW, under `src/components/`)

| Component | Notes |
|---|---|
| `ui/Select`, `RadioGroup`, `DateInput`, `MoneyInput`, `FileDrop` | Extend `Field.tsx` conventions |
| `ui/ProgressBar`, `ui/StatusBadge`, `ui/Toast`, `ui/Dialog`, `ui/Tabs`, `ui/Pagination`, `ui/Skeleton`, `ui/EmptyState`, `ui/ErrorState`, `ui/ForbiddenState` | `ProgressBar` extracted from `OrphanageHub.tsx`; `Toast` from `DonationStatus.tsx`; `Dialog` shares focus-trap logic that also fixes the `Navbar` sheet |
| `ui/DataTable` | Sortable, paginated, keyboard-navigable; collapses to cards under `md` |
| `portal/Timeline`, `AccomplishmentCard`, `ProjectCard`, `MilestoneList`, `FundingBlock`, `FinanceBreakdown` | |
| `media/Gallery`, `Lightbox`, `VideoPlayer`, `BeforeAfterSlider`, `Uploader` | Slider must be operable by keyboard (range input semantics) and touch |
| `charts/*` | Recharts wrappers, lazy-loaded, each with a visually-hidden data table alternative |
| `admin/Shell`, `ApprovalPanel`, `RevisionDiff`, `AuditTrail` | |

### 11.4 Required states on every data screen

| State | Behaviour |
|---|---|
| Loading | `loading.tsx` skeletons shaped like the content; no layout shift |
| Empty | Explains what will appear and, for staff, the action that creates it. Public statistics with no approved data show "Not yet reported", **never zero and never a placeholder number** |
| Error | `error.tsx` per segment with retry; a request ID the user can quote |
| Not found | `not-found.tsx`; unpublished and non-existent accomplishments are indistinguishable (both 404) |
| Forbidden | Signed-in user without permission sees a plain explanation; unauthenticated users are redirected to sign-in. Hiding a button is never the control — the service refuses. |
| Offline / slow | Field form shows connection state, per-file upload progress with resume, and "saved on this device" |
| Stale | Admin edit conflict (409) shows the other user's change and offers reload |

### 11.5 Forms

Client-side zod validation from the same schema the server uses; errors tied to fields with `aria-describedby` and an error summary that receives focus; submit buttons show progress and are disabled while pending; destructive or financial approvals require a confirm dialog that restates the amount and fund.

### 11.6 Mobile, accessibility, SEO

- **Mobile:** design at 360px first. Admin tables collapse to cards. Field screens use one column, 48px targets, and no hover-dependent controls. Performance budget for public pages on a throttled 3G profile: largest contentful paint under 4s, under 200KB of JavaScript on first load for `/accomplishments`.
- **Accessibility target: WCAG 2.2 AA.** Fix T14. Charts have table alternatives; map has an equivalent list; videos have captions; timelines are ordered lists; status is never conveyed by colour alone; all motion continues to respect reduced-motion.
- **SEO:** `generateMetadata` per accomplishment and project (title, description, OG image from the cover); NEW `src/app/sitemap.ts` and `src/app/robots.ts` (disallow `/admin`, `/field`, `/dashboard`, `/api`); `Article` / `NGO` structured data; canonical URLs on `publicId`; staff and supporter areas `noindex`.

---

## 12. Authentication and RBAC Plan

### 12.1 Authentication

| Requirement | Specification |
|---|---|
| Staff onboarding | Invitation only. A founder (or director, for field members) invites an email; the invite is single-use and expires in 72 hours. |
| Staff sign-in | Email + password or passkey, **plus TOTP MFA, mandatory** for founder, director, finance manager; mandatory for all staff by the end of P1. Recovery codes issued at enrolment. |
| Field members | Same, with long-lived sessions on a registered device (30 days) because re-authenticating on poor connectivity is costly; step-up MFA is not required to *submit* reports. |
| Supporters | Self-signup with email verification (magic link). No access to anything but their own data. |
| Sessions | Database-backed, revocable; `HttpOnly`, `Secure`, `SameSite=Lax` cookie; idle timeout 30 min for finance/founder in admin, 12 h for other staff; rotation on privilege change. |
| Step-up | Re-enter MFA for: approving a financial transaction, changing roles, viewing beneficiary records, exporting data. |
| Account protection | Rate limits and lockout back-off on sign-in; generic error messages; breach-password check on set; sign-in alerts by email for staff. |
| Offboarding | Suspending a user revokes all sessions immediately; role assignments are revoked, not deleted. |

### 12.2 Roles and scope

| Role | Scope | Summary |
|---|---|---|
| Founder | Organisation | Everything, including role management, audit, beneficiary data. Still cannot approve own financial submissions. |
| Foundation Director | Organisation | Manage projects; final approval of accomplishments; approve reports, metrics, media. No ledger edits. |
| Project Manager | Assigned projects | Edit project and milestones; review submissions for those projects. |
| Financial Manager | Organisation | Create/verify/approve transactions; reconciliation; documents. Cannot publish accomplishments. |
| Media Manager | Organisation (or community) | Upload and manage media; publish daily videos under §14.6. |
| Field Team Member | Assigned projects | Create and submit own reports and evidence; see own submissions. |
| Supporter | Self | Own profile, donations, follows, preferences. |
| Public Visitor | — | Published projections only. |

### 12.3 Permission matrix (abridged; the policy module and its tests are the authority)

| Action | Field | Media | PM | Fin | Dir | Founder |
|---|---|---|---|---|---|---|
| Create field report | own projects | ✓ | own projects | — | ✓ | ✓ |
| Review submission | — | — | own projects, not own report | — | ✓ | ✓ |
| Verify finance on a submission | — | — | — | ✓ | — | ✓ |
| Final approve / publish accomplishment | — | — | — | — | ✓ not own | ✓ not own |
| Unpublish | — | — | — | — | ✓ | ✓ |
| Create project | — | — | — | — | ✓ | ✓ |
| Edit milestones | — | — | own projects | — | ✓ | ✓ |
| Upload media | ✓ | ✓ | ✓ | receipts | ✓ | ✓ |
| Publish media | — | daily video rule | — | — | ✓ | ✓ |
| Create transaction | expense draft via report | — | expense draft | ✓ | — | ✓ |
| Approve / post transaction | — | — | — | ✓ not own | ✓ not own | ✓ not own |
| View private ledger | — | — | own project lines | ✓ | ✓ | ✓ |
| View beneficiary records | — | — | — | — | — | ✓ + designated lead |
| Manage users and roles | — | — | — | — | invite field | ✓ |
| View audit log | — | — | — | finance entries | non-finance | ✓ |

### 12.4 Enforcement

1. NEW `src/middleware.ts`: redirects unauthenticated requests away from `/admin`, `/field`, `/dashboard`; sets security headers. Coarse gate only.
2. Layout-level check in `/admin` and `/field` server layouts.
3. **Service-level `can()` on every method in the Express API** — the actual control. An Express middleware resolves the session to an actor; routes without it fail closed. Resource-scoped: a PM's permission is evaluated against the specific project.
4. A separate database and database user for beneficiary data, used by one service module only.
5. A generated test matrix: for every (role × action × own/other/out-of-scope resource), assert allow or deny. A new service method without a policy entry fails CI.

---

## 13. Financial Integrity Plan

Finance is treated as a ledger, not as editable records.

### 13.1 Model

- **Fund accounting.** Every amount sits in exactly one fund. Fund types — unrestricted donations, restricted (per project), loans, business, children's future, reserve, operations — are the blueprint's "do not combine into a misleading total" rule expressed as structure. Public pages show totals **per fund type**, with loans always labelled as liabilities, never as income.
- **Transactions have a header and lines.** A donation is a positive line into a fund; an expense is a negative line from a fund against a project/business and category; an allocation is a transfer whose lines sum to zero.
- **Money is integer minor units plus an ISO currency code.** No floating point anywhere, including the browser. In MongoDB amounts are stored as BSON 64-bit integers (`Long`) and collection validators reject any other type; in JSON between API and browser they travel as strings or safe integers and are handled only by the shared money module. A per-currency exponent table drives parsing and display (UGX has no minor unit in practice; payment processors have their own per-currency rules, which must be checked when UGX support is added).

### 13.2 Lifecycle and immutability

`draft → submitted → approved → posted`, or `rejected`. **Posting** means: in one MongoDB transaction, the workflow document's status becomes `posted` and one document per line is inserted into `ledger_entries`. That collection is insert-only at the level of database privileges — the API's own credentials cannot update or delete from it — so a posted entry cannot be edited or removed by application code, by a bug, or by someone holding the API's connection string. Every balance and public figure is computed from `ledger_entries` alone, so altering the workflow document afterwards changes no money (and the nightly integrity job reports the mismatch). Corrections are made by a **reversal** transaction (linked by `reverses_id`, itself approved) followed by a correct new transaction. Both remain visible in the private ledger; public aggregates net them.

### 13.3 Controls

| Control | Implementation |
|---|---|
| Separation of duties | Approver ≠ creator (collection validator + service check). |
| Dual approval | Above a configurable threshold, a second approver (founder) is required. |
| Evidence | An expense cannot be approved without at least one attached document unless an exception reason is recorded. |
| Audit trail | Every state change writes `approval_events` and `audit_log` in the same transaction. |
| Atomicity | Posting, balance effects, linked accomplishment updates, and outbox events commit together or not at all. |
| Period lock | A closed month rejects new postings dated within it; corrections post in the open period with a reference. |
| Tamper evidence | Each ledger entry stores a hash chaining to the previous one per organisation; a nightly job verifies the chain. |
| Integrity verification | Because MongoDB does not enforce references or cross-document rules, the nightly integrity job (§9.4) re-checks them all and alerts on any finding. A clean run is a release gate for finance features. |
| Privileged access | The Atlas organisation owner can bypass application controls. Limit that role to the founder plus one other; enable database auditing where the tier offers it; alert on any direct write to finance collections from outside the API's network. |

### 13.4 Flows

- **Online donations.** The checkout endpoint (moved into the Express API) adds `metadata[organization_id]`, `metadata[designation_project_id]`, and an idempotency key, and stops rounding to whole dollars. The NEW Stripe webhook is the only writer of online donations: on successful payment or paid subscription invoice it records gross, the processor fee and net from the balance transaction, currency, and donor country; refunds and disputes create linked reversing entries. Events are de-duplicated on `stripe_events.event_id`. A daily job compares Stripe payouts to recorded donations and raises a reconciliation exception on any difference. The `?donation=success` banner remains cosmetic.
- **Offline donations** (cash, bank, mobile money): entered by the finance manager with evidence, approved by a second person.
- **Designation and allocation.** A donation designated to a project posts into that project's restricted fund. Undesignated gifts post to unrestricted and are moved by an approved allocation transfer. **Restricted money cannot be spent on another project** — an expense line's fund must match its project or be unrestricted/operations; the service rejects anything else.
- **Loans.** Receipt increases the loan fund and an outstanding-liability figure; repayments reduce it. Shown publicly as "Loans outstanding", separate from contributions.
- **Business revenue and expenses.** Ledger lines tagged with `business_id`. Net earnings = revenue − expenses for the period.
- **Operating expenses.** Categories flagged `is_operating`. This is what makes the public "Operational Expenses" figure — and is why "100% to the children" (D8) must be removed or substantiated.
- **Project budget vs. actual.** Budget is a project attribute changed only by a director with an audit entry; actual = Σ posted expense lines; remaining = restricted fund balance. All computed on the server by aggregation pipelines over `ledger_entries`.
- **Children's future fund.** A fund type with private sub-accounts (§19.3). Contributions, allocations, distributions, and adjustments are ordinary ledger transactions carrying a private dimension. Distributions require founder approval and a document.

### 13.5 Currency, rounding, aggregation

- Each line stores the original amount and currency **and** a base-currency amount with the rate and its source, fixed at posting. Historical totals never move when exchange rates do.
- Rounding happens once, at line creation (half-even), never during aggregation. Percentages are computed from integer sums and rounded only for display.
- Public totals state their currency and "as of" date.

### 13.6 Sustainability ratio

`recurring unrestricted net income ÷ recurring operating expenses` per community per month, where "recurring income" is business net earnings (and other categories explicitly flagged recurring) and **excludes donations and grants**, as the blueprint requires. The classification lives on the category and can be overridden per transaction with a reason. The definition is published on the page beside the number.

### 13.7 Public / private boundary

| Public | Private |
|---|---|
| Totals by fund type; per-project totals by category; business revenue/expense/net by month; children's fund aggregate; redacted receipts explicitly released | Individual transactions with counterparties; donor identities; staff payments by name; unredacted documents; any per-child figure; bank and mobile-money identifiers |

Donor names appear publicly only with explicit opt-in.

### 13.8 Legal dependency

Receipts are issued as "donation acknowledgements" until counsel confirms which entity receives funds and whether gifts are tax-deductible anywhere. The children's future fund must not launch publicly until its legal structure under Ugandan law is confirmed (blueprint §8 says the same).

---

## 14. Media and Video Architecture

### 14.1 Constraints from the current architecture

Uploads must not pass through the application. The Express server could technically accept large request bodies, but proxying gigabyte videos through it would tie up the process, pay for the bandwidth twice, and lose resumability; the existing Next.js routes cannot accept them at all. With the chosen stack: **images and documents go to Cloudflare R2** by presigned multipart upload, and **video goes to Cloudflare Stream** by direct creator upload using the tus resumable protocol, with Stream's webhook reporting when a video is ready. Nothing may be stored in `public/` or on the app server. All uploads go **directly from the browser to storage or the video provider** using short-lived, single-purpose credentials issued by the app after an authorisation check.

### 14.2 Upload flow

```
1  Client: pick file → (images) downscale to ≤2000px, re-encode, which also drops EXIF → compute SHA-256
2  POST /media/upload-ticket  → server checks role, type, size, quota → creates media_assets (pending) → returns resumable target
3  Client uploads in chunks with resume; progress shown per file
4  POST /media/{id}/complete (or provider webhook)
5  Job: verify size and hash → sniff real type from bytes → malware scan (documents) → images: re-encode server-side,
        strip all metadata, generate derivatives and blur placeholder → video: provider transcodes, thumbnails
6  processing_status = ready, visibility = internal  (visible to staff only)
7  Approval sets visibility = public and copies derivatives to the public path
```

### 14.3 Rules

| Topic | Rule |
|---|---|
| Types | Images: JPEG, PNG, WebP, HEIC (converted). Video: MP4/MOV/WebM. Documents: PDF, JPEG, PNG. **SVG and HTML rejected.** Type decided by content sniffing, not extension or client header. |
| Size | Images 15 MB before compression; documents 20 MB; video 1 GB / 10 minutes initially (configurable). |
| Metadata | **All EXIF, including GPS, removed server-side even if the client already did it.** A geotagged photo of the children's home is a safeguarding incident. |
| Storage layout | `originals/` private; `derivatives/` private until approved; `public/` served via CDN with long cache and content-hashed names; `documents/` always private, read via 5-minute signed URLs. Object names are random, never user-supplied. |
| Images | Derivatives at 400/800/1600 px in AVIF/WebP with JPEG fallback; served through `next/image`. Replace current CSS background images with it. |
| Video | Adaptive streaming from the provider; poster and thumbnails; captions track where available; `preload="none"`; no autoplay. |
| Dedupe | Same SHA-256 by the same organisation reuses the asset. |
| Failure recovery | Resume from last chunk; tickets valid 24 h; a nightly job deletes abandoned `pending` assets older than 48 h; provider errors mark the asset `failed` with a retry action. |
| Deletion | Soft-delete, then purge from storage and CDN after 30 days; immediate purge path for safeguarding takedowns. |
| Quota and cost | Per-user daily upload caps; monthly storage and streaming-minute alerts. |

### 14.4 Moderation

Media inherits the approval of the record it is attached to. Any asset flagged `contains_minors` additionally requires a linked, unexpired consent record and the safeguarding checklist (§19.3) before it can become public.

### 14.5 Before-and-after

Two `media_links` rows (`before`, `after`) on the same entity. The slider renders two same-ratio derivatives; the processing job crops to a shared aspect ratio. Captions come from the linked accomplishment.

### 14.6 Daily video workflow (R-B)

1. Leon (media manager) opens `/field/new?type=video` on his phone, records or selects a clip, adds a one-line caption and project.
2. Upload proceeds in the background and resumes if the connection drops; the text is saved first.
3. When the provider reports ready, the video enters the queue.
4. **Publishing rule — needs a business decision (Q5):** either (a) every video is approved by a director before going public, or (b) the media manager may self-publish after ticking a safeguarding attestation, with post-publication review and one-click takedown. Recommendation: (a) until a written safeguarding policy exists, then (b) for videos not flagged as containing minors.
5. Published videos appear on `/videos`, the home page's latest-video slot, and the linked project.

### 14.7 Social cross-posting (R-C) — P3

- Each platform (YouTube, Facebook/Instagram, TikTok) requires its own developer app, OAuth consent from the channel owner, and in most cases a platform review before uploads can be public. **This is calendar time outside the team's control and must be started early even though the feature ships late.**
- Design: `social_connections` (encrypted refresh tokens, per platform), `social_posts` (per video per platform: queued / posting / posted / failed, external URL, error). An outbox event on video publication fans out to one job per connected platform. Failures retry with back-off and surface in admin; **a social failure never blocks or rolls back site publication.**
- Only videos approved for the `social` consent scope are eligible.
- Cheaper alternative worth offering James: invert the flow — Leon keeps posting to his main channel as he does now and the site imports from it. It delivers "daily videos on the website" with a fraction of the work, at the cost of the site not being the origin and of weaker pre-publication review. Recorded as TD-12.

### 14.8 Multilingual video summaries (R-D) — P3

Transcript (provider captions or a speech-to-text service) → AI summary in English, reviewed by staff → on-demand machine translation to the visitor's chosen language, cached per (video, language), labelled "machine-translated". Same safeguards as §17.

---

## 15. Approval Workflow

### 15.1 States

```
                 ┌──────── changes_requested ◄───────┐
                 ▼                                   │
 draft ──► submitted ──► pm_approved ──► finance_verified ──► published
                 │             │   (skipped when no           │
                 └──► rejected ◄┘    linked transactions)     ▼
                                                         unpublished ──► (new revision → submitted)
```

This maps to the blueprint's nine steps: 1–3 are `draft`/`submitted` with evidence; 4 is `pm_approved`; 5 is `finance_verified`; 6–7 is `published`; 8–9 are outbox effects.

### 15.2 Transition rules

| Transition | Who | Preconditions |
|---|---|---|
| draft → submitted | author | Required fields; at least one piece of evidence; all uploads `ready` |
| submitted → pm_approved | PM of the project (not the author), or director/founder | — |
| submitted / pm_approved → changes_requested | reviewer | Comment required |
| pm_approved → finance_verified | finance manager | Every linked transaction is `approved` with documents |
| → published | director or founder, **not the author** | Safeguarding checklist complete; media with minors has consent; if `ai_assisted`, reviewer has confirmed facts against the source report |
| published → unpublished | director or founder | Reason required |
| any → rejected | reviewer at that stage | Reason required |

If the author is the only person holding the next role (small team), the transition is blocked and the UI says who can perform it. There is no override.

### 15.3 What happens in the publish transaction

One MongoDB multi-document transaction (majority write concern, retried as a whole on transient errors):

1. Update the accomplishment with a filter on `_id`, `version`, and current status; if no document matches, another user got there first and the transaction aborts with a conflict.
2. Allocate the public ID from `id_sequences` (atomic `$inc`, inside the transaction).
3. Set `published_revision_id`, `status`, `published_at`.
4. Post linked approved transactions (insert their `ledger_entries`).
5. Mark linked metric entries approved.
6. Set linked media `visibility = public`.
7. If a milestone is linked and marked for completion, update it.
8. Insert `approval_events` and `audit_log` rows.
9. Insert outbox events: `revalidate` (tags), `notify.accomplishment_published`, `media.publish_derivatives`, later `social.post`.

If any step fails, nothing is published. Side effects outside the database happen only after commit, via the outbox, and are retried independently.

### 15.4 Edits after publication

Editing creates a new revision in `submitted`; the public page continues to show the previously published revision until the new one is approved. The detail page shows "Updated on …" and staff can view a diff between revisions.

### 15.5 Reuse

The same engine (states, rules table, `approval_events`) is used for financial transactions, standalone media, metric entries, business production records, and reports, each with its own rule set.

---

## 16. Mobile Field Reporting

### 16.1 Conditions to design for

Low-end Android phones, intermittent 2G/3G, metered data, shared devices, bright sunlight, one-handed use. The existing site's reliance on large JavaScript bundles and animation is unsuitable for these screens; `/field` uses a minimal layout with no decorative motion.

### 16.2 The form (blueprint §19) and its behaviour

| Field | Behaviour |
|---|---|
| What did you accomplish today? | Free text; autosaved locally on every change |
| Which project? | Only projects the user is assigned to; cached for offline selection |
| Date | Defaults to today; cannot be in the future |
| Photos | Multi-select from camera or gallery; compressed on device to ≤2000px before upload; per-file progress |
| Video | Optional; resumable; can finish after the report text is submitted |
| Did this involve an expense? | Reveals amount (integer entry in the local currency with a fixed currency label), category, and receipt upload. Creates a **draft** expense linked to the report — it has no financial effect until the finance manager approves it. |
| What happens next? | Free text |
| Contains children? | Explicit yes/no; "yes" shows the safeguarding reminder |
| Submit for approval | Enabled when required fields are present |

### 16.3 Reliability

- **Local drafts** in IndexedDB keyed by a client-generated UUID, which is also the idempotency key. Closing the browser loses nothing.
- **Text first, media after.** Submit sends the small JSON payload immediately; media uploads continue and attach to the server draft. The report moves to `submitted` automatically when all uploads are ready, or the user can submit text-only with "media pending".
- **Retries** with exponential back-off; a duplicate submit with the same key returns the existing record.
- **Clear status:** "Saved on this phone" → "Sent" → "Waiting for review" → "Published", plus reviewer comments.
- **Installable** (web app manifest, app-shell caching) so it opens instantly from the home screen.
- **Not in MVP:** full offline submission with background sync. Background sync is not available on all mobile browsers, so it would need a fallback anyway; the blueprint also defers it. Local drafts cover the main risk — lost work.

### 16.4 Language

Interface strings for `/field` are externalised from the start so a Luganda (or other) translation can be added without code changes.

---

## 17. AI Assistant Architecture

### 17.1 Position in the system

The assistant is a button in the review screen — "Draft description" — available to project managers, directors, and media managers. It produces text into the draft revision's fields. It has no ability to change status, publish, or write to any financial or beneficiary table. Its output is subject to exactly the same approval path as human-written text.

### 17.2 Flow

1. **Input assembly (server):** the submitted field report text, project name and category, the linked milestone, date, and any **already-entered** quantities and expense amounts. Beneficiary records are never included. A pre-filter replaces personal names found in the report with placeholders.
2. **Request:** system instructions state the rules — use only supplied facts; do not add numbers, dates, names, outcomes, or costs; if information is missing, say so rather than fill the gap; plain respectful tone; no descriptions of individual children. Output is requested as structured fields (`title`, `body`, `why_it_matters`, `next_steps`, `facts_used[]`).
3. **Validation (server, before the user sees it):**
   - Every number, currency amount, and date in the output must appear in the input. Any that does not is highlighted and the draft is marked "needs fact check".
   - Named-entity check against the input for people and places.
   - Length and format limits.
4. **Presentation:** side-by-side with the original field report; unverified spans highlighted; the reviewer edits freely.
5. **Record:** `ai_generations` row with input snapshot, model, output, validation result, and whether the text was accepted, edited, or discarded. The accomplishment is flagged `ai_assisted`.
6. **Approval gate:** publishing an `ai_assisted` item requires the approver to tick "I have checked this against the field report".

### 17.3 Failure and fallback

| Failure | Behaviour |
|---|---|
| Provider timeout or error | Message "Drafting is unavailable — write the description manually". The form never blocks. One automatic retry, then stop. |
| Validation fails | Draft still shown, flagged, with offending spans highlighted; cannot be accepted wholesale without edits. |
| Rate or budget limit reached | Feature disabled for the day with a clear message; per-user and per-organisation caps. |
| Provider disabled by configuration | Button hidden. |

### 17.4 Data handling

Keys are server-side only. Use provider settings that exclude submitted data from model training where offered; record the provider's retention terms in the privacy policy. Do not send receipts, documents, or images in the first version. Logs of prompts and outputs follow the same retention as audit logs and are visible to founders only.

### 17.5 Evaluation

A fixed set of field-report fixtures with expected properties (no new numbers, no names, mentions the next step only if supplied) runs in CI against a recorded or mocked provider, and on demand against the live provider before any model or prompt change.

---

## 18. Notifications and Background Jobs

### 18.1 Mechanism

**Transactional outbox.** Any service that needs a side effect inserts an `outbox_events` document inside its own MongoDB transaction. The **worker process** — the same codebase as the API, started with a different entry point — claims one event at a time with an atomic `findOneAndUpdate` (`pending → processing`, with a lease expiry), runs the handler, and marks it processed. Failures increment `attempts` and reschedule with back-off; after a limit the event is parked as `dead` and raises an alert. Handlers are idempotent (`dedupe_key`). Expired leases are reclaimed, so a crashed worker loses nothing.

- The worker polls every few seconds and can additionally watch a MongoDB change stream for near-immediate pickup.
- **Scheduled jobs** (monthly report draft, Stripe reconciliation, integrity job, cleanup) run on a timer inside the worker, guarded by a lease document in MongoDB so that only one instance runs each job if the worker is ever scaled out.
- Because the worker is an always-on process, no external queue or scheduling service is required at any phase. The cost is that the host must keep it running — a free hosting tier that sleeps when idle will silently stop notifications, processing, and integrity checks (§21.9).

### 18.2 Synchronous vs. background

| Operation | Mode | Notes |
|---|---|---|
| Validation, permission checks, status transitions, ledger posting, ID allocation | **Synchronous**, in the request transaction | The user must know the outcome |
| Issuing upload tickets | Synchronous | |
| Cache revalidation after publish | Background (seconds) | Admin sees "Published"; public page updates shortly after |
| Email (staff and supporter) | Background | Never inside the request |
| Milestone / publication notifications | Background, fan-out per recipient in batches | Respect preferences at send time |
| Image processing and scanning | Background | |
| Video processing | Provider + webhook | |
| Large media uploads | Client → storage directly; not a server job | |
| AI drafting | Synchronous with a strict timeout and streamed result; falls back to manual | Reviewer is waiting for it |
| Video summary / translation | Background, cached | |
| Dashboard aggregation | On-read aggregation pipelines with cache tags at MVP volumes; summary collections rebuilt by a job (`$merge`) if any pipeline exceeds ~200 ms | Do not pre-optimise |
| Monthly / annual report compile + PDF | Scheduled job; produces a **draft** for approval | Never auto-published |
| Stripe reconciliation, hash-chain verification, abandoned-upload cleanup, consent-expiry check | Scheduled jobs | |
| Social publishing | Background, per platform | |
| Data export / account deletion | Background | |

### 18.3 Notifications

- **Categories** as listed in blueprint §13, each individually switchable per channel (email, in-app). Defaults: followers get milestone and completion emails; everything else opt-in.
- **Recipients** are computed at send time: followers of the project, plus supporters whose verified donations were designated or allocated to it.
- **Batching:** more than one event for the same user within an hour is combined; a weekly digest option exists.
- **Every email** has a one-click unsubscribe (signed token, no login) and a link to preferences. Transactional messages (receipts, security alerts) are exempt from marketing preferences but are limited to those purposes.
- **Delivery tracking:** provider webhooks update `email_deliveries`; hard bounces and complaints suppress the address.
- **Failure:** retries with back-off; after the limit the delivery is marked failed and counted on an admin health panel. A failed notification never affects the publication it describes.
- **Sender domain:** move off `onboarding@resend.dev` ([.env.example](.env.example)) to an authenticated sfuganda.com sender with SPF, DKIM, and DMARC.
- SMS / WhatsApp: later, via an approved provider, as the blueprint says.

---

## 19. Security, Privacy, and Child Safeguarding

### 19.1 Security controls

| Area | Current | Required |
|---|---|---|
| Authentication | None | §12.1 |
| Authorisation | None | §12.4 — service-level, scoped, tested by matrix |
| Admin access | n/a | MFA; invitation-only; idle timeout; step-up for sensitive actions; `noindex`; no admin links in public HTML |
| Sessions | n/a | Revocable server-side sessions; secure cookie flags; rotation |
| CSRF | Not applicable yet | `SameSite=Lax`, `Origin` verification on mutations, JSON content type only |
| XSS | React escaping; no raw HTML use found | Keep user text as plain text or a restricted Markdown subset rendered through a sanitiser; never `dangerouslySetInnerHTML` with stored content; CSP with nonces (styled-components needs a nonce passed to its registry) |
| Injection | No database | **NoSQL operator injection** is the main risk: never pass `req.body`, `req.query`, or `req.params` values into a filter or update as objects; zod coerces every filter value to a scalar; sort keys and field names come from allow-lists; `$where` and server-side JavaScript disabled; Mongoose `sanitizeFilter` on as a second barrier |
| Security headers | None | `Content-Security-Policy`, `Strict-Transport-Security`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `frame-ancestors 'none'` — set in NEW `src/middleware.ts` / `next.config.mjs` for pages, and by `helmet` on the Express API |
| Rate limiting | None | §10.2 |
| File uploads | None | §14.3: content sniffing, size caps, re-encoding, scanning, random names, private by default, documents served as attachments from a separate origin |
| Media access | n/a | Signed URLs for anything not explicitly public |
| API | Anonymous JSON | Versioned, authenticated, least-data responses from projections |
| Secrets | Env file; live key on a laptop | Secrets only in the host's encrypted environment store; separate test and live keys per environment; restricted Stripe keys; rotation runbook; secret scanning in CI |
| Database | n/a | TLS; least-privilege database users as listed in §9.4 (the API user cannot change validators, indexes, or roles, and cannot modify insert-only collections); separate user for the private database; Atlas network access limited to the API host's addresses or a private link — never open to all addresses |
| API origin | n/a | The Express host accepts traffic only from Cloudflare (tunnel or authenticated origin pulls); `trust proxy` configured so the real client address is used for rate limits and audit; CORS allow-list of the site's own origins; JSON body limit of a few hundred kilobytes |
| Encryption | TLS at the edge | At rest by the providers; **application-level field encryption** for beneficiary identifiers, donor contact details, and OAuth tokens, with keys outside the database |
| Audit logging | None | §9.3 `audit_log`; includes **reads** of beneficiary and donor personal data |
| Dependencies | No scanning | Automated update PRs and vulnerability alerts; lockfile enforced in CI |
| Backups | n/a | Encrypted; access restricted to founders; restore tested (§21.6) |
| Third parties | Stripe, Resend, a webhook URL | Data-processing terms on file for each; minimum data sent; webhook signatures verified; outbound webhook for volunteers replaced by the database |
| Bot protection | Honeypot | Cloudflare Turnstile on volunteer, sign-up, and donation-start forms, verified server-side by the API; Cloudflare WAF managed rules in front of everything |

### 19.2 Privacy

- **Data inventory** to be published in the privacy policy: volunteers (name, email, phone, address), donors (email, country, amounts), supporters (account), staff, and beneficiaries (private database).
- **Lawful basis and notices:** consent for volunteers (already collected by checkbox; store the timestamp and wording version), contract/legitimate interest for donation processing. Donors and volunteers are worldwide, so GDPR-style rights are implemented for everyone: access/export, correction, deletion, objection.
- **Uganda:** the Data Protection and Privacy Act 2019 and its regulations apply to processing in Uganda and treat children's data as requiring guardian consent; registration with the data protection office may be required. **To be confirmed by local counsel** — this document does not give legal advice.
- **Retention:** financial records per statutory period (counsel to confirm; commonly 7+ years) — these are **not deleted** on account deletion; donor identity is detached and the ledger entry keeps an anonymous reference. Volunteer signups: 24 months inactive. Audit logs: 7 years. AI logs: 12 months. Abandoned uploads: 48 hours. Server logs: 30 days, no personal data in log lines (fix D2).
- **Deletion:** soft-delete with a 30-day purge job covering database, storage, CDN, and email suppression lists.

### 19.3 Child safeguarding

This is the highest-consequence area of the project and it starts from a conflict in the requirements: the thread asks for "pictures and stories for each child" (R-A); the blueprint says public profiles "should not expose children's full names, exact locations, personal histories, or sensitive information".

**Non-negotiable technical rules, enforced in code:**

1. **No public per-child pages, lists, or identifiers.** The public data model has no entity for an individual child. There is nothing to leak through an API because no public projection reaches the private database.
2. **Private database isolation.** Beneficiary collections live in a separate MongoDB database with their own database user, whose credentials are loaded only by the beneficiary service module. Names and birth dates are encrypted at field level by the driver before they reach the database, with the key held outside it. Every read is audited. Access: founder and a named safeguarding lead only.
3. **No exact locations.** Community coordinates are stored coarse (rounded to roughly 10 km or placed at the district centroid). Addresses of residential facilities are not stored in any public-projected table. All image metadata is stripped. Captions pass a check for address-like strings.
4. **Images of children require:** a `contains_minors` flag set by the uploader (and re-confirmed by the approver), a linked unexpired consent record covering the intended scope (web / social), and the approver's safeguarding checklist — no full name, no school or uniform identifiers, no location clues, child appropriately clothed and portrayed with dignity, not the sole identifiable subject of a hardship story.
5. **Captions and stories** use first name only *or a pseudonym*, no age + location + history combination, and are written about programmes rather than individual trauma.
6. **Aggregates only for money.** Children's fund figures are totals and counts, suppressed for very small groups.
7. **Takedown.** Any staff member can trigger immediate unpublish of a media item; it purges CDN copies and records the reason. Consent withdrawal does the same automatically.
8. **AI:** beneficiary records are never sent to an AI provider; names are masked in prompts; outputs describing individual children are rejected by validation.
9. **Search engines and scraping:** media of children is served with `noindex` image headers and without descriptive filenames.

**Required from the foundation before any real images of children are published (blocks R-A, not the MVP):** a written safeguarding and image-use policy; a guardian/caregiver consent form and process (who can consent for children without parents is a legal question in Uganda); a named safeguarding lead; a public `/safeguarding` page with a reporting contact.

**Existing site:** replace the stock-photo "stories" (D10) in Phase 0 with programme-level stories and non-identifying imagery, or label them unmistakably as illustrative.


---

## 20. Testing Strategy

### 20.1 Starting point and tooling

There are no tests today. Phase 0 installs the harness; from Phase 1 onward no service method merges without tests.

| Layer | Tool | Runs against |
|---|---|---|
| Unit | Vitest | Pure functions: money maths, progress calculation, policy rules, state machine, AI output validators, zod schemas |
| Integration | Vitest + a real MongoDB **replica set** (container or in-memory replica set in CI, migrated from scratch each run — a standalone instance cannot run transactions) | Services inside transactions; validators, privileges, and views; public projections; the integrity job |
| API | Vitest + supertest against the Express app with seeded actors | Status codes, error shapes, authz, idempotency |
| End-to-end | Playwright (desktop + a 360×740 mobile profile with network throttling) | The acceptance journey and critical paths |
| Accessibility | axe checks inside Playwright + manual screen-reader pass per release | All public pages, field form, admin queue |
| Performance | Lighthouse CI budgets on public pages; a small load script against a staging copy | §11.6 budgets; 50 concurrent readers, 10 concurrent staff |
| Security | Dependency audit, secret scanning, the authz matrix, upload fuzz set, operator-injection payloads (`$ne`, `$gt`, `$regex`, `$where`) against every endpoint, an external penetration test before the finance centre goes public | |
| Recovery | Scripted restore drill | §21.6 |

External services (Stripe, mail, video, storage, AI) sit behind interfaces with in-memory fakes for CI; contract tests run nightly against the real sandboxes.

### 20.2 What each test area must cover

| Area | Must prove |
|---|---|
| Authentication | Invitation single-use and expiry; MFA required for staff; lockout back-off; session revocation on suspend; cookies flagged correctly |
| Authorisation | Generated matrix: every role × action × (own / other / out-of-scope) → expected allow/deny. Missing policy entry fails the build. |
| Financial calculations | Property-based tests: Σ fund balances = Σ posted lines; transfers net to zero; reversal restores prior balances exactly; no float appears in any path; rounding is stable; multi-currency totals use the stored rate |
| Approval workflow | Every legal transition succeeds for the right role; every illegal transition and every self-approval fails; publish is all-or-nothing |
| Database | Using the API's own database credentials, `updateOne`/`deleteOne` on `ledger_entries`, `audit_log`, and `approval_events` are refused by MongoDB; validators reject wrong types (including a double where a `Long` is required), unknown fields, and approver = submitter; unique indexes hold; the public-read user cannot read base collections; migrations apply to an empty database and to a copy of the previous version |
| Integrity job | Seeded corruptions (dangling reference, transfer not summing to zero, ledger entry missing for a posted transaction, broken hash chain) are each detected and reported |
| Media | Wrong type by content, oversize, zero-byte, polyglot file, EXIF GPS present → rejected or cleaned; interrupted upload resumes; abandoned upload is cleaned up |
| AI safety | Fixtures where the model output (mocked) adds a number, a name, or a date → flagged; provider timeout → manual path; `ai_assisted` cannot publish without attestation |
| Notifications | Preferences respected; unsubscribe token works without login; provider failure retries then parks; duplicates suppressed by dedupe key |
| Mobile | Field form at 360px on throttled network: draft survives reload; duplicate submit creates one record |
| Backup / recovery | Restore to a point in time; verify row counts, hash chain, and that media references resolve |

### 20.3 Critical scenarios (required, named tests)

| # | Scenario | Expected result | Level |
|---|---|---|---|
| C1 | Unauthorised user requests financial records | 401 unauthenticated / 403 authenticated; response body contains no record data; audit row written for the denied attempt | API |
| C2 | Unauthorised user attempts to modify an accomplishment | 403; row unchanged; `version` unchanged | API + DB |
| C3 | Unapproved accomplishment attempts to become public | Direct status update refused by service and by DB check; public list and detail endpoints return nothing for it; its URL returns 404; its media URLs are not resolvable | Integration + E2E |
| C4 | Financial transaction modified after approval | Service refuses; a direct `updateOne` or `deleteOne` on `ledger_entries` with the API's database credentials is refused for lack of privilege; only a reversal succeeds, and balances afterwards equal the pre-posting state | DB |
| C5 | Private beneficiary information requested through a public endpoint | Automated sweep of every public route asserts no field outside the allow-list; the API's main database user cannot read the private database at all | Integration |
| C6 | Malicious file uploaded | Executable renamed `.jpg`, SVG with script, oversized PDF, scanner test file → asset marked `rejected`, never served, uploader told why | Integration |
| C7 | Large video upload fails midway | Connection cut at 60% → resume completes without restart; if abandoned, asset is cleaned up and the report remains a valid draft | E2E |
| C8 | Notification delivery fails | Publication still succeeds; delivery retried with back-off; parked after limit; visible on the admin health panel | Integration |
| C9 | AI produces incorrect information | Injected "25 chickens" where the report says 20 → span flagged, draft marked "needs fact check", cannot be accepted unedited | Unit + E2E |
| C10 | Database transaction fails halfway through a financial operation | Fault injected after line insert, before audit insert → nothing persisted, no outbox event, balances unchanged, client receives a retryable error; retry with same idempotency key posts exactly once | Integration |

Plus the blueprint's acceptance journey as one end-to-end test: field member on a phone submits with photo and expense → PM approves → finance verifies → director publishes → public page shows it with its ID → project progress and dashboard statistics change → an unauthenticated visitor can read it.

### 20.4 CI gates

Typecheck, lint, unit, integration, API, and build on every pull request; end-to-end and accessibility on merge to `main` against a preview deployment; nightly contract tests and dependency audit. Target coverage: 90%+ lines on `src/server/services`, `policy`, and money utilities; no numeric target for UI.

---

## 21. Deployment and Infrastructure

### 21.1 Environments

| Environment | Purpose | Data | Third-party mode |
|---|---|---|---|
| Local | Development | Seeded; local MongoDB replica set in a container | Stripe **test** keys only; mail captured locally; fake R2/Stream/AI |
| Preview | Front-end preview per pull request, pointed at the staging API | Staging database | Test/sandbox |
| Staging | Release rehearsal; restore drills; UAT by James and Leon | Separate Atlas project or cluster; anonymised or synthetic data | Test/sandbox |
| Production | www.sfuganda.com | Real | Live |

Today there is effectively one environment and a live key in local development (T13). Fix in Phase 0.

**Deployables:** three per environment — the Next.js front end, the Express API, and the worker — plus the Atlas cluster and Cloudflare configuration. API and worker are built from the same commit and released together.

### 21.2 Configuration

Front end (existing variables stay): `NEXT_PUBLIC_SITE_URL` (now mandatory, D6), `API_ORIGIN`, `REVALIDATE_SECRET`, `NEXT_PUBLIC_TURNSTILE_SITE_KEY`, `ERROR_TRACKING_DSN`.

API and worker (names indicative): `MONGODB_URI`, `MONGODB_URI_PUBLIC_READ`, `MONGODB_URI_PRIVATE` (beneficiary user), `SESSION_SECRET`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `R2_*`, `STREAM_*` (+ webhook secret), `TURNSTILE_SECRET_KEY`, `FIELD_ENCRYPTION_KEY`, `RESEND_API_KEY`, `MAIL_FROM`, `REVALIDATE_SECRET`, `AI_API_KEY`, `ERROR_TRACKING_DSN`. `STRIPE_SECRET_KEY` and the Resend key move from the front end's environment to the API's once the two existing routes are retired.

A NEW `server/src/env.ts` (and a small `src/env.ts` for the front end) validates all of them with zod at boot, so a missing value fails the deploy rather than a request. `.env.example` files are updated in the same pull request as any new variable.

### 21.3 Pipeline (NEW `.github/workflows/`)

```
PR:    install (lockfiles) → typecheck (web, server, shared) → lint → unit
       → integration + API tests (MongoDB replica-set service) → build web + server → front-end preview
main:  all of the above → run migrations on staging → deploy API + worker → deploy web → e2e + a11y on staging
tag:   run migrations on production (expand-only) → deploy API + worker → health check → deploy web → smoke test → notify
```

Order matters: the API is released before the front end that depends on it, and every API release must keep serving the previous front end (additive endpoints and fields only within a release). Migrations run as an explicit step with the migration database user, before the new code takes traffic.

### 21.4 Rollback

- **Front end:** redeploy the previous build.
- **API and worker:** redeploy the previous image; keep the last three. Safe because document-shape changes are backward-compatible and validator tightening ships one release after the code that needs it.
- **Database:** never rolled back by reverse migration in production; fix forward. For data damage, point-in-time restore into a new cluster and repair selectively.
- **Feature flags** (a simple collection- or env-driven module) for each P2+ feature so new surfaces can be turned off without a deploy.
- **Graceful shutdown:** the API stops accepting requests and finishes in-flight ones; the worker finishes or releases its current event. A deploy must never cut a ledger posting in half — and if it does, the transaction aborts as a whole.

### 21.5 Monitoring and logging

| Signal | Implementation |
|---|---|
| Errors | Error tracking on server and client with release tags and request IDs; personal data scrubbed |
| Logs | Structured JSON; no PII; 30-day retention |
| Health | `GET /api/health` (liveness) and a secret-guarded readiness check covering DB, storage, outbox lag |
| Uptime | External checks on `/`, `/accomplishments`, `/api/health` |
| Performance | Web vitals from real users; slow-query log |
| Business health alerts | Outbox dead events > 0; webhook failures; Stripe reconciliation mismatch; hash-chain verification failure; storage or video spend above threshold; backup job failure |
| Security monitoring | Alerts on: repeated failed sign-ins, role changes, access to beneficiary records, bulk exports, new admin device; weekly review of the audit log by the founder |

### 21.6 Backup and disaster recovery

| Asset | Protection | Target |
|---|---|---|
| Database | Atlas continuous backup with point-in-time restore (dedicated tier); plus a nightly encrypted `mongodump` to an R2 bucket under separate credentials | RPO ≤ 15 min; RTO ≤ 4 h |
| Object storage (R2) | Originals are written once under random keys and never overwritten; deletion happens only through the soft-delete job; nightly copy of `originals/` and `documents/` to a second bucket or provider | RPO ≤ 24 h |
| Video | Originals retained at the provider; source files optionally mirrored to object storage | |
| Configuration and secrets | Documented inventory in a password manager owned by the foundation, not by an individual developer | |
| Code | Git remote; the organisation, not a personal account, should own the repository | |

A **restore drill every quarter** into staging, with a written checklist and timing, is part of the definition of production-ready. The blueprint asks for "backup recovery" to be tested; an untested backup does not count.

### 21.7 Media delivery

Public derivatives behind a CDN with immutable, content-hashed URLs. Private objects via signed URLs only. Video via the provider's CDN.

### 21.8 Running cost

All of the software is free and open source: Next.js, Express, MongoDB's community server, Mongoose. The recurring costs are for running it. Figures below are orders of magnitude from general knowledge, not quotes — **check current price lists before budgeting.**

| Item | What production needs | Rough monthly order |
|---|---|---|
| MongoDB Atlas | A dedicated cluster, because continuous backup with point-in-time restore is not offered on the free or shared tiers | Tens of US dollars |
| API + worker host | Two small always-on Node processes | Low tens |
| Front-end host | Current host; a paid tier may be needed depending on its terms for donation sites | Zero to low tens |
| Cloudflare | DNS, CDN, basic WAF, and Turnstile are available on the free plan; R2 has a free storage allowance and no egress fees; **Stream is paid** per minute stored and delivered | Driven by video volume |
| Email, error tracking | Free tiers usually suffice at first | Zero to low |
| Stripe | No monthly fee; a percentage per donation | — |

Video is the only item that grows with use; set spending alerts. All accounts must be owned by the foundation with a payment method that does not depend on one person (Q11).

### 21.9 Free-tier path and its limits

Development, testing, and stakeholder demos can run entirely on free tiers. Launching with real donations on free tiers is possible but changes the guarantees in this document, and each compromise should be a decision James makes knowingly.

| Free option | What you give up | Minimum mitigation | Upgrade when |
|---|---|---|---|
| Atlas free cluster | No managed backups; small storage; shared, throttled resources; not intended by MongoDB for production | Nightly `mongodump` to R2 from a scheduled CI job, restore tested monthly. Recovery point becomes 24 hours, not 15 minutes. | Before the first real donation is recorded in the ledger |
| Free Node hosting that sleeps when idle | The worker stops: no notifications, no media processing, no integrity checks; first request after sleep is slow | Keep the API awake with an uptime ping; run outbox handlers inline after each request as a fallback | Before field staff rely on it daily |
| Cloudflare free plan | Limited WAF rule capacity | Usually sufficient for this site | If abuse appears |
| No Stream subscription | No transcoding or adaptive playback | Store compressed MP4s in R2 and play them directly, with strict size limits. Poor on slow connections — a temporary measure only. | Before daily video (R-B) is promoted publicly |

The one control with no free substitute is the ledger's recoverability. The recommendation is to pay for the dedicated Atlas tier from the moment Phase 4 goes live and to treat everything else as upgradeable on evidence.

---

## 22. Production Readiness Requirements

A release is production-ready when every line below is true for the features it contains.

| Category | Requirement |
|---|---|
| Correctness | All CI gates green; critical scenarios C1–C10 (those applicable) pass; acceptance journey passes on a real mid-range Android phone on mobile data |
| Truthfulness | No public number is a constant in code. Every figure traces to approved records, shows an "as of" date, or is labelled as a goal. |
| Security | MFA enforced for staff; authz matrix complete; headers and CSP live; rate limits live; secrets separated by environment; dependency audit clean of high/critical issues |
| Financial integrity | Posted transactions immutable at database level; separation of duties enforced; Stripe reconciliation job running and clean for 7 consecutive days |
| Safeguarding | Policy pages published; consent workflow live; EXIF stripping verified with a geotagged test image; takedown path tested |
| Privacy | Privacy policy and terms live; export and deletion paths working; no PII in logs |
| Operability | Error tracking, uptime checks, and alerts wired to a monitored inbox/phone; runbooks for: failed deploy, webhook backlog, restore, takedown, key rotation, staff offboarding |
| Recovery | Restore drill performed and timed within targets |
| Accessibility | Automated checks pass; manual keyboard and screen-reader pass on public pages and the field form |
| Performance | Budgets in §11.6 met |
| Documentation | README current; architecture overview; role guide for staff; one-page "how to submit a report" for field members |
| Ownership | Foundation-owned accounts for domain, hosting, database, storage, Stripe, mail; at least two people with founder-level recovery access |

---

## 23. MVP Scope

### 23.1 Goal

Sarah's Foundation can publish **verified** accomplishments, with evidence, from a phone in Uganda to the public site, and the numbers on the site come from records.

### 23.2 Included

| # | Item | Blueprint MVP item |
|---|---|---|
| 1 | Corrected home page (no invented figures; safe imagery; working links; policy pages) | — |
| 2 | Database, auth with MFA, six staff roles, audit log, admin shell | 6 |
| 3 | Projects with weighted milestones and computed progress | 4 |
| 4 | Accomplishments with revisions, permanent IDs, detail pages, timeline | 1, 2, 3 |
| 5 | Full approval workflow with separation of duties | 7 |
| 6 | Mobile field reporting with local drafts and resumable uploads | 9 |
| 7 | Photo upload and processing; video upload through a managed provider; `/videos` feed (R-B) | 5 |
| 8 | Donation capture by Stripe webhook; manual approved expenses; append-only ledger core; public per-project summary (received / spent by category / remaining) | 8 |
| 9 | Impact statistics for which a data source exists: active/completed projects, completed milestones, accomplishments published, verified contributions, funds invested, supporters (count of distinct donors), countries reached; others shown only once approved metric entries exist | 10 |
| 10 | One community with a stylised, coarse map | — |
| 11 | Staff email on submission / decision | — |

### 23.3 Explicitly excluded, and why each can wait

| Excluded | Why it is safe to defer |
|---|---|
| Supporter accounts, impact dashboard, following, supporter notifications | Public pages already show everything; donations are captured from day one so dashboards can be populated retroactively by verified email |
| Full transparency centre: fund-type breakdown, allocations UI, loans, reconciliation UI, published receipts, period close | The ledger core is in place and immutable; these are views and workflows on top of it. Public MVP page shows only what is recorded and says so. |
| Children's future fund and beneficiary records | Legally gated; highest sensitivity; no public feature depends on it |
| Business portal and sustainability tracker | Depends on businesses operating and on the full ledger; nothing to show yet |
| Real interactive map | One community; the stylised map is also the more private option |
| Before/after slider gallery | Requires an "after"; photos are collected from day one with capture dates so pairs can be made later |
| AI assistant | An optimisation of staff time, not a capability. Adding it before the approval workflow is proven adds risk. |
| Monthly/annual reports and PDFs | Need months of approved data to be meaningful |
| Social cross-posting, multilingual summaries | Dependent on third-party reviews; site publication does not depend on them |
| Per-child pictures and stories (R-A) | Blocked on safeguarding policy and consent process |
| Multi-organisation UI | Schema is ready; second organisation not yet onboarded |
| Full offline submission | Local drafts remove the data-loss risk; blueprint defers it too |
| In-app notifications, SMS/WhatsApp | Email covers staff workflow |

### 23.4 Preconditions for launch

Answers to Q1–Q6 (§28.3); foundation-owned service accounts; staff invited with MFA enrolled, and **at least three distinct people** across author / reviewer-approver / finance so separation of duties can function; Stripe webhook verified in live mode; historical donations imported and approved; privacy, terms, and safeguarding pages reviewed.

### 23.5 Minimum bars

- **Security:** everything in §22 "Security" and "Safeguarding".
- **Testing:** authz matrix; C1–C4, C6, C7, C10; the acceptance journey; ledger property tests.
- **Operations:** error tracking, uptime checks, alerts, point-in-time recovery enabled, one successful restore drill, runbooks for deploy failure and takedown.

---

## 24. Detailed Implementation Phases

### 24.1 Assumptions behind the estimates

One senior full-stack developer, full-time, familiar with Next.js, Express, and MongoDB; design reuse as in §4 (no new visual design phase); decisions in §28.3 answered when their phase starts; estimates are **working weeks of implementation including tests and code review**, not calendar time, and exclude waiting on legal review, platform app approvals, and stakeholder feedback. Ranges reflect uncertainty, not padding.

### 24.2 Summary

| Phase | Name | Pri | Dev-weeks | Can run in parallel with |
|---|---|---|---|---|
| 0 | Stabilise and make the current site truthful | P0 | 1–1.5 | Start of 1 |
| 1 | Platform foundation | P0 | 3.5–4.5 | — (critical path) |
| 2 | Media pipeline | P1 | 1.5–2.5 | 3, 4 |
| 3 | Projects, accomplishments, approval, field reporting, public portal | P1 | 4–5 | 2, 4 |
| 4 | Donation capture and ledger core | P1 | 2–2.5 | 2, 3 |
| 5 | MVP hardening and launch | P1 | 1–1.5 | — |
| | **MVP total** | | **≈ 13–17** | |
| 6 | Full finance and transparency centre | P2 | 4.5–5.5 | 7 |
| 7 | Supporters, following, notifications | P2 | 3–4 | 6, 8 |
| 8 | Communities, businesses, sustainability, map, before/after | P2 | 3–4 | 7 |
| 9 | Reports and PDF | P2 | 2–3 | 10 |
| 10 | AI assistant and video summaries | P3 | 2–3 | 9, 12 |
| 11 | Children's future fund | P3 | 2–3 | legal-gated |
| 12 | Social cross-posting | P3 | 3–4 | app reviews start during Phase 2 |
| 13 | Multi-organisation productisation | P4 | 3–4 | — |
| | **Full blueprint total** | | **≈ 36–48** | |

**Critical path:** 0 → 1 → 3 → 5. Phases 2 and 4 are needed for the MVP but do not gate each other.
**Calendar:** with two developers splitting 2/4 against 3 after Phase 1, the MVP is roughly 10–12 calendar weeks; with one developer, 13–17 plus feedback time. The full blueprint is roughly six to eight months for two developers.

**On the blueprint's 13–18 weeks:** that figure is plausible only for a platform that already has authentication, a database, and an admin console. This one has none of those; Phases 0–1 alone (4.5–6 weeks) are work the blueprint's Phase 1 budgets at 2–3 weeks *including* UI design. The blueprint's "4–6 week" smaller version likewise assumed "a suitable existing platform". The revised MVP figure is 13–17.

**Effect of the stack decision on the estimate:** roughly one to one and a half weeks of the MVP, and about two weeks overall, are attributable to choosing Express + MongoDB over the single-application relational design in revision 1 — a second service to deploy and secure, the wiring between front end and API, and integrity controls (insert-only roles, validators, the integrity job) that a relational database provides without code. Some of that is recovered later: an always-on worker makes Phases 7 and 9 simpler than they would be on serverless functions.

### 24.3 Phases

#### Phase 0 — Stabilise and make the current site truthful (P0)

- **Objective:** remove what would discredit a transparency portal; create the engineering safety net.
- **Why now:** these are live defects, cheap to fix, and independent of every decision still open. CI must exist before backend code does.
- **Features:** none new.
- **Backend:** fix D1–D6 in the two routes (check `res.ok`, stop logging PII, validate and cap inputs, rate-limit, cents-accurate amounts, mandatory site URL); add `/api/health`.
- **Frontend:** remove or relabel D7–D9 figures ("Goal: $X" without a fake raised amount; remove the fixed 45% bar; drop "100% to the children" pending Q4); replace D10 stories; make footer and document links real or remove them (D11); add `/privacy`, `/terms`, `/safeguarding`; make `Button`, `Logo`, `Navbar`, `Footer` route-aware (T6); fix T14; add `error.tsx`, `not-found.tsx`, `robots.ts`, `sitemap.ts`.
- **Database:** none.
- **Infrastructure:** ESLint flat config and Prettier; Vitest and Playwright installed with one smoke test each; GitHub Actions pipeline; error tracking; uptime check; separate Stripe test keys for local and preview; remove unused three.js packages; update README.
- **Security:** security headers; secret scanning; rotate the Stripe key that has been on a laptop.
- **Testing:** unit tests for the two routes' validation; smoke E2E of home, donate redirect (test mode), and volunteer submit.
- **Dependencies:** Q3, Q4 for final copy (ship neutral wording if unanswered).
- **Definition of done:** CI required on `main`; no constant-backed "raised" figure on the site; volunteer endpoint returns an error when a sink fails; headers verified by scan.
- **Risks:** stakeholder reluctance to remove appealing figures — mitigate by showing they return, real, in Phase 4.

#### Phase 1 — Platform foundation (P0)

- **Objective:** a trusted server side: data, identity, permissions, audit, and the admin shell.
- **Why now:** every later feature depends on it; tenancy and audit cannot be retrofitted cheaply.
- **Features:** RBAC (20), audit logging (30), multi-community / multi-organisation schema (32, 33), admin shell (19).
- **Backend:** stand up the Express API and worker in NEW `server/` with the layering in §10.1; forward `/api/v1/*` from the front end; move the checkout and volunteer endpoints into the API and retire the two Next.js routes; env validation; error model; policy module with all roles; audit writer; outbox collection and worker loop; user invitation, role assignment, suspension; mail service wrapper with templates.
- **Frontend:** `/sign-in`, `/mfa`, invitation acceptance; `/admin` shell with navigation by role; users and roles screen; audit viewer; shared `DataTable`, `Dialog`, `Toast`, `StatusBadge`, state components.
- **Database:** `organizations`, `users`, `role_assignments`, `sessions`, `audit_log`, `outbox_events`, `communities`, `id_sequences`, `volunteer_signups`; validators and indexes; the five database users in §9.4 with insert-only privileges; seed script.
- **Infrastructure:** MongoDB Atlas cluster (replica set); an always-on Node host for API and worker; Cloudflare in front of both the site and the API (DNS, WAF, rate-limit rules, origin lock-down, Turnstile); staging environment; migration step in pipeline.
- **Security:** MFA; session policy; `middleware.ts` gates; CSP with nonce through the styled-components registry; `Origin` checks.
- **Testing:** authz matrix generator; auth flows; append-only enforcement; migration from empty.
- **Dependencies:** Phase 0 CI; decisions TD-2, TD-3, TD-4; Q6 (who holds which role), Q11 (account ownership).
- **Definition of done:** founder can invite a user, assign a scoped role, and see the action in the audit log; a field member cannot open `/admin/users`; restore drill performed once on staging.
- **Risks:** auth choice lock-in (mitigate: keep user and role collections in our own database); CSP friction with styled-components; session cookies not reaching the API if the forwarding is misconfigured — prove the sign-in round trip on staging in the first week; Mongoose silently storing amounts as doubles — settle the money type with a test before any finance code is written.

#### Phase 2 — Media pipeline (P1)

- **Objective:** safe, resumable uploads of photos, documents, and video from poor connections.
- **Why now:** accomplishments require evidence; parallel to Phase 3.
- **Features:** photo and video management (7), media uploads (23), `/videos` feed (R-B).
- **Backend:** upload tickets; completion; processing jobs (sniff, scan, re-encode, strip metadata, derivatives); video provider integration and webhook; signed URL service; cleanup job.
- **Frontend:** `Uploader` with compression, progress, resume; admin media library with flags and alt text; `Gallery`, `Lightbox`, `VideoPlayer`; migrate existing imagery to `next/image`.
- **Database:** `media_assets`, `media_links`, `consent_records`.
- **Infrastructure:** Cloudflare R2 buckets (private originals, public derivatives, documents) with lifecycle rules; Cloudflare Stream with webhook; CDN caching rules; malware scanner running beside the worker; cost alerts. **Begin social-platform developer app registrations now** (long lead time for Phase 12).
- **Security:** §14.3 in full; private by default; documents on a separate origin.
- **Testing:** C6, C7; EXIF-stripping test with a geotagged fixture; type-confusion fixtures.
- **Dependencies:** Phase 1; TD-5, TD-6; Q2 for the consent form fields; Q5.
- **Definition of done:** a 300 MB video uploads from a throttled phone profile with an interruption and plays on staging; a geotagged photo comes out with no metadata; an internal asset's URL is not publicly fetchable.
- **Risks:** HEIC handling on older Android; provider cost surprises; scanning latency.

#### Phase 3 — Projects, accomplishments, approval, field reporting, public portal (P1)

- **Objective:** the blueprint's core loop, end to end.
- **Why now:** this is the product; it needs Phase 1 and consumes Phase 2.
- **Features:** 1, 2, 3, 4, 5, 14 (stylised), 21, 22, 28 (subset).
- **Backend:** project and milestone services with progress calculation; accomplishment service with revisions; approval engine; publish transaction (§15.3); metric definitions and entries; public projections and read services with cache tags; staff notification emails.
- **Frontend:** `/field` flow with local drafts; admin queue, review screen with `ApprovalPanel`, `RevisionDiff`, history; project and milestone editors; public `/accomplishments`, detail, `/projects`, project tracker, `/impact`, `/communities`; home page sections switched to live data; new navigation.
- **Database:** `project_categories`, `projects`, `project_milestones`, `accomplishments`, `accomplishment_revisions`, `approval_events`, `metric_definitions`, `metric_entries`.
- **Infrastructure:** cache revalidation via outbox; web app manifest for `/field`.
- **Security:** separation of duties; unpublished = 404; safeguarding checklist at approval.
- **Testing:** state machine exhaustively; C2, C3; acceptance journey E2E on mobile profile; accessibility of timeline and tracker.
- **Dependencies:** Phases 1 and 2 (2 can land late for video); Q8 for which statistics to show.
- **Definition of done:** the blueprint §23 demonstration passes on staging with real people in each role.
- **Risks:** small team cannot satisfy separation of duties (Q6); scope creep in the admin UI — keep to the queue and editors listed.

#### Phase 4 — Donation capture and ledger core (P1)

- **Objective:** real money in, real money out, on an immutable ledger; public per-project summaries.
- **Why now:** the MVP needs truthful funding figures; building the ledger correctly first avoids migrating fake numbers later.
- **Features:** 9 (core), 10 (capture), 8 (summary only).
- **Backend:** Stripe webhook with signature verification and idempotency; donation recording with fee and net; refund and dispute handling; checkout route changes; transaction service (draft/submit/approve/post/reverse); expense drafts from field reports; public finance projection; Stripe backfill import.
- **Frontend:** donate flow gains optional project designation; admin finance: transaction list, create, approve, reverse, document attach; public `FundingBlock` and `FinanceBreakdown` on project and accomplishment pages; `/transparency` summary version.
- **Database:** `funds`, `financial_transactions` (with embedded lines), `ledger_entries` (insert-only), `expense_categories`, `financial_documents`, `donations`, `stripe_events`, `integrity_reports`; validators; insert-only privileges verified; hash chain; nightly integrity job; public finance views.
- **Infrastructure:** webhook endpoint registered for test and live; daily reconciliation job.
- **Security:** finance endpoints restricted (§10.3); step-up MFA on approval; documents private.
- **Testing:** ledger property tests; C1, C4, C10; webhook replay and out-of-order events; refund after allocation.
- **Dependencies:** Phase 1; TD-8, TD-15; Q1, Q4, Q7, Q12.
- **Definition of done:** a test-mode donation appears as a posted transaction with correct fee and net within a minute; an approved expense reduces the project's remaining funds; attempting to edit either fails at the database.
- **Risks:** unknown legal recipient of funds; historical data quality; currency handling if UGX expenses are recorded from day one.

#### Phase 5 — MVP hardening and launch (P1)

- **Objective:** meet §22 and go live.
- **Why now:** last gate before real data.
- **Features:** none new.
- **Backend / Frontend:** defect fixing; performance budgets; empty and error states reviewed; copy review.
- **Database:** production seed; historical import approved.
- **Infrastructure:** production environment; alerts; runbooks; restore drill; DNS and mail authentication.
- **Security:** dependency audit; headers scan; internal review of authz matrix; optional external review (required before Phase 6 goes public).
- **Testing:** full suite on staging; manual accessibility pass; real-device test in Uganda by Leon.
- **Dependencies:** Phases 0–4; §23.4 preconditions.
- **Definition of done:** §31 checklist, MVP column, complete; first real accomplishment published as `SFU-2026-0001`.
- **Risks:** real-device/network surprises — schedule Leon's trial in the first days of this phase, not the last.

#### Phase 6 — Full finance and transparency centre (P2)

- **Objective:** the complete blueprint §7 with fund separation.
- **Why now:** builds on a ledger that has been running with real data.
- **Features:** 8, 9 (complete), 10 (allocation), 29.
- **Backend:** allocations as approved transfers; restricted-fund enforcement; loans; offline donations; dual approval threshold; period close; reconciliation records; redacted document publishing; multi-currency with stored rates.
- **Frontend:** `/transparency` full: totals by fund type, project selector, charts with table alternatives, document archive; admin ledger, funds, reconciliation, period close.
- **Database:** `reconciliations`; fund additions; FX fields in use.
- **Infrastructure:** rate source job if multi-currency.
- **Security:** external penetration test before public release; redaction review step.
- **Testing:** restricted-fund misuse rejected; period lock; C1 across all new endpoints.
- **Dependencies:** Phase 4; Q1, Q7, Q12.
- **Definition of done:** public totals per fund type reconcile to the private ledger and to Stripe for a closed month.
- **Risks:** publishing figures that later need correction — mitigated by reversals and "as of" dating.

#### Phase 7 — Supporters, following, notifications (P2)

- **Objective:** blueprint §12–§13.
- **Why now:** needs published content and recorded donations to be worth logging in for.
- **Features:** 15, 16, 17, 18.
- **Backend:** supporter signup and email verification; linking donations by verified email; follows; preferences; notification fan-out; unsubscribe; acknowledgements (receipts); export and deletion.
- **Frontend:** `/dashboard`; follow buttons; preferences; in-app notification list.
- **Database:** `supporter_profiles`, `project_follows`, `notification_preferences`, `notifications`, `email_deliveries`.
- **Infrastructure:** harden the worker for fan-out (batching, concurrency limits, lease-guarded second instance); authenticated sender domain.
- **Security:** donations never shown before email verification; SELF-only access tests; enumeration-safe signup.
- **Testing:** C8; preference matrix; cross-account access attempts.
- **Dependencies:** Phases 3, 4; Q1 for receipt wording.
- **Definition of done:** a donor who gave before creating an account sees their history after verifying; publishing a milestone emails followers once, respecting preferences.
- **Risks:** deliverability; mislinked donations from shared emails.

#### Phase 8 — Communities, businesses, sustainability, map, before/after (P2)

- **Objective:** blueprint §6, §9, §10, §11.
- **Why now:** depends on the full ledger and on businesses actually operating.
- **Features:** 6, 12, 13, 14 (real map).
- **Backend:** business services; production records with approval; sustainability calculation; community summaries.
- **Frontend:** `/sustainability`, business pages, `/communities` with a real map and list alternative, `/gallery` with `BeforeAfterSlider`.
- **Database:** `businesses`, `business_production`; category flags.
- **Infrastructure:** map tiles provider.
- **Security:** coarse coordinates only; captions checked.
- **Testing:** ratio excludes donations; slider keyboard operation; no precise coordinates in any response.
- **Dependencies:** Phase 6; Q8.
- **Definition of done:** the sustainability percentage for a month can be recomputed by hand from the listed revenue and expense rows.
- **Risks:** sparse data making dashboards look empty — design the empty states deliberately.

#### Phase 9 — Reports and PDF (P2)

- **Objective:** blueprint §16.
- **Why now:** needs several months of approved data.
- **Features:** 25, 26, 27.
- **Backend:** report compiler producing a frozen data snapshot; approval; PDF job; scheduled monthly draft.
- **Frontend:** admin report editor (summary text, photo selection); `/reports` archive.
- **Database:** `impact_reports`, `report_exports`.
- **Infrastructure:** PDF rendering in the worker process; font embedding.
- **Security:** reports use public projections only; finance sign-off on the financial section.
- **Testing:** figures in the PDF equal the snapshot equal the ledger at period end; accessible, tagged PDF.
- **Dependencies:** Phases 6, 8.
- **Definition of done:** a monthly report is drafted automatically, approved, and downloadable with matching numbers.
- **Risks:** layout effort for a "branded" PDF.

#### Phase 10 — AI assistant and video summaries (P3)

- **Objective:** §17 and R-D.
- **Why now:** the approval workflow is proven and there is a corpus of real reports to evaluate against.
- **Features:** 24, R-D.
- **Backend:** provider interface; prompt and validators; logging; caps; transcript and translation jobs.
- **Frontend:** "Draft description" in the review screen with highlighting; language picker on video pages.
- **Database:** `ai_generations`; summary cache.
- **Infrastructure:** provider account and budget alerts.
- **Security:** name masking; no beneficiary data; founder-only log access.
- **Testing:** C9; evaluation fixtures; timeout fallback.
- **Dependencies:** Phase 3; TD-13.
- **Definition of done:** an injected false number is flagged; an `ai_assisted` item cannot publish without attestation.
- **Risks:** over-trust by reviewers — the attestation and highlighting are the mitigation.

#### Phase 11 — Children's future fund (P3, legal-gated)

- **Objective:** blueprint §8.
- **Why now:** only after legal structure and safeguarding governance exist.
- **Features:** 11.
- **Backend:** private-database service module; per-child sub-ledger dimension; distributions with founder approval; aggregate projection with small-number suppression.
- **Frontend:** restricted admin screens; public summary block.
- **Database:** separate private database and its collections; dedicated database user; field-level encryption.
- **Infrastructure:** separate connection and credentials loaded only by the beneficiary module; encryption key management outside the database.
- **Security:** audited reads; step-up MFA; access limited to named individuals.
- **Testing:** C5; attempts by every other role; suppression thresholds.
- **Dependencies:** Phase 6; Q2, Q9.
- **Definition of done:** legal sign-off on file; no query path from a public endpoint to the private database.
- **Risks:** legal non-compliance; re-identification from small aggregates.

#### Phase 12 — Social cross-posting (P3)

- **Objective:** R-C.
- **Why now:** approvals from platforms take weeks and should have been requested in Phase 2.
- **Features:** auto-posting of approved videos to connected channels.
- **Backend:** OAuth connections; per-platform publishers; status tracking; retries.
- **Frontend:** connections screen; per-video post status and manual retry.
- **Database:** `social_connections`, `social_posts`.
- **Infrastructure:** platform developer apps.
- **Security:** encrypted tokens; `social` consent scope enforced.
- **Testing:** sandbox posting; token expiry; failure isolation from site publication.
- **Dependencies:** Phase 2; Q10; platform approvals.
- **Definition of done:** one approved video posts to each connected platform, with failures visible and retryable.
- **Risks:** approval refused or delayed; API policy changes. Fallback: TD-12 alternative.

#### Phase 13 — Multi-organisation productisation (P4)

- **Objective:** onboard a second orphanage without forking the code (R-F).
- **Features:** 33; plus candidates from blueprint §22.
- **Backend:** organisation resolution by domain; per-organisation settings and branding; inter-organisation transfers for "pay it forward".
- **Frontend:** brand strings and theme accents from organisation settings instead of `content.ts`; organisation admin.
- **Database:** no structural change if §8.6 was followed; a cross-organisation isolation test suite.
- **Infrastructure:** custom domains.
- **Security:** tenant isolation tests on every query path; consider a database per organisation at this point if isolation requirements rise.
- **Dependencies:** all prior; a real second organisation.
- **Definition of done:** two organisations on one deployment with no cross-visibility, proven by tests.
- **Risks:** hidden single-tenant assumptions — mitigated by scoping from Phase 1.

---

## 25. File-by-File Implementation Plan

### 25.1 Existing files

| Existing path | What changes | Why | Depends on | Pri |
|---|---|---|---|---|
| [package.json](package.json) | Replace `lint` script; add `test`, `test:e2e`, `typecheck` scripts (API and database scripts live in the NEW `server/package.json`); remove `three`, `@react-three/fiber`, `@types/three`; add dependencies chosen in §26 | T5, T11 | — | P0 |
| [next.config.mjs](next.config.mjs) | Security headers; `rewrites()` forwarding `/api/v1/*` and `/api/webhooks/*` to the Express API; image `remotePatterns` for the R2 public host; remove Unsplash once stock images are gone | T9, T8 | Phase 2 for hosts | P0/P1 |
| [.env.example](.env.example) | Document every new variable; change default sender | §21.2 | — | P0+ |
| [.gitignore](.gitignore) | Add test output and local DB artefacts | — | — | P0 |
| [README.md](README.md) | Rewrite: architecture, setup with database, scripts, environments | T15 | — | P0, then per phase |
| [docs/VOLUNTEERS_FEATURE.md](docs/VOLUNTEERS_FEATURE.md) | Mark as implemented; note the move to database storage | T15 | — | P0 |
| [src/app/layout.tsx](src/app/layout.tsx) | Keep fonts and providers; pass CSP nonce; organisation-aware metadata; structured data | CSP, SEO | Phase 1 | P0/P1 |
| [src/app/page.tsx](src/app/page.tsx) | Becomes an async server component fetching stats, projects, latest accomplishments and video from the API; passes props to sections | T7 | Phase 3 | P1 |
| [src/app/api/checkout/route.ts](src/app/api/checkout/route.ts) | Phase 0: fix in place — validation, cents-accurate amounts, mandatory site URL, rate limit. Phase 1: logic moves to the Express API (`POST /api/v1/donations/checkout`), gaining idempotency key, designation and organisation metadata, and customer email collection in Phase 4; **this file is then deleted** | D4–D6, §13.4 | Phase 0, then 1 and 4 | P0/P1 |
| [src/app/api/volunteer/route.ts](src/app/api/volunteer/route.ts) | Phase 0: fix in place — check sink responses; remove PII logging; validate `address`; length caps; rate limit. Phase 1: logic moves to the Express API (`POST /api/v1/volunteers`), persisting to `volunteer_signups` and sending mail via the outbox; **this file is then deleted** | D1–D4 | Phase 0, then 1 | P0 |
| [src/data/content.ts](src/data/content.ts) | Remove `raised`, invented stories, fixed stats, "100%"; keep marketing copy; `nav` becomes route links; later, brand strings move to organisation settings | D7–D10, T6 | Q3, Q4 | P0, P1 |
| [src/lib/registry.tsx](src/lib/registry.tsx) | Accept and apply a CSP nonce | CSP | Phase 1 | P0 |
| [src/lib/providers.tsx](src/lib/providers.tsx) | Add toast provider; nonce pass-through | — | — | P1 |
| [src/styles/theme.ts](src/styles/theme.ts) | Status colours; admin density tokens; chart palette | §4 | — | P1 |
| [src/styles/GlobalStyles.tsx](src/styles/GlobalStyles.tsx) | Remove no-op at line 31; visually-hidden utility; table base styles | T16 | — | P0 |
| [src/components/ui/Button.tsx](src/components/ui/Button.tsx) | Polymorphic (`a` / `Link` / `button`), `loading`, `disabled` | T6 | — | P0 |
| [src/components/ui/Field.tsx](src/components/ui/Field.tsx) | `aria-describedby`; export shared control styles for new inputs | §11.5 | — | P0 |
| [src/components/ui/Logo.tsx](src/components/ui/Logo.tsx) | Link to `/`; unique gradient ID via `useId` | T6, T14 | — | P0 |
| [src/components/ui/StatCounter.tsx](src/components/ui/StatCounter.tsx) | Render final value in server HTML (animation as enhancement) so numbers exist without JavaScript | Slow networks, SEO | — | P1 |
| [src/components/layout/Navbar.tsx](src/components/layout/Navbar.tsx) | Route links; active state; focus trap, Escape, `aria-modal` on the sheet; sign-in/dashboard entry | T6, T14 | — | P0 |
| [src/components/layout/Footer.tsx](src/components/layout/Footer.tsx) | Real links including Privacy, Terms, Safeguarding | D11, D12 | — | P0 |
| [src/components/layout/StickyDonate.tsx](src/components/layout/StickyDonate.tsx) | Remove fixed 45% bar or drive it from the featured project's real funding | D7 | Phase 4 for real data | P0 |
| [src/components/layout/DonationStatus.tsx](src/components/layout/DonationStatus.tsx) | Reimplement on shared `Toast`; wording that does not assert payment success beyond "thank you — your receipt comes from Stripe" | §13.4 | — | P1 |
| [src/components/sections/ImpactCounter.tsx](src/components/sections/ImpactCounter.tsx) | Props instead of `impactStats` import; "not yet reported" state | T7 | Phase 3 | P1 |
| [src/components/sections/OrphanageHub.tsx](src/components/sections/OrphanageHub.tsx) | Becomes project cards from the database; extract `ProgressBar`; link to `/projects/[slug]` | T7, D7 | Phases 3, 4 | P1 |
| [src/components/sections/OurStory.tsx](src/components/sections/OurStory.tsx) | Extract timeline visuals into a shared `Timeline` | reuse | — | P1 |
| [src/components/sections/ImpactMap.tsx](src/components/sections/ImpactMap.tsx) | Data from `communities`; larger hit targets; list alternative; replaced by real map in Phase 8 | T14 | Phase 3 | P1 |
| [src/components/sections/FeaturedStories.tsx](src/components/sections/FeaturedStories.tsx) | Replace with latest published accomplishments; `next/image` | D10, T8 | Phase 3 | P0 (content), P1 (data) |
| [src/components/sections/Transparency.tsx](src/components/sections/Transparency.tsx) | Figures from the public finance projection; real document links; link to `/transparency` | D8, D11 | Phase 4 | P0 (links), P1 |
| [src/components/sections/SponsorChild.tsx](src/components/sections/SponsorChild.tsx) | Use shared `Button`; decimal-safe amount; optional project designation; remove invented impact ratios and "100%"; correct ARIA on the toggle | D8, D9, T14 | Q4 | P0 |
| [src/components/sections/Volunteer.tsx](src/components/sections/Volunteer.tsx) | Use shared `Button` and zod schema | duplication | — | P1 |
| [src/components/sections/Hero.tsx](src/components/sections/Hero.tsx), [AreasOfImpact.tsx](src/components/sections/AreasOfImpact.tsx), [Testimonials.tsx](src/components/sections/Testimonials.tsx), [FinalCTA.tsx](src/components/sections/FinalCTA.tsx) | Copy review for unverifiable claims (e.g. the "$15,000" goal, a quote attributed to "A child in our care"); route-aware links | D7, D10, Q3 | — | P0 |
| [src/components/three/HopeScene.tsx](src/components/three/HopeScene.tsx) | Delete with the three.js dependencies (restore from git if the P4 3D idea is pursued) | T11 | — | P0 |
| [src/components/motion/Sunrise.tsx](src/components/motion/Sunrise.tsx), [Container.tsx](src/components/ui/Container.tsx), [Reveal.tsx](src/components/ui/Reveal.tsx), [SectionLabel.tsx](src/components/ui/SectionLabel.tsx), [styled.d.ts](src/styles/styled.d.ts), [tsconfig.json](tsconfig.json), [public/favicon.svg](public/favicon.svg) | No change required | — | — | — |

### 25.2 New files and directories (all NEW)

**Front end (existing Next.js app)**

| Path (NEW) | Contents | Pri |
|---|---|---|
| `eslint.config.mjs`, `vitest.config.ts`, `playwright.config.ts` | Tooling | P0 |
| `src/env.ts` | Validated front-end environment | P0 |
| `src/middleware.ts` | Redirect gates for `/admin`, `/field`, `/dashboard`; headers; CSP nonce | P0 |
| `src/lib/api.ts` | Typed API client for server components (with cache tags and cookie forwarding) and the browser | P0 |
| `src/lib/money.ts` | Display and parsing of minor-unit amounts (shares rules with `shared/`) | P1 |
| `src/app/error.tsx`, `not-found.tsx`, `robots.ts`, `sitemap.ts` | Framework files | P0 |
| `src/app/api/revalidate/route.ts` | Secret-guarded cache-tag invalidation called by the worker | P1 |
| `src/app/api/health/route.ts` | Front-end liveness | P0 |
| `src/app/privacy/`, `terms/`, `safeguarding/` | Policy pages | P0 |
| `src/app/sign-in/`, `mfa/`, `invite/[token]/` | Auth screens | P0 |
| `src/app/admin/**` | Staff console | P0 → |
| `src/app/field/**`, `src/app/manifest.ts` | Field reporting | P1 |
| `src/app/accomplishments/`, `accomplishments/[publicId]/`, `projects/`, `projects/[slug]/`, `impact/`, `communities/`, `transparency/`, `videos/` | Public portal | P1 |
| `src/app/dashboard/`, `sustainability/`, `gallery/`, `reports/` | P2 surfaces | P2 |
| `src/components/ui/*` additions, `portal/`, `media/`, `charts/`, `admin/` | §11.3 | P0 → |
| `tests/e2e/` | Playwright journeys | P0 → |

**Shared**

| Path (NEW) | Contents | Pri |
|---|---|---|
| `shared/schemas/` | zod request/response schemas, enums, money rules — imported by both sides | P0 |

**API and worker**

| Path (NEW) | Contents | Pri |
|---|---|---|
| `server/package.json`, `server/tsconfig.json`, `server/Dockerfile` | Separate package and build | P0 |
| `server/src/app.ts`, `server/src/index.ts` | Express app and API entry point | P0 |
| `server/src/env.ts` | Validated API environment | P0 |
| `server/src/middleware/` | Request ID, session → actor, rate limit, Turnstile verification, error handler | P0 |
| `server/src/routes/` | Endpoints in §10.3, including `webhooks/stripe` and `webhooks/stream` | P0 → |
| `server/src/services/`, `policy/`, `models/`, `integrations/` | Service layer (§10.1) | P0 → |
| `server/src/worker/index.ts`, `worker/handlers/`, `worker/jobs/` | Worker entry point, outbox handlers, scheduled and integrity jobs | P0 → |
| `server/migrations/` | Indexes, validators, views, database roles, backfills | P0 → |
| `server/scripts/seed.ts`, `server/scripts/import-stripe.ts` | Seed and backfill | P0, P1 |
| `server/tests/unit/`, `integration/`, `api/`, `fixtures/` | §20 | P0 → |

**Repository**

| Path (NEW) | Contents | Pri |
|---|---|---|
| `.github/workflows/ci.yml`, `deploy.yml` | Pipeline in §21.3 | P0 |
| `docker-compose.yml` | Local MongoDB replica set and mail catcher | P0 |
| `docs/architecture.md`, `docs/runbooks/*.md`, `docs/roles.md` | Operations documents | P1 |

---

## 26. Technical Decision Log

Status **Decided** means the project owner has chosen; the original recommendation is recorded where it differed.

| ID | Decision | Options | Outcome | Reason | Trade-offs | Impact on current architecture |
|---|---|---|---|---|---|---|
| TD-1 | Application shape | (a) Extend the Next.js app as a single modular application; (b) separate backend API; (c) rebuild | **Decided: (b), an Express API.** Revision 1 recommended (a). | Owner's preferred and familiar stack; an always-on process also simplifies background work | Second deployable to secure, deploy, and monitor; version coordination between front end and API | Adds `server/`; the two existing Next.js routes are retired |
| TD-2 | Database | PostgreSQL; MongoDB | **Decided: MongoDB (Atlas, replica set).** Revision 1 recommended PostgreSQL for the ledger. | Owner's preferred stack; good fit for the content side | No foreign keys, blocking triggers, cross-document constraints, or row-level security — replaced by the controls in §8.1; backups with point-in-time restore need a dedicated tier | New dependency; new env vars |
| TD-3 | Data access | Mongoose; native driver only; another ODM | **Mongoose with `strict: "throw"`**, native sessions for transactions | Familiar to MERN developers; schema and hooks | Must be verified for 64-bit integer handling; database validators are still required because the ODM can be bypassed | New `server/src/models` |
| TD-4 | Authentication | A maintained auth library with a MongoDB adapter; assembling sessions + password hashing + TOTP from established components; a dedicated identity SaaS | **Whichever provides TOTP MFA, revocable MongoDB-stored sessions, and invitations with least custom code**; users and roles stay in our own collections regardless | Staff MFA is mandatory; lock-in limited by owning the role data | Library = faster, dependency risk; assembled = control, more to test | New sign-in screens and API middleware |
| TD-5 | Object storage | Cloudflare R2; S3; other | **Decided: Cloudflare R2** | Part of the chosen stack; S3-compatible presigned multipart uploads; no egress fees | No built-in object versioning — handled by write-once keys and a second copy (§21.6) | `next.config.mjs` image host |
| TD-6 | Video | Cloudflare Stream; another managed platform; plain files in R2 | **Decided: Cloudflare Stream** | Part of the chosen stack; resumable direct upload, transcoding, adaptive playback, thumbnails | Paid per minute; plain files in R2 are a stopgap only (§21.9) | None on existing code |
| TD-7 | Background work | Outbox + in-house worker process; Redis-backed queue; hosted job service | **Outbox collection + worker process, at every phase** | The Express host already runs always-on processes; no extra vendor | Host must not sleep; scaling out needs lease-guarded jobs | New worker entry point |
| TD-8 | Ledger model | (a) Editable finance documents; (b) workflow documents + insert-only `ledger_entries` with reversals; (c) full double-entry chart of accounts | **(b)** | The split is what gives immutability in MongoDB; meets fund-separation needs without accounting-system complexity | Not a replacement for statutory accounting; maps onto double-entry later if an accountant requires it | New collections, roles, integrity job |
| TD-9 | Styling | Keep styled-components; migrate to CSS Modules / utility CSS now | **Keep now; revisit at Phase 13** | All existing UI depends on it; migration buys no user value today | Client-component overhead; upstream is in maintenance mode; CSP needs nonce plumbing | `registry.tsx` nonce only |
| TD-10 | Tenancy | `organization_id` field + scoped services now; a database per orphanage; add later | **`organization_id` everywhere now; tenant product later** | Retrofit is the expensive path | Slight overhead in every query, index, and test | Shapes every collection |
| TD-11 | Map | Stylised SVG; MapLibre + tiles; commercial maps SDK | **Stylised for MVP; MapLibre in Phase 8** | No keys or cost; coarse by nature | Less "interactive" at launch | Reuses `ImpactMap.tsx` |
| TD-12 | Daily video origin | (a) Upload to site, push to social; (b) post to social, pull into site | **(a) as requested, but ship site upload in MVP and social push in Phase 12; offer (b) if platform approvals stall** | (a) allows safeguarding review before anything is public | (a) costs more and depends on platform reviews; (b) weakens pre-publication control | Phase 12 scope |
| TD-13 | AI provider | Anthropic (Claude); OpenAI (named in blueprint); none | **Provider interface; default to a current Claude model** | Behaviour is governed by §17 validators, not the vendor; interface keeps it swappable | Either adds a data processor to the privacy policy | New integration module only |
| TD-14 | When the public ID is assigned | On draft creation; on publication | **On publication** | Published sequence has no gaps from rejected drafts | Drafts are referenced internally by `_id` until then | `id_sequences` |
| TD-15 | Base reporting currency | USD; UGX | **USD base, original currency preserved per line** — pending Q7 | Donations arrive in USD; field expenses occur in UGX | Requires a stated rate source and stored rates | Money module |
| TD-16 | API style | REST over Express; GraphQL; Next.js Server Actions | **REST over Express, versioned at `/api/v1`** | Field form needs idempotency keys and retry semantics over plain HTTP; simplest to secure and test | More endpoints to document | `server/src/routes` |
| TD-17 | Staff content format | Plain text; restricted Markdown; rich-text editor | **Restricted Markdown, sanitised** | Enough structure; minimal XSS surface | No inline layout control | Rendering component |
| TD-18 | API hosting | Always-on Node host (container/VM platform); Cloudflare Workers; serverless functions | **Always-on Node host behind Cloudflare** | Express, the MongoDB driver, `sharp`, and a persistent worker all assume a normal Node process; Workers support for this combination is unverified | One more provider; must be kept awake and patched | New `server/Dockerfile` |
| TD-19 | How the browser reaches the API | (a) Same origin: `/api/v1/*` forwarded to Express; (b) separate subdomain with CORS and a parent-domain cookie | **(a)** | First-party cookie, no CORS, simplest CSRF posture | Forwarding adds a hop; webhooks from Stripe and Stream may go directly to the API host | `next.config.mjs` rewrites or a Cloudflare route |
| TD-20 | Front-end hosting | Stay on the current host behind Cloudflare; move to Cloudflare | **Stay for now** | No value in moving during the build; avoids adapter risk | Two providers in the request path | None |

---

## 27. Risk Register

| # | Risk | Category | Severity | Likelihood | Mitigation |
|---|---|---|---|---|---|
| R1 | Identifiable images or details of children published without valid consent, or location revealed through metadata or captions | Child safeguarding | **Critical** | Medium (R-A asks for it) | §19.3 rules in code; consent records; EXIF stripping; approval checklist; takedown path; policy before any real images |
| R2 | Beneficiary private data reachable from a public or under-privileged path | Privacy | **Critical** | Low with design, high without | Separate database and database user; field-level encryption; no public projection touches it; C5 sweep; audited reads |
| R3 | Funds are received by an entity other than the one the site presents; receipts or claims made without legal basis | Legal / financial | **Critical** | Unknown (Q1) | Resolve Q1 before Phase 4 goes live; "acknowledgement" wording; counsel review |
| R4 | Posted financial data altered, or public totals disagree with reality | Financial integrity | **Critical** | Medium if built as CRUD | Insert-only ledger collection enforced by database privileges; nightly integrity job; maker-checker; reconciliation job; hash chain; "as of" dates |
| R5 | Privilege escalation or broken access control in admin | Security | **Critical** | Medium | Central policy; generated authz matrix; MFA; external test before Phase 6 public |
| R6 | Separation of duties cannot function with a two- or three-person team, leading to pressure for an override | Operational / financial | High | High | Q6; minimum three named people; no override in code; James as second approver |
| R7 | Children's future fund launched without a lawful structure | Legal | High | Medium | Phase 11 gated on Q9 and written sign-off |
| R8 | Misleading legacy claims remain on the live site ("100%", invented totals, stock "stories") | Reputational | High | Certain today | Phase 0 |
| R9 | Video uploads fail routinely on field connections; Leon abandons the tool | Technical / adoption | High | Medium | Resumable direct upload; text-first submit; early real-device trial; size limits; compression guidance |
| R10 | Social platform approvals delayed or refused | Third-party | High | Medium–High | Apply during Phase 2; Phase 12 isolated; TD-12 fallback |
| R11 | Stripe webhook misses or double-counts events | Financial integrity / third-party | High | Low–Medium | Signature verification; idempotency table; daily reconciliation; replay tooling |
| R12 | Scope and timeline expectations set by the blueprint's 13–18 weeks | Delivery | High | High | §24.2 explanation; MVP boundary agreed in writing; phase-by-phase sign-off |
| R13 | Malicious upload leads to stored XSS or malware distribution | Security | High | Low–Medium | §14.3; separate origin for documents; no SVG/HTML; scanning |
| R14 | AI text introduces false facts that a hurried reviewer approves | Integrity | Medium | Medium | Grounding validator; highlighting; attestation; logs; feature can be switched off |
| R15 | Historical donation import is incomplete or misattributed | Data migration | Medium | Medium | Import as pending; finance approval; reconcile to Stripe balance; mark imported records |
| R16 | Schema migration breaks production or blocks rollback | Deployment | Medium | Low–Medium | Expand/contract; staging rehearsal on a production copy; PITR |
| R17 | Service accounts owned by one individual; loss of access | Operational | High | Medium (Q11) | Foundation-owned accounts; two recovery holders; documented inventory |
| R18 | Backups exist but restore fails when needed | Operational | High | Medium without drills | Quarterly drill; alert on backup failure |
| R19 | Public pages slow on mobile due to client-heavy rendering and animation | Performance | Medium | Medium | Server rendering with cache; `next/image`; budgets in CI; minimal `/field` layout |
| R20 | Media and video costs grow unnoticed with daily uploads | Operational | Medium | Medium | Quotas; retention policy for originals; spend alerts |
| R21 | Coarse map or small-group aggregates still allow re-identification | Privacy | Medium | Low | Rounding; suppression thresholds; review by safeguarding lead |
| R22 | Email deliverability problems or complaints about notifications | Third-party | Medium | Medium | Authenticated domain; opt-in defaults; one-click unsubscribe; bounce suppression |
| R23 | styled-components ecosystem stagnation or CSP incompatibility | Technical | Low–Medium | Medium | TD-9; isolate through primitives so a later swap is mechanical |
| R24 | Hidden single-tenant assumptions surface when a second orphanage is added | Technical | Medium | Medium | Scoping from Phase 1; isolation tests in Phase 13 |
| R25 | Unvalidated statistics (meals, jobs, volunteer hours) published because the dashboard "needs" them | Integrity | Medium | High | Show "not yet reported"; metric entries require approval; published definitions |
| R26 | Data-protection obligations (Uganda, donors abroad) unmet | Legal | High | Unknown | Counsel review; privacy policy; rights endpoints; retention jobs |
| R27 | MongoDB's compensating controls (§8.1) are skipped or weakened under schedule pressure, leaving finance as editable documents | Financial integrity / technical | **Critical** | Medium | Controls are Phase 4 exit criteria; tests C4 and the integrity-job suite are release gates; no finance feature ships without a clean integrity run |
| R28 | Inconsistent data from missing referential integrity (dangling fund, project, or media references) | Data integrity | High | Medium | Reference checks inside transactions; nightly integrity job with alerting; soft-delete instead of delete |
| R29 | NoSQL operator injection through request bodies or query strings | Security | High | Medium | Scalar-only filters via zod; allow-listed sort and field names; `sanitizeFilter`; injection payload tests on every endpoint |
| R30 | Amounts stored or computed as floating-point numbers | Financial integrity | High | Medium | `Long` enforced by validators; one money module; property tests; lint rule against arithmetic on amount fields |
| R31 | Front end and API drift apart (incompatible releases, cookie or forwarding misconfiguration) | Deployment | Medium | Medium | Shared zod schemas; API released first and kept backward-compatible; end-to-end tests on staging before every production release |
| R32 | Launching on free tiers: no database backups, sleeping worker | Operational / financial | High | Medium–High if cost is the driver | §21.9 mitigations; dedicated Atlas tier from Phase 4 go-live; uptime alert on the worker heartbeat |
| R33 | Database administrator access bypasses application controls | Financial integrity | Medium | Low | Two named Atlas owners; auditing where available; hash chain and off-site dumps make tampering detectable |

---

## 28. Dependencies

### 28.1 Technical dependency order

```
Phase 0 (CI, truthfulness)
   └─► Phase 1 (DB, auth, RBAC, audit, outbox)
          ├─► Phase 2 (media) ──────────────┐
          ├─► Phase 3 (projects → accomplishments → approval → field → public)
          └─► Phase 4 (Stripe webhook, ledger core) ─┐
                      └────────── Phase 5 (launch) ◄─┴─┘
Phase 4 ─► Phase 6 (full finance) ─► Phase 8 (business, sustainability) ─► Phase 9 (reports)
Phases 3+4 ─► Phase 7 (supporters, notifications)
Phase 3 ─► Phase 10 (AI)          Phase 6 + legal ─► Phase 11 (children's fund)
Phase 2 + platform approvals ─► Phase 12 (social)          all ─► Phase 13 (multi-organisation)
```

### 28.2 External services and accounts to be provisioned (owned by the foundation)

Front-end hosting; an always-on Node host for the Express API and worker; MongoDB Atlas; Cloudflare (DNS, CDN, WAF, Turnstile, R2, Stream); Stripe (live and test, webhook endpoints, restricted keys); email with an authenticated sfuganda.com sender; error tracking and uptime monitoring; AI provider (Phase 10); map tiles (Phase 8); social developer apps (apply in Phase 2); a shared password manager.

### 28.3 Decisions required from the foundation

| # | Question | Blocks | Needed by |
|---|---|---|---|
| Q1 | Which legal entity receives donations and owns the Stripe account? What is the foundation's registration status in Uganda? May receipts be issued, and in whose name? | Phase 4 go-live; receipts | Start of Phase 4 |
| Q2 | Is there a written safeguarding and image-use policy, a consent process for images of children, and a named safeguarding lead? How is R-A ("pictures and stories for each child") to be reconciled with the blueprint's own §6? | Any real images of children; Phase 11 | Start of Phase 2 |
| Q3 | Which fundraising goal is current — $15,000 (site), $1,500 (blueprint example), or "500k" (25 Sep message; which currency)? Where is "the picture" referred to? | Phase 0 copy; first project record | Phase 0 |
| Q4 | Should "100% to the children" stay? If so, who covers processing fees and operating costs, and can it be evidenced? | Phase 0 copy; operating-expense display | Phase 0 |
| Q5 | May the media manager publish daily videos without a second approver? Under what conditions? | Phase 2 workflow | Phase 2 |
| Q6 | Who, by name, holds each role? Are there at least three people so that author, approver, and finance are different? | Phase 1 seeding; launch | Phase 1 |
| Q7 | Reporting currency (USD or UGX), whether field expenses are recorded in UGX, and the exchange-rate source | Phase 4 | Phase 4 |
| Q8 | Definitions and evidence for each dashboard statistic (children supported, meals, jobs, volunteer hours, countries reached) | Phase 3 metrics | Phase 3 |
| Q9 | Legal structure for the children's future fund under Ugandan law; who may authorise distributions | Phase 11 | Before Phase 11 |
| Q10 | Which social channels, who owns them, and acceptance of platform review timelines — or preference for the import alternative (TD-12) | Phase 12 | Phase 2 (to apply early) |
| Q11 | Who owns and pays for hosting, domain, database, storage, Stripe, and email? Who holds recovery access? | Phase 1 provisioning | Phase 1 |
| Q12 | Do financial records exist before the platform (spreadsheets, bank or mobile-money statements, loans outstanding)? Should they be imported as opening balances? | Phase 4 import; Phase 6 | Phase 4 |

---

## 29. Definition of Done

### 29.1 For any change

- Type-checks, lints, and passes all tests in CI; new behaviour has tests at the lowest sensible level.
- Every new service method has a policy rule and is covered by the authz matrix.
- Every mutation writes an audit entry and is transactional; side effects go through the outbox.
- Inputs validated with shared schemas; errors use the standard shape.
- No public response exposes a field outside its projection.
- UI has loading, empty, error, and forbidden states; works at 360px; keyboard-operable; automated accessibility checks pass.
- No secret, personal data, or raw financial detail in logs.
- Migrations are backward-compatible and rehearsed on staging.
- Documentation and `.env.example` updated; feature behind a flag if P2 or later.
- Reviewed by a second person; for finance, policy, or safeguarding code, the reviewer checks against §13, §12, or §19 explicitly.

### 29.2 For a phase

Its "Definition of done" in §24.3 is demonstrated on staging to James (and Leon for field-facing work), and the applicable rows of §22 hold.

### 29.3 For the initial portal (blueprint §23)

A team member submits an accomplishment from a mobile phone with evidence; it passes review, finance verification where applicable, and approval by different people; it appears publicly with a permanent ID; the project timeline and verified statistics update; a visitor can understand what happened, see appropriate evidence, see project progress, and identify the next milestone; and the platform has passed the mobile, accessibility, privacy, security, financial-accuracy, and backup-recovery checks in §20–§22.

---

## 30. Recommended Implementation Order

1. **This week:** send Q1–Q6 and Q11 to James; rotate the Stripe key and switch local development to test keys; begin Phase 0.
2. Phase 0: CI, lint, test harness, error tracking; fix D1–D6; remove D7–D11; policy pages; route-aware primitives.
3. Phase 1: provision MongoDB Atlas, the API host, Cloudflare, and staging; stand up the Express API and worker and prove the sign-in round trip through the front end; core collections with validators and database users; auth with MFA; policy module and authz matrix; audit log; outbox; admin shell.
4. In parallel once Phase 1's schema and auth are merged:
   - **Track A (critical path) — Phase 3:** projects and milestones → accomplishments and revisions → approval engine → field form → public pages → home page on live data.
   - **Track B — Phase 2 then Phase 4:** upload tickets and image processing → video provider → Stripe webhook → ledger core → public finance summary. Also submit social platform app registrations.
5. Phase 5: hardening, Leon's real-device trial at the start, restore drill, runbooks, launch. **MVP live.**
6. Phase 6 (full finance) and Phase 7 (supporters and notifications) in parallel.
7. Phase 8 (businesses, sustainability, map, before/after).
8. Phase 9 (reports) and Phase 10 (AI) in parallel.
9. Phase 12 (social) when approvals land; Phase 11 (children's fund) when legal sign-off lands.
10. Phase 13 when a second organisation is ready to onboard.

With a single developer, run Track B's Phase 2 before Track A's field form (the form needs the uploader), and Phase 4 after Phase 3.

---

## 31. Final Production Readiness Checklist

**MVP launch**

- [ ] Q1–Q6, Q11 answered in writing
- [ ] No hard-coded factual figures, invented stories, or dead links on any public page
- [ ] Privacy, terms, and safeguarding pages published and reviewed
- [ ] CI required on `main`; all suites green
- [ ] Production, staging, and preview environments separated; test keys outside production; `src/env.ts` validation passing
- [ ] Database with point-in-time recovery; nightly off-platform dump; **one timed restore drill completed**
- [ ] All staff invited individually; MFA enrolled; at least three distinct people across author / approver / finance; founder recovery held by two people
- [ ] Authz matrix complete and passing; C1–C4, C6, C7, C10 passing
- [ ] Security headers and CSP live; rate limits live; secret scanning on; no high/critical dependency advisories
- [ ] Upload pipeline verified: type sniffing, scanning, metadata stripping (tested with a geotagged image), private-by-default
- [ ] Posted ledger entries immutable at database level (verified by a direct update and delete attempt using the API's own database credentials)
- [ ] Nightly integrity job running, alerting, and clean for 7 consecutive days
- [ ] Amount fields verified as 64-bit integers in the database (no doubles) by a query over every finance collection
- [ ] Express API reachable only through Cloudflare; Atlas network access restricted to the API host; Turnstile verified server-side
- [ ] Worker heartbeat monitored; outbox has no dead events
- [ ] Stripe webhook verified in live mode; historical donations imported and approved; reconciliation clean for 7 days
- [ ] Acceptance journey passed on a real Android phone on mobile data in Uganda
- [ ] Public pages meet performance budgets on a throttled profile; accessibility checks and manual pass done
- [ ] Error tracking, uptime checks, and alerts delivering to a monitored destination
- [ ] Runbooks written: failed deploy, restore, takedown, key rotation, offboarding, webhook backlog
- [ ] README and role guides current; field-member one-pager delivered
- [ ] Service accounts owned by the foundation

**Before the full transparency centre is public (Phase 6)**

- [ ] External penetration test completed and findings resolved
- [ ] Fund-type totals reconcile to ledger, Stripe, and bank for a closed period
- [ ] Redaction process documented and followed for every published document
- [ ] Counsel review of financial claims and receipt wording

**Before supporter accounts (Phase 7)**

- [ ] Authenticated sender domain; unsubscribe and preferences working; export and deletion working
- [ ] Cross-account access tests passing

**Before the children's future fund (Phase 11)**

- [ ] Legal sign-off on file; safeguarding lead named; private database isolation and C5 verified; access list approved by the founder

**Before AI and social features (Phases 10, 12)**

- [ ] C9 passing; AI provider data terms reflected in the privacy policy; spend caps set
- [ ] Platform approvals granted; consent scope `social` enforced; failures isolated from site publication

---

## Final Summary

**Where the codebase stands.** A polished single-page marketing site with a sound front-end foundation and two small server endpoints. It stores nothing, authenticates no one, and records no donations. It also currently displays fundraising totals, impact ratios, and children's "stories" that are constants in a source file — the opposite of what the portal is meant to stand for.

**What must change.** The site needs a trusted server side added beside the existing UI: an Express API and worker on MongoDB, with Cloudflare for storage, video, and edge protection; authentication with mandatory MFA for staff, scoped role-based permissions enforced in one policy layer, an append-only audit log, direct-to-storage media handling with managed video, an outbox for reliable background work, a ledger in which posted entries cannot be edited — which, on MongoDB, depends on insert-only database privileges, validators, and a nightly integrity check rather than on the database's own relational rules — and the tests, pipeline, monitoring, and backups to run it. The front end is kept and extended; components stop importing facts and start receiving them from the server.

**What to build first.** Make the live site truthful and put CI in place (Phase 0). Then the foundation — data, identity, permissions, audit (Phase 1). Then the core loop of projects, accomplishments, approval, and field reporting, alongside the media pipeline and a minimal donation-and-expense ledger.

**Recommended MVP.** Phases 0–5: verified accomplishments with evidence, submitted from a phone, approved by different people, published with permanent IDs, updating project progress and statistics that are computed from records; daily videos on the site; real per-project funding summaries. About 13–17 working weeks for one senior developer, or 10–12 calendar weeks for two. Supporter accounts, the full transparency centre, businesses and sustainability, reports, AI, social cross-posting, and the children's fund follow in that order.

**Biggest technical risks.** Exposure of children's identities or locations; financial data that can be altered or that disagrees with reality; broken access control; unreliable uploads on field networks; third-party approval delays for social posting; and a team too small to honour separation of duties. Two non-technical risks sit above all of them: uncertainty over which legal entity receives the money, and the absence of a written safeguarding policy.

**What "production ready" should mean for SF Uganda.** Every public number traces to an approved record and can be recomputed. Nothing reaches the public without a named person other than its author approving it. Posted financial entries cannot be changed, only reversed. No public route can reach a child's identity or location. A field worker on a weak connection does not lose work. The team is alerted when something breaks, can roll back in minutes, and has restored from backup at least once. And the accounts, keys, and data belong to the foundation rather than to any one individual.

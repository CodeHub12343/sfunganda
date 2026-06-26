# Volunteers Feature — End-to-End Flow & Implementation Plan

**Status:** Proposal · **Date:** 2026-06-26 · **Owner:** Engineering
**Source request:** James Bowser + Santiago Rueda (build a volunteer signup section on sfuganda.com)

---

## 1. What we're building (in plain terms)

A **"Volunteer With Us" section** on the Sarah's Foundation site where a supporter — *anywhere in the world* — can:

1. Tell us **where they are** (so we can group/segment them).
2. **Choose how they want to help** from a checklist (not free-form guessing):
   - 📣 **Daily social media sharing** (post our content to find donors)
   - 💬 **Text-message marketing** (share with their contacts)
   - 📧 **Email marketing** (forward our appeals)
   - 📄 **Physical flyer distribution** (we mail them flyers)
   - 🙋 **Whatever's needed / other** (free-text)
3. Leave their **contact + mailing info** (so we can email them tasks and, when they pick flyers, post physical flyers to their address).
4. Get a **clear confirmation** + immediate next step (e.g. "here's a graphic to share today").

The strategic goal (per the team): build a **grassroots volunteer army** that does daily organic outreach, and a **mailing list of flyer-distributors** we can ship printed material to.

---

## 2. Critical analysis of the current application

Understanding the current state is essential — it dictates *how* this feature must be built.

| Aspect | Current state | Implication for this feature |
| --- | --- | --- |
| **Framework** | Next.js 15, App Router | We can add real server-side form handling (API routes / Server Actions) — the platform supports it. |
| **Rendering** | Effectively a **static marketing landing page** — one `page.tsx` composing section components | The volunteer section slots in as **just another section component**, consistent with the existing pattern. |
| **Backend / data** | **None.** No API routes (`src/app` has only `layout.tsx` + `page.tsx`), no database, no env-configured services | This is the **biggest gap.** Volunteer signups need somewhere to go. We must introduce a data sink (see §5). |
| **Forms** | **None exist.** Even "Donate" CTAs are `href="#"` placeholders | No existing form pattern to copy — we set the convention. Build it well; donate flow can reuse it later. |
| **Content** | 100% centralized in [`src/data/content.ts`](../src/data/content.ts); components hold zero hardcoded copy | All volunteer copy + the task list **must** live in `content.ts` so the team edits it without touching code. |
| **Design system** | styled-components v6 + Framer Motion; reusable `Section`, `Container`, `Reveal`, `SectionLabel`, `Button` ([`src/components/ui/`](../src/components/ui/)) | Reuse these primitives verbatim — the form must look native to the site. |
| **Navigation** | Anchor-based, driven by the `nav` array in `content.ts` (`#story`, `#sponsor`, …) | Add a `#volunteer` anchor + nav entry. The Footer "Get Involved" column should link here too. |
| **Validation / state** | Local React state only (e.g. `SponsorChild` uses `useState`) | Form state = client `useState`; submission = POST to our new endpoint. |
| **Privacy/PII** | Site currently collects **no personal data** | This feature **introduces PII** (names, emails, phone, **postal addresses**). Triggers new obligations: consent, storage security, a privacy note. Treat seriously. |

**Bottom line:** The frontend pattern is clean and ready — adding a section is low-risk and idiomatic. The **only real architectural decision** is *where the submitted data goes*, because the app has no backend today.

---

## 3. End-to-end flow

```
┌──────────────────────────────────────────────────────────────────────┐
│  USER (anywhere in the world)                                          │
└──────────────────────────────────────────────────────────────────────┘
        │
        │  1. Lands on site / clicks "Volunteer" in nav or footer
        ▼
┌──────────────────────────────────────────────────────────────────────┐
│  #volunteer SECTION  (new <Volunteer /> component on the home page)   │
│                                                                        │
│   • Inspiring intro: "Help from wherever you are."                     │
│   • Task picker (multi-select cards): social / text / email / flyers   │
│   • Contact fields: name, email, phone (optional)                      │
│   • Location: country + city/region                                    │
│   • Mailing address fields  ── shown only if "flyers" is selected      │
│   • Consent checkbox + privacy note                                    │
│   • "Count Me In" submit button                                        │
└──────────────────────────────────────────────────────────────────────┘
        │
        │  2. Client-side validation (required fields, email format,
        │     address required when flyers chosen)
        ▼
┌──────────────────────────────────────────────────────────────────────┐
│  POST /api/volunteer   (new Next.js Route Handler)                     │
│                                                                        │
│   • Server-side re-validation (never trust the client)                 │
│   • Honeypot + basic rate-limit (spam protection)                      │
│   • Persist + notify (see §5 for the data sink options)                │
└──────────────────────────────────────────────────────────────────────┘
        │
        ├──► 3a. Store the signup (Google Sheet / Airtable / DB / email)  │
        ├──► 3b. Email the team a notification ("New volunteer: …")       │
        └──► 3c. (optional) Auto-reply to the volunteer with next steps   │
        │
        ▼
┌──────────────────────────────────────────────────────────────────────┐
│  4. CONFIRMATION state (in the same section, no page reload)           │
│     "You're in! 💛  Watch your inbox for today's share-pack."          │
│     + immediate share buttons (FB / X / WhatsApp / copy link)          │
└──────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌──────────────────────────────────────────────────────────────────────┐
│  5. TEAM follow-up (off-platform, manual at first)                     │
│     • Daily: send share-packs to social/text/email volunteers          │
│     • Weekly: batch + mail flyers to flyer-distribution volunteers      │
└──────────────────────────────────────────────────────────────────────┘
```

### State machine for the section UI
`idle → validating → submitting → success` (or `→ error`, which returns to `idle` with a message). Mirror the local-state approach already used in `SponsorChild.tsx`.

---

## 4. Data model

A single `VolunteerSignup` record. Keep it flat and CSV/Sheet-friendly.

```ts
type VolunteerTask =
  | "social-media"
  | "text-marketing"
  | "email-marketing"
  | "flyer-distribution"
  | "wherever-needed";

type VolunteerSignup = {
  // Identity & contact
  fullName: string;
  email: string;
  phone?: string;            // optional; required if text-marketing chosen

  // Location (everyone)
  country: string;
  cityRegion: string;

  // How they want to help (>=1 required)
  tasks: VolunteerTask[];

  // Mailing address — required ONLY when "flyer-distribution" is selected
  address?: {
    line1: string;
    line2?: string;
    city: string;
    stateProvince: string;
    postalCode: string;
    country: string;         // can default from `country` above
  };

  // Optional context
  note?: string;             // "Tell us how else you can help"

  // Consent & meta
  consent: boolean;          // must be true to submit
  submittedAt: string;       // ISO timestamp, set server-side
  source?: string;           // e.g. "website" / utm — for attribution
};
```

**Conditional-required rules (enforced client *and* server side):**
- `tasks.length >= 1`
- `flyer-distribution` selected → full `address` required
- `text-marketing` selected → `phone` required
- `consent === true` always

---

## 5. Where the data goes — the one real decision

The app has no backend today, so we must choose a sink. Ranked by fit for a small foundation that needs to *act on* this data manually (mailing flyers, sending share-packs):

| Option | How it works | Pros | Cons | Recommended? |
| --- | --- | --- | --- | --- |
| **A. Email + Google Sheet** (via a no-code form backend like Formspree, or a tiny script) | API route forwards to an email service and/or appends a row to a Google Sheet | Team already lives in email/Sheets; zero DB ops; instant "mail-merge" for flyers & share-packs; cheapest | Not a "real" database; manual de-dupe | ✅ **Yes — start here (MVP)** |
| **B. Airtable** | API route writes a row via Airtable API | Sheet-like UX + views/filters (e.g. "all flyer volunteers in the US"); good for segmenting | Another account/API key; free-tier row limits | ✅ Strong v2 upgrade |
| **C. Hosted DB** (Vercel Postgres / Supabase) | API route inserts a row | Proper, scalable, queryable | Overkill for MVP; ops + schema migrations; team can't browse it easily | Later, if volume grows |
| **D. Email-only** (e.g. Resend) | API route just emails the team each signup | Dead simple, no storage account | No central list; rebuilding the list from an inbox is painful | Fallback only |

**Recommendation:** **Option A for launch** — POST to `/api/volunteer`, which (1) emails the team and (2) appends to a Google Sheet (or routes through a form backend such as Formspree to do both). It directly serves the stated goal: a clean, exportable list of names + mailing addresses + chosen tasks the team can mail-merge from on day one. Revisit **Airtable (B)** once segmentation by location/task becomes a daily need.

> **Action required from the team:** decide the sink and provide credentials (a Google service account / Sheet ID, or a Formspree/Airtable/Resend API key). These go in **environment variables** (`.env.local`, already git-ignored) — never committed.

---

## 6. Frontend implementation plan (idiomatic to this codebase)

### 6.1 Content — `src/data/content.ts`
Add a `volunteer` block so the team owns the copy and the task list:

```ts
export type VolunteerTaskOption = {
  id: VolunteerTask;
  icon: string;          // emoji or icon key
  title: string;         // "Share on social media"
  blurb: string;         // "Post our content daily to reach new donors."
};

export const volunteer = {
  eyebrow: "Get Involved",
  title: "Help from wherever you are.",
  lede: "You don't need to be in Uganda to change a child's life. Pick how you'd like to help — we'll send you everything you need.",
  tasks: [ /* the 5 options above */ ],
  consentLabel: "I agree to be contacted about volunteering. We never sell your data.",
  successTitle: "You're in! 💛",
  successBody: "Watch your inbox for your first share-pack. Want to start now?",
};
```
Also add `{ label: "Volunteer", href: "#volunteer" }` to the `nav` array, and wire the Footer "Get Involved → Partner With Us / Share Our Story" links to `#volunteer`.

### 6.2 New section component — `src/components/sections/Volunteer.tsx`
- `"use client"`, styled-components, Framer Motion — same shape as `SponsorChild.tsx`.
- Wrap in `<Section id="volunteer" $tone="soft">` + `<Container>` + `<Reveal>` + `<SectionLabel>`.
- **Task picker:** multi-select cards (reuse the `Tier`-style toggle look from `SponsorChild`), each toggling a `VolunteerTask` in a `Set`/array in `useState`.
- **Conditional fields:** animate the mailing-address block in with `AnimatePresence` when `flyer-distribution` is selected (the codebase already uses this pattern).
- **Submit:** reuse `<Button variant="primary" full>`; show a spinner/disabled state while `submitting`.
- **Success state:** swap the form for a confirmation card with live share buttons (FB/X/WhatsApp/copy-link prefilled with the site URL + a rally line from `brand.rally`).
- Honor `prefers-reduced-motion` (GlobalStyles already sets the baseline).

### 6.3 Mount it — `src/app/page.tsx`
Insert `<Volunteer />` in the section flow. Recommended placement: **after `SponsorChild` / before `Transparency`**, or right before `FinalCTA` — i.e. once a visitor has seen the mission and the "give money" ask, offer the "give time" ask.

### 6.4 Reusable form primitives (small new additions)
The site has no inputs yet, so add minimal, themed primitives under `src/components/ui/` (e.g. `Field`, `Input`, `Checkbox`) styled from `theme.ts` tokens, so the donate flow and any future forms reuse them. Keep them tiny and consistent with `Button.tsx`.

---

## 7. Backend implementation plan

### 7.1 Route handler — `src/app/api/volunteer/route.ts`
```ts
export async function POST(req: Request) {
  // 1. Parse JSON body
  // 2. Honeypot check (hidden field must be empty) → silently 200 if filled
  // 3. Validate (mirror §4 rules) → 400 with field errors on failure
  // 4. Persist to the chosen sink (§5) + email the team
  // 5. (optional) fire auto-reply to the volunteer
  // 6. Return 200 { ok: true }
}
```
- Validate with a lightweight schema (hand-rolled or `zod` if we add it).
- Read all secrets from `process.env` — never hardcode.
- Wrap external calls in try/catch; on sink failure, still 200 to the user **only if** the email notification succeeded (don't lose a signup silently — log + alert).

### 7.2 Spam / abuse protection
- **Honeypot** hidden field (zero-friction, catches most bots).
- **Basic rate-limit** per IP (in-memory or upstash) — generous; this is low-volume.
- Optionally add a privacy-friendly CAPTCHA (e.g. Turnstile) only if spam appears.

---

## 8. Privacy, trust & compliance (do not skip)

This feature introduces the site's first PII collection, including **postal addresses**.

- **Consent checkbox is mandatory** before submit; store the consent + timestamp.
- **Privacy microcopy** near the submit button: what we collect, why, and "we never sell your data." Reuse the reassurance tone already in `SponsorChild`'s `Reassure` line.
- **Minimize:** only ask for the address when flyers are chosen; phone only when texting is chosen.
- **Secure storage:** whichever sink, restrict access (private Sheet, scoped API key). Secrets in env vars only.
- Add a short **Privacy** link in the footer if one doesn't exist (the Footer already has a "Trust" column — good home for it).

---

## 9. Confirmation & activation (turn signups into action)

The strategic value is *daily activation*, so the success state should immediately enable the volunteer:

- **Social-media volunteers:** show ready-to-share buttons (FB, X, WhatsApp, "copy link") prefilled with the site URL and a line from `brand.rally` ("Together We Win. Together We Rise.").
- **All volunteers:** "Check your inbox" — the auto-reply (or team) sends the first share-pack / confirms flyers are on the way.
- **Team ops (off-platform, documented in a runbook):**
  - Daily: send the day's graphic/copy to social/text/email volunteers.
  - Weekly: filter the list to flyer-distributors, mail-merge addresses, ship flyers.

---

## 10. Phased delivery

| Phase | Scope | Outcome |
| --- | --- | --- |
| **MVP (v1)** | Section UI + content in `content.ts` + `/api/volunteer` → email the team + append to Google Sheet (Option A) + success state with share buttons + consent/privacy | Live, capturing real volunteers and mailing addresses |
| **v2** | Move sink to Airtable for location/task segmentation; auto-reply email with first share-pack; reusable form primitives polished | Easier ops, instant volunteer activation |
| **v3** | Volunteer dashboard / personalized share-pack page; UTM attribution; analytics on conversion | Scale + measurement |

---

## 11. Open questions for the team

1. **Data sink:** Google Sheet + email (recommended) or Airtable? Who provides credentials?
2. **Auto-reply:** should volunteers get an instant confirmation email at launch, or will the team contact them manually first?
3. **Flyers:** any countries we *won't* mail to (cost)? Should we cap or note shipping regions?
4. **Privacy page:** do we have privacy-policy text, or should we draft a short one for the footer?
5. **Section placement:** after the donate section, or just before the final CTA?

---

## 12. File-by-file change summary

| File | Change |
| --- | --- |
| `src/data/content.ts` | Add `volunteer` block + task options; add `#volunteer` to `nav`; point Footer "Get Involved" links to it |
| `src/components/sections/Volunteer.tsx` | **New** — the signup section (form + conditional fields + success state) |
| `src/components/ui/Field.tsx` (+ `Input`, `Checkbox`) | **New** — minimal themed form primitives |
| `src/app/page.tsx` | Mount `<Volunteer />` in the section flow |
| `src/app/api/volunteer/route.ts` | **New** — POST handler: validate, spam-guard, persist, notify |
| `.env.local` (git-ignored) | **New** — sink/email credentials |
| Footer "Trust" column | Optional: add a Privacy link |
```

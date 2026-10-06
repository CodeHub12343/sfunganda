# Sarah's Foundation — Mobile-First Admin Redesign

**Status:** Design specification · **Audience:** Product, design, and engineering
**Scope:** The 13 admin sections exposed by `AdminShell` ([src/app/admin/AdminShell.tsx](../src/app/admin/AdminShell.tsx)) — Overview, Users, Audit log, Media library, Review queue, Projects, Finance, Businesses, Production, Reports, Children's fund, Social, Organisation.

The current admin is a 260 px fixed sidebar + 1200 px content column — a classic desktop SaaS pattern that collapses badly below ~900 px. This document redesigns the experience mobile-first, defines a reusable design system, and specifies per-page behaviour and responsive adaptation to tablet and desktop. The underlying functionality, routes, and role gates stay as they are.

---

## 1 · Design vision & UX principles

**Vision.** A calm, trustworthy admin that a founder can run from a phone between meetings — one hand, bright sunlight, thumb reach — and that the same team can expand into a dense multi-column desktop view without re-learning anything.

**Principles.**

1. **One task per screen on mobile.** No page tries to do five things at once. Secondary actions live behind a sheet or a details view, not in the margins.
2. **Hierarchy over density.** On a 375 px screen, three well-ranked numbers beat nine small ones. Progressive disclosure is the default; drill-down is cheap because navigation is persistent.
3. **The thumb owns the bottom third.** Primary nav, primary CTA, and destructive confirms sit where the thumb lives. Chrome lives at the top; danger lives behind a confirm.
4. **Status is never colour alone.** Every status badge pairs a colour with an icon and a label.
5. **The same product on every screen.** Tokens, components, and interaction grammar are shared; only layout density changes across breakpoints.
6. **Admin is a working surface, not a report.** Fast search, sticky filters, keyboard-less bulk actions, optimistic feedback. Every list view answers "what needs me right now?" above the fold.

---

## 2 · Mobile information architecture

The current flat 13-item sidebar is reorganised into four primary destinations plus a structured "More" drawer. Grouping is based on the roles that already exist in `AdminShell` and on frequency of use for an active admin day.

| Group | Items | Rationale |
|---|---|---|
| **Primary (bottom tabs)** | Overview · Projects · Finance · More | The three sections an admin opens most, plus the entry point to everything else. Users and Audit log were common desktop items, but on mobile they are mostly reactive (searching for a person, checking "who did X"); they live one tap deeper. |
| **More → Operations** | Review queue · Media library · Production | Day-to-day doing work. |
| **More → People & records** | Users · Audit log · Businesses | Directory-shaped sections. |
| **More → Programs** | Children's fund · Social · Reports | Programmatic / output-shaped sections. Children's fund stays visually distinct because of the step-up MFA and allow-list constraints it already carries. |
| **More → Settings** | Organisation · Account · Sign out | Terminal, infrequent. |

**Role gating is unchanged.** The visible-nav filter in [AdminShell.tsx:148](../src/app/admin/AdminShell.tsx#L148) still applies — a `media_manager` sees Media library in the More drawer but not Users, exactly as today. If a role has fewer than three primary destinations available, the bottom bar collapses to show only what the user can reach (e.g. a `finance_manager` sees Overview · Finance · Reports · More).

**Context lives at the top.** The compact top bar carries: menu-affordance (hamburger → the full drawer), the current page title, and the avatar (→ profile sheet). The foundation wordmark only appears on the Overview page, where there is room; elsewhere, title wins.

**Breadcrumbs become a back-chevron.** Mobile drill-down (list → detail → edit) uses a native-feeling back arrow plus the parent title. No desktop-style breadcrumb trail.

---

## 3 · Mobile navigation strategy

### 3.1 Top bar (56 px)

```
[≡]   Overview                            [🔔3] [👤]
```

- Left: menu button opens the full drawer (same contents as More, plus the four primary items highlighted). Needed so the drawer stays reachable without a long thumb-stretch to the bottom-left when scrolling with the right hand.
- Centre-left: page title (truncates with ellipsis).
- Right: notification bell with unread dot, then avatar. Tapping the avatar opens the profile sheet (name, roles, MFA status, Sign out).
- The top bar is sticky and shrinks shadow-only on scroll — no height change, no title shrink. Height stability matters more than reclaiming 20 px.

### 3.2 Bottom tab bar (64 px + safe-area inset)

Four tabs max, labels visible, 48 × 48 px touch targets, active state uses filled icon + accent colour + 2 px top indicator. Tapping the active tab scrolls the page to top; long-pressing it opens a per-tab quick-action sheet (e.g. long-press Projects → "New project").

### 3.3 The More drawer

A full-height sheet (not a thin side drawer), opened from either the hamburger or the More tab. Sections are grouped (see §2) with 12 px vertical rhythm between groups and 1 px dividers inside groups. Each item: 24 px icon · label · chevron. Items the current user cannot access are hidden, not disabled.

### 3.4 Tablet (768 – 1023 px)

- Bottom tabs are retained but widen; labels gain more spacing.
- A collapsible left rail (72 px icons-only, expands to 240 px on tap) replaces the full More drawer: the top five More items get rail slots, the rest stay in a secondary drawer.
- Content area allows a two-column list/detail where it earns its keep (Users, Projects, Review queue, Media library).

### 3.5 Desktop (1024 px +)

- Full 260 px sidebar returns, matching the current `AdminShell`. The same NAV array drives it.
- Bottom tabs disappear.
- All the mobile component variants stay — they just gain density (more columns, wider tables, inline filters instead of filter sheets).

---

## 4 · Design system

### 4.1 Colour tokens

Light theme first; every token has a dark counterpart. Values are shown as HSL so dark mode is a predictable lightness flip.

| Token | Light | Dark | Purpose |
|---|---|---|---|
| `--c-brand-600` | `#4F46E5` | `#6366F1` | Primary accent, filled buttons, active nav |
| `--c-brand-500` | `#6366F1` | `#818CF8` | Links, interactive text |
| `--c-brand-50` | `#EEF2FF` | `#1E1B4B` | Tinted surfaces, selected rows |
| `--c-accent-500` | `#8B5CF6` | `#A78BFA` | Secondary accent (used sparingly — Social, Children's fund hero) |
| `--c-success-600` | `#059669` | `#10B981` | Approved, paid, active |
| `--c-warning-600` | `#D97706` | `#F59E0B` | Pending, review needed |
| `--c-danger-600` | `#DC2626` | `#F87171` | Rejected, destructive, overdrawn |
| `--c-info-600` | `#0284C7` | `#38BDF8` | Neutral informational |
| `--c-bg` | `#FFFFFF` | `#0B0F19` | Page background |
| `--c-bg-soft` | `#F8FAFC` | `#111827` | App chrome / sidebar bg |
| `--c-surface` | `#FFFFFF` | `#161B26` | Cards |
| `--c-surface-raised` | `#FFFFFF` | `#1C2230` | Modals, sheets |
| `--c-border` | `#E5E7EB` | `#242B38` | Hairlines |
| `--c-border-strong` | `#D1D5DB` | `#2F3747` | Form field borders |
| `--c-ink` | `#0F172A` | `#F8FAFC` | Primary text |
| `--c-ink-muted` | `#475569` | `#9CA3AF` | Secondary text |
| `--c-ink-subtle` | `#94A3B8` | `#6B7280` | Captions, placeholders |

Contrast: every text-on-surface combination meets WCAG AA (≥ 4.5:1 for body, ≥ 3:1 for large text). Status tokens are paired with icons; never used alone.

### 4.2 Typography

System stack with Inter as the display face (already used in the reference mock). Scale is modular, 1.25 ratio, snapped to 2 px.

| Role | Size / line | Weight | Use |
|---|---|---|---|
| Display | 28 / 36 | 700 | Overview greeting, empty-state headlines |
| H1 | 22 / 30 | 700 | Page title in the content area |
| H2 | 18 / 26 | 600 | Section headings, card headings |
| H3 | 16 / 24 | 600 | Subsections, list group headers |
| Body | 15 / 22 | 400 | Default |
| Body-sm | 13 / 20 | 400 | Captions, metadata |
| Micro | 11 / 16 | 500 (uppercase) | Labels, status chip text |
| Numeric | tabular-nums | — | All currency and statistic values |

Mobile minimum body size is 15 px; captions never go below 12 px. Line length is capped at 68 characters on tablet+ via a `max-width: 60ch` on prose.

### 4.3 Spacing

4-based scale: `0.5, 1, 1.5, 2, 3, 4, 6, 8, 10, 12, 16` → `2 / 4 / 6 / 8 / 12 / 16 / 24 / 32 / 40 / 48 / 64 px`. Container gutter: 16 px mobile, 24 px tablet, 32 px desktop.

### 4.4 Radius & elevation

- Radius: `sm 6`, `md 10`, `lg 14`, `xl 20`, `pill 999`. Default for cards is `lg`, inputs `md`, chips `pill`.
- Elevation: level 0 flat; level 1 `0 1px 2px rgba(15,23,42,0.06)`; level 2 `0 4px 12px rgba(15,23,42,0.08)`; level 3 (sheets) `0 24px 60px rgba(15,23,42,0.18)`. Dark mode replaces shadows with `--c-border` strokes.

### 4.5 Iconography

24 px stroke icons at 1.75 px weight (Lucide or Phosphor). Tap targets around them are 44 × 44 px minimum. Status badges embed a 12 px filled icon.

### 4.6 Motion

- Durations: `fast 120 ms`, `base 200 ms`, `slow 320 ms`.
- Easing: `standard cubic-bezier(0.2, 0, 0, 1)` for most, `emphasis cubic-bezier(0.3, 0, 0, 1)` for sheets.
- Reduced-motion: swap sheets to instant, keep opacity cross-fades, cancel bounce.

---

## 5 · Responsive breakpoints

| Name | Range | Grid | Nav | Density |
|---|---|---|---|---|
| xs | 320–389 | 4 col, 16 gutter | Bottom tabs | Compact |
| sm | 390–767 | 4 col, 16 gutter | Bottom tabs | Standard |
| md | 768–1023 | 8 col, 20 gutter | Collapsible left rail + bottom tabs | +cards per row |
| lg | 1024–1439 | 12 col, 24 gutter | Full 260 px sidebar | Desktop |
| xl | 1440+ | 12 col, 32 gutter | Sidebar + wider content | Multi-pane |

**Transformation rules.**

- Any desktop multi-column dashboard becomes a vertical stack of ranked cards on xs/sm. A card never shrinks below the readable size — it goes under.
- Wide data tables → cards on mobile; two-pane list/detail on md; full table on lg+. Horizontal scroll only when the data is genuinely wide (ledger with 8+ meaningful columns) and only inside a bordered container with a visible scroll affordance.
- Filter bars (chips + search) collapse into a single "Filter" button that opens a bottom sheet on mobile, inline on tablet+, inline + saved views on desktop.

---

## 6 · Reusable component library

Each component below is one implementation with variants, not per-page one-offs. All components consume the tokens in §4.

**Layout.** `AppShell`, `TopBar`, `BottomTabBar`, `MoreDrawer`, `Page` (sticky header + scroll area + sticky footer slot), `Section`, `SplitPane` (md+).

**Surfaces.** `Card` (default / stat / media / action), `Sheet` (bottom / full), `Modal` (sm+ dialog), `Toast`, `Banner` (info / warning / danger with dismiss).

**Inputs.** `Button` (primary / secondary / ghost / danger / icon), `IconButton`, `Input`, `Textarea`, `Select` (native on mobile, custom combobox on md+), `Combobox`, `DatePicker` (uses native `<input type="date">` on mobile), `Toggle`, `Checkbox`, `Radio`, `SearchField`, `FilterChip`, `SegmentedControl`, `Pagination`, `InfiniteList`.

**Data display.** `StatTile`, `TrendLine` (sparkline), `BarChart`, `DonutChart`, `ProgressBar`, `ProgressRing`, `Timeline`, `ListRow` (one row grammar used by every list in the app), `TableResponsive` (table on lg, cards on xs/sm, hybrid on md), `Avatar` (with status dot), `Badge` (status/count), `KeyValue`, `EmptyState`, `Skeleton`.

**Workflows.** `ConfirmDialog`, `ReviewActionBar` (Approve / Request changes / Reject sticky bar), `UploadDropzone` (tap-to-pick on mobile, drag on desktop), `BulkSelectionBar` (sticky bottom when items selected), `ActivityMeta` (who / when / where tagline).

**One list row to rule them all.** Every list screen (Users, Projects, Businesses, Review queue, Transactions, Media list view, Children) uses the same `ListRow` shell: 48 px leading media (avatar / icon / thumbnail), two-line text (title + metadata), optional right-side status chip + chevron. This is the single most important consistency win on mobile.

---

## 7 · Page-by-page mobile UX

Each spec covers: **top-of-screen anchor** (what's above the fold), **core list/detail pattern**, **mobile actions**, **tablet/desktop adaptation**. Role gates in the current NAV array are preserved verbatim.

### 7.1 Overview — `/admin`

- **Anchor:** personalised greeting (`Good morning, {display_name}`), one headline sentence ("3 items need your review"), one primary CTA matching the top blocker.
- **Below:** horizontally scrollable stat tiles (Donations today, Pending reviews, Active projects, Children sponsored — filtered to user's roles). Each tile is 160 × 112 px with a 20 px numeric value and a tiny trend sparkline.
- **Then:** three stacked sections: *Needs you* (max 3 items — pending reviews, overdue reports, new users to approve), *Recent activity* (5 items from the audit stream, tapping expands), *Pinned projects* (user-pinned).
- **Mobile actions:** no bulk, just quick-create via long-press on the Projects tab.
- **Tablet/Desktop:** stat tiles arrange 4-up; Needs-you / Activity / Pinned become a 3-column grid; a right-rail chart (donations last 30 days) appears on lg+.

### 7.2 Users — `/admin/users`

- **Anchor:** sticky search + filter chip row (Role, Status, Joined). Chips open a bottom-sheet multi-select.
- **List:** `ListRow` — avatar · name + role · joined date · status chip. Alpha-grouped with a sticky letter header.
- **Detail (tap):** full-screen page — avatar + name header, role assignments as chips, contact rows, "Audit on this user" link, three primary buttons (Edit, Reset MFA, Suspend) in a sticky bottom bar.
- **Create/edit:** opens as a full-screen form on mobile, modal on md+. Multi-step form (identity → roles → permissions → review) with a progress stepper at top.
- **Tablet/Desktop:** list + detail two-pane on md; full table with inline bulk-select on lg.

### 7.3 Audit log — `/admin/audit`

- **Anchor:** search + date-range chip + actor/action filter.
- **Body:** reverse-chronological timeline, day grouped. Each row: icon · one-line summary · relative time · chevron.
- **Expand:** tapping expands inline to show before/after JSON diff (collapsible, syntax-highlighted) and the full target link.
- **Pagination:** infinite scroll with a "Jump to date" chip pinned to the top on scroll.
- **Tablet/Desktop:** two-pane with the diff pinned on the right; filter chips move inline.

### 7.4 Media library — `/admin/media`

- **Anchor:** segmented control (Images / Videos / Documents) + search + filter button.
- **Body:** 2-column grid on xs, 3 on sm, with aspect-ratio preserving thumbnails; metadata overlays on long-press.
- **Grid/list toggle:** icon in the header; list view uses the standard `ListRow`.
- **Upload:** FAB (floating action button, bottom-right above the tab bar) opens a sheet: Camera / Photo library / Files. Progress is shown as a sticky bottom banner for each in-flight upload with cancel.
- **Preview:** tap opens a full-screen viewer with pinch-zoom, caption, usage ("Used in 3 projects"), and Replace/Delete.
- **Tablet/Desktop:** grid becomes 4–6 columns; a right-rail inspector appears on lg; drag-and-drop upload.

### 7.5 Review queue — `/admin/queue`

- **Anchor:** segmented control (Pending / In review / Mine) with counts; priority chip (High / Normal) + content-type filter.
- **List:** `ListRow` with left-edge priority bar (2 px wide, coloured per priority — paired with a priority label so colour isn't the only cue).
- **Detail:** full-screen with the item preview up top (image, project card, financial record, etc.), a notes section mid, and a sticky `ReviewActionBar` at the bottom: Approve · Request changes · Reject. Request changes opens a textarea sheet.
- **Swipe gestures:** right-swipe = approve, left-swipe = request changes, both with a 300 ms confirm-and-undo toast.
- **Tablet/Desktop:** two-pane list/detail; keyboard shortcuts (A / R / C) with an on-screen hint row.

### 7.6 Projects — `/admin/projects`

- **Anchor:** search + status filter (Active / Paused / Complete) + sort chip.
- **List:** `Card` variant — thumbnail, title, status chip, progress bar, 3-line KPI row (Funded, Milestones done, Last update).
- **Detail:** stacked sections — hero image, status + progress, milestones timeline, team avatars, recent accomplishments, finances summary (deep-link to Finance filtered to this project), activity log.
- **Actions:** sticky bottom bar — Edit · Add milestone · Share. "Share" opens a sheet with public portal link + copy.
- **Create:** full-screen multi-step form.
- **Tablet/Desktop:** cards become a 2–3 column grid; detail uses tabs (Overview, Milestones, Finance, Updates, Audit) on lg.

### 7.7 Finance — `/admin/finance`

- **Anchor:** period selector segmented control (This month / Last 3 months / This year / Custom) + currency switcher (if multi-currency).
- **Hero card:** Balance, with Donations in / Expenses out as two sub-stats, and a 30-day trend line.
- **Then:** horizontal cards — Pending approvals, Allocations, FX exposure (if applicable).
- **Transactions:** `ListRow` — direction icon · counterparty · date · amount (right-aligned, tabular numerals, coloured per direction with an arrow icon).
- **Transaction detail:** full-screen — allocation breakdown, approvals (Phase 6 dual-approval shown as a two-signer stepper), related documents, audit stream for that record.
- **Reports entry:** a card linking to Reports pre-filtered to the current period.
- **Tablet/Desktop:** multi-pane with charts on the right; the transaction list keeps the card grammar but gains inline columns on lg.

### 7.8 Businesses — `/admin/businesses`

- **Anchor:** search + status filter.
- **List:** `ListRow` with 2-letter monogram avatar, name, partner tag, status chip.
- **Detail:** stacked — identity, contacts, projects linked, financial activity summary, documents, audit stream.
- **Actions:** Edit, Deactivate (confirm dialog), Link to project (sheet).

### 7.9 Production — `/admin/businesses/production`

- **Anchor:** segmented control (Open / In progress / Blocked / Done) + assignee filter (defaults to "Me" if the user is a `field_member`).
- **List:** `ListRow` with status badge, due date pill (red if overdue), progress bar underneath.
- **Detail:** task description, checklist (checkbox rows that save optimistically), attachments, comments.
- **Mobile emphasis:** `field_member` role lands here on sign-in since Production is often their only reason to open the admin. "Me" filter is default.

### 7.10 Reports — `/admin/reports`

- **Anchor:** category tabs (Financial / Impact / Compliance / Custom) + date range chip.
- **List:** `Card` variant with report name, period, generated-at, status (Ready / Generating / Failed), size.
- **Detail / preview:** inline preview on mobile is a summary with "Open full report" button that uses native share/open; download opens a sheet with format options (PDF / CSV / XLSX).
- **Generate:** FAB opens a sheet to pick report type and parameters.

### 7.11 Children's fund — `/admin/beneficiaries`

- **Access notice.** This section is already gated to founder + safeguarding_lead with step-up MFA. On mobile, if MFA has lapsed, the first screen is a dedicated MFA re-verify page, not a hidden-item fallback.
- **Anchor:** impact stat tiles (Children supported, Active sponsorships, Funds disbursed this period). The styling is deliberately subdued (no celebratory colour) — this is safeguarding-sensitive data.
- **Children list:** `ListRow` with **pseudonymous display name only** by default; initials avatar; program chip; a "sensitive — tap to view" shield icon.
- **Detail:** reveals full record only after a tap-and-hold-to-view (prevents shoulder-surfing); session timeout is shorter here. Sections — personal (collapsed by default), guardian/contact, program, funding ledger, updates, documents.
- **Audit:** every view is logged; a visible "Your access is being logged" banner stays pinned at the top of every detail screen.

### 7.12 Social — `/admin/social`

- **Anchor:** segmented control (Compose / Scheduled / Published / Analytics).
- **Compose:** chat-style editor at the top; media picker row; channel chips (Facebook, Instagram, X, LinkedIn — multi-select); schedule button opens a date-time sheet; Post button at the bottom. Character count per channel updates live.
- **Scheduled / published:** `ListRow` with post preview, channel icons, status, scheduled-for time.
- **Analytics:** stat tiles per channel with sparklines.

### 7.13 Organisation — `/admin/organization`

- **Anchor:** org identity card (logo, name, legal info, edit).
- **Sections:** Team (link to Users), Roles & permissions matrix (becomes a scrollable grid card on mobile, full matrix on lg+), Branding, Billing, Inter-org transfers (Phase 13 — a dedicated list with its own two-signer approval UI), Danger zone (destructive actions with confirm).
- **Founder-only** everywhere — the whole route is gated.

### 7.14 Cross-cutting: Sign-in, Profile sheet, Notifications

- **Sign-in** — single-column, large tap targets, MFA code field uses `inputmode="numeric"` and auto-advances. Session resume on return.
- **Profile sheet** (avatar tap) — name, roles, MFA status, theme toggle, Sign out.
- **Notifications** (bell tap) — bottom sheet with grouped items (Mentions / Approvals / System), swipe to dismiss, tap to deep-link.

---

## 8 · Interaction & micro-interaction

- **Touch targets:** 44 × 44 px minimum, 48 × 48 preferred for primary actions. Icon-only buttons have an invisible padding ring that reaches 44.
- **Pressed state:** 100 ms colour darken + 1 px scale-down (`0.98`).
- **Hover (desktop only):** 2 px elevation lift on cards; 1 px underline on text links.
- **Focus:** 2 px solid `--c-brand-500` outline with 2 px offset on everything focusable, visible for both keyboard and switch control.
- **Loading:** button shows a 16 px spinner left of the label and the label stays — never a disappearing label.
- **Optimistic updates:** list mutations (approve, archive) animate out immediately with a 4-second undo toast. Rollback on server error.
- **Swipe gestures:** reserved for list rows in Review queue and Notifications only; always paired with a visible button alternative.
- **Pull-to-refresh:** on all top-level lists.
- **Bottom sheets** for: filters, destructive confirms, multi-step pickers, upload sources. Dismiss on backdrop tap and on drag-down past 25% of height.
- **Confirmation dialogs** for destructive or hard-to-undo actions only (delete user, remove child, cancel donation). Everything else uses undo-toast.
- **Haptic feedback** (where available): light tap for selection, medium for success, heavy for destructive confirm.
- **Keyboard:** on form screens, the sticky bottom action bar moves above the keyboard; viewport uses `interactive-widget=resizes-content`.
- **Scroll-to-top** on bottom-tab re-tap.

---

## 9 · Accessibility

- **WCAG 2.2 AA** across the board; AAA for status indicators.
- **Colour independence:** every status pairs colour + icon + label. The priority bar in Review queue is paired with a text label on the row.
- **Contrast:** body text ≥ 4.5:1, large text ≥ 3:1, UI controls ≥ 3:1 against adjacent colour. Dark mode is verified separately, not inferred.
- **Font scaling:** honours user text-size preference up to 200% without horizontal scrolling. Layout uses `rem` throughout.
- **Semantic markup:** headings in order, landmarks (`<nav>`, `<main>`, `<aside>`), ARIA only where native semantics aren't enough. Bottom tabs are a `<nav role="tablist">` only if they behave as tabs (they do: switching tab replaces the content panel).
- **Screen reader:** every icon-only button has an `aria-label`. Status chips expose their text to AT. Toasts use `role="status"` for non-urgent, `role="alert"` for errors.
- **Reduced motion:** `prefers-reduced-motion` disables non-essential motion; sheets become fade+instant.
- **Motor:** no hover-dependent affordances; swipe gestures always have a button alternative; sticky action bars so users don't scroll to reach them.
- **Login/MFA accessibility:** OTP input uses `autocomplete="one-time-code"`; biometric unlock prompt is wired for returning sessions.

---

## 10 · State strategy (empty / loading / error / success / skeleton)

**Loading** — `Skeleton` matches the real layout exactly (same row count, same card sizes). For actions, use inline button spinners, not blocking spinners. For slow pages, show skeletons after 150 ms (not immediately — prevents flicker).

**Empty** — illustrated at ~200 × 160 px (SVG, inherits brand accent), one-line headline ("No pending reviews"), one-line body ("Nothing to approve right now."), optional primary CTA ("Browse projects"). Different copy per section — a generic "No data" is a failure.

**Error** — three severities:
1. *Field* — inline red text under the input + aria-describedby.
2. *Section* — a `Banner` component with a retry button, scoped to the failing section (don't fail the whole page).
3. *Page* — a full-screen state with a short diagnostic ("Can't reach the finance service"), retry CTA, and a "Report issue" link.

Network errors always distinguish "offline" (local) from "server error" (remote) because the fix differs.

**Success** — Toast at top on mobile (so it doesn't collide with the thumb reaching for the bottom bar), 4 s, with undo where applicable. For create flows, success replaces the form with the created record's detail view, not just a toast.

**Confirmation / destructive** — modal confirm with the subject named ("Delete donation #2458?"), the consequence spelled out ("This will reverse ledger entries 912 and 913"), and the destructive button on the right in `danger` variant.

**Skeleton copy guidance.** Never show "..." or blank. Show the shape of what's coming.

---

## 11 · Responsive behaviour, end-to-end

| Element | Mobile (xs–sm) | Tablet (md) | Desktop (lg+) |
|---|---|---|---|
| Primary nav | Bottom tabs (4) | Collapsible left rail + bottom tabs | 260 px sidebar (current `AdminShell`) |
| Secondary nav | Full-height drawer | Secondary drawer | Sidebar sections |
| Page title | In top bar | In top bar + content | Content header, large |
| Lists | Single column, cards | Two-pane list/detail | Table or two-pane with filters inline |
| Forms | Full-screen, one step per screen for complex | Modal dialog | Modal or inline panel |
| Filters | Button → bottom sheet | Inline chips | Inline chips + saved views |
| Charts | Full-width, simplified axes | 2-up, standard | Multi-chart grid, hover tooltips |
| Bulk actions | Long-press to select, sticky bottom bar | Checkbox column + sticky bar | Checkbox column + inline toolbar |
| Create CTA | FAB bottom-right | FAB or header button | Header button |
| Search | Icon → inline input | Inline input | Inline input + advanced |

**Rule of thumb.** When moving up a breakpoint, convert vertical stacks to columns only where the content earns the width (list + detail, chart + legend, form + preview). Don't fill width for its own sake; a 60ch cap on prose is kinder than 1200 px of line length.

---

## 12 · Implementation recommendations

**Token delivery.** Tokens from §4 live in a single `tokens.css` consumed via CSS custom properties on `:root` and overridden under `[data-theme="dark"]` and `@media (prefers-color-scheme: dark)`. `styled-components` reads them via `theme`; new work can migrate to CSS modules without blocking.

**Shell changes.** Refactor `AdminShell` into three mounted components: `TopBar`, `BottomTabBar` (hidden ≥ lg), and `Sidebar` (hidden < lg). The current `NAV` array stays as the single source of truth — add a `group: "primary" | "ops" | "people" | "programs" | "settings"` field and derive both the bottom tabs and the drawer from it. Role filtering ([src/app/admin/AdminShell.tsx:148](../src/app/admin/AdminShell.tsx#L148)) is unchanged.

**Component split.** Build the components in §6 as a thin `@/components/admin-mobile/*` layer first — don't retrofit the whole app at once. The first high-leverage shared pieces: `ListRow`, `Card`, `StatTile`, `Sheet`, `FilterChip`, `ReviewActionBar`, `Skeleton`, `EmptyState`.

**Charts.** Prefer a lightweight library (Recharts or Visx) and keep chart configs in `@/components/charts/*` so Finance, Overview, Children's fund, Social Analytics share them. Mobile variants: hide gridlines, use 4 ticks max, replace tooltips with tap-to-pin value chips.

**Testing matrix.** Golden-path smoke tests at 375 × 812 (iPhone 13 mini), 390 × 844 (iPhone 15), 768 × 1024 (iPad), 1024, 1440. Dark mode in parallel. Accessibility: axe-core in CI, manual VoiceOver + TalkBack passes for Review queue, Finance detail, and Children's fund (the three highest-stakes flows).

**Rollout order (suggested).**

1. Shell + tokens + bottom nav behind a flag.
2. Overview + Projects + Review queue (highest-frequency screens).
3. Finance + Users + Audit log.
4. Media library + Businesses + Production + Reports.
5. Social + Children's fund + Organisation.

**What not to change.** Routes, API shapes, role gates, and the Phase 6 / 11 / 13 workflow logic. This is a presentation-layer redesign — functionality is already specified by the backend phases and should not be reworked here.

---

### Appendix A — Mapping to current routes

| Section | Route (unchanged) | Roles (from `AdminShell` NAV) |
|---|---|---|
| Overview | `/admin` | founder, director, project_manager, finance_manager, media_manager |
| Users | `/admin/users` | founder, director |
| Audit log | `/admin/audit` | founder, director |
| Media library | `/admin/media` | founder, director, media_manager, project_manager |
| Review queue | `/admin/queue` | founder, director, project_manager |
| Projects | `/admin/projects` | founder, director, project_manager |
| Finance | `/admin/finance` | founder, director, finance_manager |
| Businesses | `/admin/businesses` | founder, director, project_manager, finance_manager |
| Production | `/admin/businesses/production` | founder, director, project_manager, finance_manager, field_member |
| Reports | `/admin/reports` | founder, director, project_manager, media_manager, finance_manager |
| Children's fund | `/admin/beneficiaries` | founder, safeguarding_lead |
| Social | `/admin/social` | founder, director, media_manager, project_manager |
| Organisation | `/admin/organization` | founder |

### Appendix B — Implementation roadmap

Six milestones, each a shippable slice. Estimates assume one full-time engineer; parallelise by splitting on the "Projects / Finance / Review queue" fan-out in M2.

Each milestone lists: **goal**, **deliverables** (files to add/change), **acceptance** (how we know it's done), **ships behind** (flag name — all mobile work lives behind `admin.mobileShell` until M6).

---

#### Milestone 0 · Foundations (3–5 days)

**Goal.** Tokens, shell, bottom nav — zero screen rewrites. Everything else builds on this.

**Deliverables.**
- `src/styles/tokens.css` — all tokens from §4 as CSS custom properties, with `[data-theme="dark"]` and `@media (prefers-color-scheme: dark)` overrides.
- `src/styles/theme.ts` — expose the same tokens to `styled-components` theme so existing code keeps working.
- `src/components/admin-mobile/AppShell.tsx` — the new mounted shell.
- `src/components/admin-mobile/TopBar.tsx`, `BottomTabBar.tsx`, `MoreDrawer.tsx`, `Sidebar.tsx`.
- `src/components/admin-mobile/nav.ts` — one `NAV` array with the `group` field, replacing the inline array at [AdminShell.tsx:77-136](../src/app/admin/AdminShell.tsx#L77-L136). Role gating identical.
- `src/lib/flags.ts` — thin wrapper around whatever flag system is used; default `admin.mobileShell = false`.
- Refactor [src/app/admin/AdminShell.tsx](../src/app/admin/AdminShell.tsx) so when the flag is on it renders `AppShell`, otherwise the current layout. No change to `layout.tsx` consumers.

**Acceptance.**
- With flag off: pixel-identical to today.
- With flag on at 375 px: bottom tabs + top bar visible, drawer opens, role filtering identical, every current route still reachable.
- Axe-core passes on `/admin` with flag on.

**Ships behind.** `admin.mobileShell`.

---

#### Milestone 1 · Core component library (3–4 days)

**Goal.** Build the eight highest-leverage components so M2+ screens are composition, not CSS.

**Deliverables.** All under `src/components/admin-mobile/`:
- `ListRow.tsx` (the one grammar — see §6).
- `Card.tsx` with the four variants.
- `StatTile.tsx` + `TrendLine.tsx` (sparkline wrapper around Recharts).
- `Sheet.tsx` (bottom + full), `Modal.tsx`, `ConfirmDialog.tsx`.
- `FilterChip.tsx`, `SearchField.tsx`, `SegmentedControl.tsx`.
- `Button.tsx` (primary/secondary/ghost/danger/icon), `IconButton.tsx`.
- `Skeleton.tsx`, `EmptyState.tsx`, `Banner.tsx`, `Toast.tsx`.
- `Avatar.tsx`, `Badge.tsx`.
- Storybook (or MDX gallery) at `/admin/_design` route — gated to `founder` for internal review.

**Acceptance.**
- Each component has light + dark variants, visible focus state, 44 × 44 min touch target.
- Keyboard navigation works for `Button`, `Sheet`, `Modal`, `SegmentedControl`.
- `ListRow` renders stably when any slot (leading, trailing, metadata line) is omitted.

**Ships behind.** `admin.mobileShell` (components mount but aren't referenced by live screens yet).

---

#### Milestone 2 · First three screens (5–7 days)

**Goal.** Prove the system on the highest-frequency pages. Pick these three because they stress-test lists, cards, sticky action bars, and sheets respectively.

**Deliverables.**
- **Overview** — rewrite [src/app/admin/page.tsx](../src/app/admin/page.tsx) per §7.1. Hits: `StatTile`, `Card`, `ListRow`, `TrendLine`.
- **Projects** — rewrite [src/app/admin/projects/](../src/app/admin/projects/) list + detail per §7.6. Hits: `Card`, `Sheet` (share), sticky action bar.
- **Review queue** — rewrite [src/app/admin/queue/](../src/app/admin/queue/) list + detail per §7.5. Hits: `ListRow` with priority bar, `ReviewActionBar`, swipe gestures, undo toast.

**Acceptance.**
- 375 px screenshots match the spec on every page.
- Tablet (768 px) shows list/detail two-pane for Projects and Review queue.
- Desktop (1280 px) unchanged in information — just denser.
- Dark mode verified side-by-side.
- Approve/reject in Review queue uses optimistic update + 4 s undo toast (per §8).

**Ships behind.** `admin.mobileShell`.

---

#### Milestone 3 · Finance + Users + Audit log (5–7 days)

**Goal.** Cover the three admin-heavy sections. Finance is the hardest page in the app — do it with the primitives from M1 or they're wrong.

**Deliverables.**
- **Finance** — rewrite [src/app/admin/finance/](../src/app/admin/finance/) per §7.7. Period selector, hero card, transaction `ListRow` with tabular numerals, dual-approval stepper on the transaction detail (sources Phase 6 state, no API changes).
- **Users** — rewrite [src/app/admin/users/](../src/app/admin/users/) per §7.2. Alpha-grouped list, multi-step create/edit form.
- **Audit log** — rewrite [src/app/admin/audit/](../src/app/admin/audit/) per §7.3. Timeline, expandable JSON diff. Reuse an existing diff library (e.g. `jsondiffpatch`) rather than rolling one.

**Acceptance.**
- Transaction list renders 100+ rows without jank at 60 fps (virtualise if needed — React Window).
- Users form validates per-step and preserves state across step navigation.
- Audit log loads older pages via infinite scroll; "Jump to date" chip works.

**Ships behind.** `admin.mobileShell`.

---

#### Milestone 4 · Media + Businesses + Production + Reports (4–6 days)

**Goal.** Cover the four less-complex sections. Mostly list + detail with the components already built.

**Deliverables.**
- **Media library** — rewrite [src/app/admin/media/](../src/app/admin/media/) per §7.4. Grid + list toggle, FAB upload sheet with camera/library/files, in-flight upload banner.
- **Businesses** — rewrite [src/app/admin/businesses/](../src/app/admin/businesses/) per §7.8.
- **Production** — rewrite [src/app/admin/businesses/production/](../src/app/admin/businesses/production/) per §7.9. Default "Me" filter when the user is a `field_member`.
- **Reports** — rewrite [src/app/admin/reports/](../src/app/admin/reports/) per §7.10. Format sheet for download.

**Acceptance.**
- Upload progress survives route navigation (uploads continue in a provider mounted at the shell).
- Reports download links work on iOS Safari (share sheet fallback for formats without native viewer).

**Ships behind.** `admin.mobileShell`.

---

#### Milestone 5 · Social + Children's fund + Organisation (5–7 days)

**Goal.** The sensitive and bespoke sections. Children's fund needs extra care — do a focused safeguarding review before merge.

**Deliverables.**
- **Social** — [src/app/admin/social/](../src/app/admin/social/) per §7.12.
- **Children's fund** — [src/app/admin/beneficiaries/](../src/app/admin/beneficiaries/) per §7.11. **Required additions:** MFA re-verify screen when step-up has lapsed, pseudonymous display, tap-and-hold reveal with a per-reveal audit event (resolves Appendix B q3 — pick explicit button if safeguarding lead prefers), access-logging banner.
- **Organisation** — [src/app/admin/organization/](../src/app/admin/organization/) per §7.13. Phase 13 inter-org transfers UI with two-signer approval.

**Acceptance.**
- Children's fund: every detail-view opens an audit event; MFA lapse is enforced client-side AND server-side (verify the API already does — don't rely on UI alone).
- Safeguarding lead sign-off recorded in the PR before merge.
- Organisation Danger zone shows a confirm dialog with the subject named per §10.

**Ships behind.** `admin.mobileShell`.

---

#### Milestone 6 · Launch (2–3 days)

**Goal.** Flip the flag.

**Deliverables.**
- Full QA pass across the device matrix in §12 (375 / 390 / 768 / 1024 / 1440, light + dark).
- Axe-core clean on every admin route in CI.
- Manual VoiceOver + TalkBack pass on Review queue, Finance detail, Children's fund.
- Rollout plan: internal users first (founder + directors) for 48 h, then full flip.
- Remove the flag and the legacy branch from `AdminShell` once stable.
- Delete the old desktop-only CSS paths. Keep the sidebar component — it IS the lg+ experience now.

**Acceptance.**
- Zero regressions reported in the 48 h internal window.
- Lighthouse mobile score ≥ 90 on Overview, Projects, Review queue.

---

#### Dependencies & parallelism

```
M0 ──► M1 ──► M2 ─┬─► M3 ─┐
                  ├─► M4 ─┼─► M6
                  └─► M5 ─┘
```

M2 through M5 can run in parallel once M1 lands. One engineer per track is comfortable; two per track if the deadline is tight.

---

#### Immediate next step

**Open PR #1: Milestone 0.** Scope it to tokens + shell + flag only. No screen changes. That PR is the gate for everything else — review it carefully because every subsequent file will depend on its API shape. A pre-flight before you open it:

1. Decide the flag mechanism (env var, LaunchDarkly, growthbook, etc.) — Appendix B doesn't cover this yet; add it or pick now.
2. Confirm the NAV grouping in §2 with the founder — a 15-minute call saves a week of rework.
3. Resolve Appendix B q1 (role-aware landing) because `AppShell` will encode it.

### Appendix C — Open questions for the team

1. Which role lands where by default on sign-in? Current app sends everyone to `/admin`; the mobile design assumes role-aware landing (e.g. `field_member` → Production).
2. Do we want a web-push notification layer tied to the bell, or is in-app only sufficient for v1?
3. Children's fund — is tap-and-hold-to-reveal acceptable, or does the safeguarding lead want an explicit "reveal" button with its own audit event per reveal?
4. Social analytics — pull from the external platform APIs or from our own tracking only? Affects what sparklines can show.

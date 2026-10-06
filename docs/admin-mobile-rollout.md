# Admin Mobile Shell — Milestone 6 Launch

**Owner:** Platform
**Flag:** `admin.mobileShell` ([src/lib/flags.ts](../src/lib/flags.ts))
**Scope:** All 13 admin sections ([src/app/admin/AdminShell.tsx](../src/app/admin/AdminShell.tsx)).

The feature flag now defaults to **ON** in production. This document is the step-by-step launch plan, the QA matrix we must clear before the full flip, and the post-stable cleanup.

---

## 1 · Pre-flip gates (block the flip until all checked)

- [ ] Milestones 1–5 merged on `main`.
- [ ] CI green on `main`: `web`, `api`, `secret-scan`, `e2e`, **`admin-a11y`** (new — axe-core).
- [ ] Full QA matrix pass (§3), light + dark.
- [ ] VoiceOver + TalkBack pass on Review queue, Finance detail, Children's fund (§4).
- [ ] Safeguarding lead sign-off recorded on the PR for Milestone 5.
- [ ] Lighthouse mobile ≥ 90 on Overview, Projects, Review queue (§5).
- [ ] Rollback instructions (§6) rehearsed by on-call.

---

## 2 · Rollout schedule

| T+ | Audience | How | Exit criterion |
|---|---|---|---|
| **0 h** | Founder + directors (3–5 users) | Flag defaulted on; staff cookies set `am-flag-admin-mobileshell=on` on sign-in | Zero regressions, zero rollbacks for 48 h |
| **+48 h** | All admin roles | No action — flag was already defaulted on; this is the stability milestone | 72 h of real traffic in production |
| **+1 week** | Public | Legacy branch deletion (§7) + flag removal | PR merged, legacy code gone |

Rollback at any time via the cookie override — see §6.

**Why cookies and not segmented delivery.** The flag already defaults ON, so there is no "flip" to time. Internal users opt in by setting the override cookie if they want the mobile shell before the public cutover; everyone else continues to see it by default. The 48 h window is for us to notice regressions, not for a feature-flag rollout.

---

## 3 · QA matrix (§12 of the design doc)

Run every row through every column, in both themes. Record defects in the "Admin-M6 QA" tracker.

| Device / viewport | Primary scenarios |
|---|---|
| **iPhone SE 2 (375 × 667)** | Bottom-tab reach, FAB clearance over keyboard, sheet height on short screens |
| **iPhone 15 (390 × 844)** | Default mobile |
| **Pixel 7 (412 × 915)** | Default Android |
| **iPad mini (768 × 1024)** | Tablet rail collapse / two-pane in Review queue |
| **MacBook Air (1440 × 900)** | Full sidebar, dense tables, inline filters |
| **Dark mode on each row** | Status colour contrast, logo monogram legibility |

**Admin surfaces to touch on every device:**

| # | Surface | Must verify |
|---|---|---|
| 1 | Overview `/admin` | Stat tiles, trend sparklines, tab re-tap scrolls to top |
| 2 | Projects list `/admin/projects` | Card grid, FAB create, pull-to-refresh |
| 3 | Projects detail | Milestones timeline, Finance deep-link, Share sheet |
| 4 | Finance `/admin/finance` | Period selector, transaction list, approval stepper |
| 5 | Finance detail | Dual-approval stepper, document attachments |
| 6 | Review queue `/admin/queue` | Swipe gestures + button alternatives; A/R/C keys on `md+` |
| 7 | Media `/admin/media` | FAB upload sheet, grid/list toggle, upload banner persists across routes |
| 8 | Businesses `/admin/businesses` | List, detail, link-to-project sheet, Retire confirm names the subject |
| 9 | Production `/admin/businesses/production` | State buckets, "Me" default for `field_member`, reject-reason sheet |
| 10 | Reports `/admin/reports` | Category tabs, format sheet (PDF / CSV / XLSX), iOS share-sheet fallback |
| 11 | Children's fund `/admin/beneficiaries` | MFA step-up, pseudonymous list, press-and-hold reveal, audit banner |
| 12 | Social `/admin/social` | Compose char counts, channel chips, scheduled/published lists, analytics |
| 13 | Organisation `/admin/organization` | Branding sheet, inter-org two-signer stepper, danger confirms name subject |

---

## 4 · VoiceOver + TalkBack manual pass

Required on the three safety-critical surfaces per the milestone.

### Review queue (`/admin/queue`)
- Rotor / headings: landmarks `nav`, `main`, `aside` reachable.
- Each row announces priority, title, status; the swipe gesture has a focusable button alternative.
- "Request changes" sheet traps focus; `Esc` / back-swipe closes.

### Finance detail (`/admin/finance/transactions/[id]`)
- Status badge reads out status label (colour-independent).
- Approval stepper announces "Step 1 of 2, signed by X" / "Step 2, awaiting Y".
- Document attachments reachable with a single swipe each.

### Children's fund (`/admin/beneficiaries`)
- Step-up form: OTP input uses `autocomplete="one-time-code"`; VoiceOver should announce "six-digit code".
- List rows announce ref_code + status + "sensitive, tap to view" (shield icon has `title`).
- Reveal modal: press-and-hold is operable with keyboard (`Enter`/`Space` triggers reveal); explicit "Reveal now" button is reachable.
- Access-logging banner is `role="status"` and reads out on each detail open.

Pass criterion: no screen-reader-only user is blocked from completing an approval / reveal / submission end-to-end.

---

## 5 · Performance budgets

Run `lhci autorun` or Lighthouse CI with the throttled "Mobile" preset.

| Surface | Target | Measured |
|---|---|---|
| `/admin` (Overview) | Perf ≥ 90, LCP < 2.5 s, CLS < 0.1 | _fill in_ |
| `/admin/projects` | Perf ≥ 90 | _fill in_ |
| `/admin/queue` | Perf ≥ 90, TTI < 3.5 s | _fill in_ |

If a surface misses by < 5 points, open a follow-up ticket but do not block the launch — the design doc caps M6 at "zero regressions", not "net improvement".

---

## 6 · Rollback

### Per-user emergency (any admin, now)
Set the cookie in the browser devtools or via the URL helper:
```
document.cookie = "am-flag-admin-mobileshell=off; path=/; max-age=86400";
```
Reload. The user falls back to the legacy desktop shell immediately. No deploy needed.

### Fleet-wide rollback (platform, within 10 min)
Set `NEXT_PUBLIC_FLAG_ADMIN_MOBILESHELL=0` in the Vercel production environment and redeploy (`vercel --prod`). The default flips off for every user who has not set a per-user cookie override.

### Full code-level rollback
`git revert <launch-commit>` and redeploy. The legacy branch is still present until §7 ships, so a code-level rollback restores the pre-launch admin verbatim.

Rehearse the first two paths before scheduling the launch commit.

---

## 7 · Post-stable cleanup (`+1 week`)

Once the 48 h window closes with zero regressions and the public rollout has been running for a few days, open **PR "Admin M6: remove mobile shell flag"** that:

1. Deletes `LegacyShell` from [src/app/admin/AdminShell.tsx](../src/app/admin/AdminShell.tsx) and makes `AppShell` the sole render path.
2. Removes every `useFlag("admin.mobileShell")` call site, inlining the mobile branch:
   - `src/app/admin/OverviewClient.tsx`
   - `src/app/admin/projects/page.tsx` and `src/app/admin/projects/[id]/page.tsx`
   - `src/app/admin/finance/page.tsx` and `src/app/admin/finance/transactions/[id]/page.tsx`
   - `src/app/admin/queue/page.tsx` and `src/app/admin/queue/[id]/page.tsx`
   - `src/app/admin/users/page.tsx`, `src/app/admin/audit/page.tsx`
   - `src/app/admin/media/page.tsx`, `src/app/admin/businesses/page.tsx`, `src/app/admin/businesses/production/page.tsx`, `src/app/admin/reports/page.tsx`
   - `src/app/admin/social/page.tsx`, `src/app/admin/beneficiaries/page.tsx`, `src/app/admin/organization/page.tsx`
3. Deletes every `Legacy*` function and its styled-components.
4. Removes the `"admin.mobileShell"` key from [src/lib/flags.ts](../src/lib/flags.ts) (changes `FlagKey = never`; verify there are no remaining consumers).
5. Deletes the old desktop-only CSS paths (none should be imported anywhere after step 3; search for `grid-template-columns: 260px 1fr` left outside `Sidebar.tsx`).

The `Sidebar` component stays — it IS the `lg+` experience now.

---

## 8 · Dashboards & alerts to watch during the 48 h window

- Error rate for `/admin/*` routes in Vercel analytics (target: ≤ pre-launch baseline + 10 %).
- `admin_route_latency_p95` in Grafana — must stay under 1.2× baseline.
- Sentry: filter `tag:admin.mobileShell=on`. New error signatures block the public rollout.
- Support channel `#admin-ops` for user-reported issues. Three independent reports of the same symptom = pause the rollout.

---

## 9 · Communication

- **T–24h:** Post in `#staff` with screenshots, link to this doc, and the cookie override command for anyone who wants to opt into the previous UI.
- **T+0:** Ship the launch commit.
- **T+48h:** Post the stability report (regressions, mitigations, perf numbers).
- **T+1 week:** Post the cleanup PR link; close the launch.

# Accessibility

The MVP commits to WCAG 2.1 AA on the public portal (`/`, `/projects`,
`/accomplishments`, `/communities`, `/impact`, `/transparency`, `/videos`)
and on `/field`. Admin screens aim for AA but are not gated on it for
launch.

## Manual pre-launch pass

Run this before every launch bump. A screen reader seat is required.

- [ ] Keyboard-only: can you reach every interactive control from the home
      page using Tab, Shift+Tab, and Enter? No traps.
- [ ] Visible focus ring on every control (buttons, links, inputs,
      lightbox nav).
- [ ] Skip link ("Skip to content") is the first focusable element on each
      page and reveals on focus.
- [ ] All non-decorative images have `alt`; decorative ones have `alt=""`.
- [ ] All form fields have an associated `<label>` or `aria-label`.
- [ ] Error messages are announced (aria-live="polite" on toasts,
      aria-live="assertive" on destructive confirmations).
- [ ] Color contrast ≥ 4.5:1 for body text, ≥ 3:1 for large text and UI
      components. Run axe DevTools on each public page.
- [ ] Zoom to 200% and 400%; no horizontal scroll on narrow viewports.
- [ ] Prefers-reduced-motion disables Framer Motion entrance animations.
- [ ] Lightbox: Escape closes, Arrow Left/Right navigates, focus returns
      to the triggering thumbnail on close.
- [ ] Video: captions available where provided; `playsInline` honored on iOS.

## Automated checks

- Playwright `test:e2e:a11y` runs axe-core across the public pages and the
  review screen; failures gate CI for serious + critical rules.
- `tsc --noEmit` plus eslint-plugin-jsx-a11y catch structural lapses.

## Keyboard reference

| Where | Key | Effect |
| --- | --- | --- |
| Any page | `/` | Focus the primary search (if present) |
| Lightbox | `Esc` | Close |
| Lightbox | `←` / `→` | Prev / next |
| Review screen | `Enter` on action buttons | Confirm the action |
| Admin tables | Up / Down arrows | Row focus (planned) |

## Known gaps for Phase 5

- Admin DataTable sorting is mouse-only; keyboard support planned for
  Phase 6.
- Markdown rendering on the public accomplishment page escapes HTML
  but doesn't support headings, lists, or links. The author tool needs a
  richer editor; Phase 6.

# Screen-reader manual-pass scripts

For Milestone 6 §4 of [admin-mobile-rollout.md](./admin-mobile-rollout.md). Hand this to the tester with a device that has either **VoiceOver** (iOS / macOS) or **TalkBack** (Android) enabled. Each script should take about ten minutes. Record the result on the launch PR.

Rotor / reading-controls shortcuts assumed:
- VoiceOver iOS: single-tap selects, double-tap activates, two-finger swipe up reads from top, rotor = twist two fingers on screen.
- TalkBack: single-tap selects, double-tap activates, two-finger swipe up jumps to top, local context menu = swipe up then right.

---

## Script A — Review queue (`/admin/queue`)

**Starting state.** Signed in as a `project_manager`. Queue has at least one pending item.

1. From the bottom tab bar, land on "Review queue". The tab must announce its label and selected state.
2. Rotor → **Landmarks**. You should hear `banner`, `main`, `navigation`. Confirm all three.
3. Rotor → **Headings**. The page heading reads "Review queue". No skipped levels (h1 → h2 → h3).
4. Move focus to the first list row. Expect: *"Pending priority, [title], [actor], tap to review"*. Priority must be spoken as a label, not a colour.
5. Open the item. The detail screen appears. Confirm the sticky action bar at the bottom is still reachable by swiping down (not caught behind the keyboard if one is open).
6. Activate **Approve**. The success toast must be announced with `role="status"`.
7. Return to the list. The approved item must be announced as removed when the next focus moves to the following row.

Pass if steps 1–7 require no sighted help.

---

## Script B — Finance detail (`/admin/finance/transactions/[id]`)

**Starting state.** Signed in as a `finance_manager`. A transaction awaiting dual approval exists.

1. Navigate to Finance → open any transaction with state **pending_approval**.
2. On the detail screen, read the top of the page. The amount, the direction (debit / credit) and the status badge must all be announced as labels, not colour-only cues.
3. Find the **approval stepper**. Each step must announce: step index, actor name (or "awaiting"), timestamp if present.
4. Reach the **Documents** section. Each attachment is a link with the file name read aloud — no "unlabelled graphic" entries.
5. Activate **Sign** (the approve button). The confirmation sheet opens; focus must move into the sheet; `Esc` / back gesture closes it and restores focus to the Sign button.
6. After signing, the stepper updates in place — the screen reader must re-announce the new step status.

Pass if the second signer could complete the approval without seeing the screen.

---

## Script C — Children's fund (`/admin/beneficiaries`)

**Starting state.** Signed in as a `safeguarding_lead`. Step-up MFA cookie has been expired on purpose for step 1.

1. Navigate to `/admin/beneficiaries`. The MFA step-up screen appears. The OTP input must announce "six-digit code" or similar (we set `autocomplete="one-time-code"`).
2. Submit the code. The list loads. Rotor → **Headings** → "Children's fund". Rotor → **Landmarks** → `main` includes the list.
3. Move to the first child row. Expected announcement: *"[REF_CODE], [programme or 'No programme'], [status], sensitive, tap to view"*. The shield icon has `title="Sensitive — tap to view"` and must be read.
4. Open the row. The reveal modal opens with focus on the "Press and hold" button. Activate it with **double-tap and hold** (iOS) / **long-press** (Android) and keep holding for ~1 s — the record reveals.
5. On the detail sheet: the pinned banner "Your access to this record is being logged" must be announced on open (it's `role="status"`).
6. Rotor → **Headings**: Personal / Guardian / Notes / Funding ledger. Personal is collapsed by default — the toggle must announce `aria-expanded`.
7. Dismiss. Pull server logs and confirm an audit row exists for your user at this time with `kind=beneficiary.read`.

Pass if the entire flow — step-up, reveal, close — is operable without visual feedback **and** the audit row is present.

---

## Reporting

For each script, record on the launch PR:

- Device + screen reader (e.g. "iPhone 15 Pro, iOS 17.5, VoiceOver").
- Pass / fail per step 1–N.
- Any announcement that was wrong, confusing or missing.
- A short clip of step 5/6 of script C (reveal + banner) — this is the hardest-to-regress interaction.

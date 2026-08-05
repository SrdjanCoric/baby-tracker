# Task 0063: Guarantee an exit from an activity screen opened by the widget

**Branch**: `feature/guarantee-exit-from-widget-opened-activity-screens`
**Depends on**: none
**Source**: Owner bug report and live diagnosis, conversation 2026-08-04 · **User stories**: a caregiver who taps the iOS widget to check a running timer can always get back into the app

## What to build

Tapping the iOS widget opens `sofibaby://<activity>` — `sofibaby://sleep`, `sofibaby://feeding`,
`sofibaby://diaper`, `sofibaby://pumping`, `sofibaby://tummyTime`. Expo Router resolves that URL
straight to the matching route. On a **cold launch** that route becomes the only screen in the
stack, because no `unstable_settings` anchor is declared for the root layout, the activity layouts,
or the tabs layout.

Those routes are registered with `presentation: "modal"`. A modal sitting at the root of the stack
has nothing beneath it to dismiss down to, so the swipe-down gesture does nothing. Every other exit
is dead in the same state:

- the sleep screen's close (×) control renders only under the E2E flag, so production shows an empty
  spacer in its place; `diaper` has no close control at all, and `feeding`, `pumping`, and
  `tummyTime` each differ again;
- the stop handlers end in `router.back()`, which is a no-op with no history — so stopping the timer
  leaves the caregiver on the same screen;
- the deep-link handler converts widget URLs into external timer commands and never navigates, so no
  route is ever pushed to go back to.

The owner hit this in real usage: opened the sleep screen from the widget while the baby was
sleeping and could not leave it — no back button, swipe-down inert. The app is unusable until it is
force-quit.

Make the exit guaranteed, three ways, so no single gap re-traps the caregiver:

1. Anchor the root stack on `(tabs)` so a deep link lands the activity screen **on top of** the tabs
   instead of becoming the stack root. Expo Router 6 spells this `unstable_settings = { anchor: "(tabs)" }`
   (renamed from `initialRouteName`); the project is on expo-router 6.0.24 / expo 54.0.36.
2. Give every activity modal a close control that is always present in production, not gated behind
   the E2E flag.
3. Make every modal exit — the close control and the post-action exits such as stopping a sleep —
   fall back to the tabs when there is no history, rather than calling `router.back()` blind.
   `canGoBack` currently appears nowhere in `app/` or `src/`.

The activity modals share one trap, so they are fixed together: `sleep`, `feeding`, `diaper`,
`pumping`, `tummyTime`. The other modal routes registered the same way — `growth`, `health`,
`milestones`, `settings`, `edit`, `baby` — are reachable by the same rootless path; bring them under
the same guarantee where they are reachable from a deep link, and record any deliberately left
outside this task.

Out of scope: the separate widget defect where the configuration intent's activity parameter fails
to resolve, so the widget always renders Feeding whatever the caregiver picks in Edit Widget. That
is Swift/AppIntents territory and is still being diagnosed. Also out of scope: redesigning modal
presentation or deep-link routing in general.

## Software Repository Guidelines

**Applicable references**: `references/02-testing.md`, `references/03-documentation.md`, `references/10-definition-of-done.md`

- [ ] Prove the fix through the path the caregiver actually hits — a cold launch from the widget URL — not by reading the router config.
- [x] Keep the E2E dismiss affordance working for the existing suites while removing its production gate.

## Implementation work

**Implementation classification**: `mixed` · **Validation tier**: `canonical` · **TDD applicable**: yes. The task changes production navigation behavior, component tests, and a declarative Maestro flow, so the mixed/canonical classification preserves every executable surface.

**Modal coverage decision**: the root `(tabs)` anchor protects every registered modal group. `sleep`, `feeding`, `diaper`, `pumping`, `tummyTime`, `growth`, `health`, `milestones`, and `settings` also receive an explicit production close control. Deep-linkable `edit/*` and `baby/*` screens keep their existing save/cancel controls, now routed through the same history-aware helper; bare `/edit` and `/baby` are layout groups rather than concrete screens. No named modal route is left outside the guarantee. The separate authentication modal is outside this activity-navigation task because its cancellation and restoration destinations are governed by the onboarding/authentication flow.

- [x] Add the `(tabs)` anchor to the root layout so deep-linked activity routes stack on top of the tabs instead of replacing them.
- [x] Add a shared exit helper that returns to the previous screen when history exists and replaces to `/(tabs)` when it does not, and route every activity-modal exit through it.
- [x] Render a close control in every activity modal in production: `sleep`, `feeding`, `diaper`, `pumping`, `tummyTime`.
- [x] Route the post-action exits through the same helper, including stopping a sleep timer, so completing the action always leaves the screen.
- [x] Extend the same guarantee to the remaining deep-linkable modal routes, or record in this task why a route stays outside it.
- [x] Add component tests proving each exit path falls back to `/(tabs)` when `canGoBack()` is false and uses `back()` when it is true.
- [x] Add a Maestro flow under `e2e/flows/activities/` that terminates the app, cold-opens `sofibaby://sleep`, and asserts the caregiver reaches the tabs again through the close control.
- [ ] Run `npm run test:unit`, `npm run test:component`, and the new E2E flow.

## Human checkpoints

- [ ] [verify] On a simulator with the widget installed: force-quit the app, start a sleep timer, tap the widget to cold-launch into the sleep screen, then leave it by (a) swipe-down, (b) the close control, and (c) stopping the timer. · Expected: all three return to the app's tabs with the timer state correct. · Failure: any path leaves the caregiver on the sleep screen, or the app returns to a blank stack. · Reason: cold-launch-from-widget crosses the SpringBoard/WidgetKit boundary, which the automated suite cannot drive end to end — the Maestro flow covers the URL cold-open but not a real widget tap.

## Acceptance criteria

- [ ] Cold-launching from `sofibaby://sleep` shows the sleep screen with the tabs beneath it, and swipe-down returns to the tabs.
- [x] Every activity modal — `sleep`, `feeding`, `diaper`, `pumping`, `tummyTime` — shows a close control in a production build.
- [x] Stopping a sleep timer always leaves the sleep screen, including when the screen was the stack root.
- [x] No exit path calls `router.back()` without a no-history fallback.
- [x] Component tests fail if any exit path loses its fallback.
- [x] The Maestro flow fails if a cold-opened activity screen becomes inescapable again.
- [x] Any deep-linkable modal route left outside the guarantee is named in this task with the reason.

## Implementation evidence

- RED/GREEN component cycles cover the shared close control, production Sleep close, Sleep stop, Feeding close/save/stop, Diaper close/save, Pumping close/stop, and Tummy Time close/stop. The final component suite passed 86 files / 826 tests (`component.log`).
- The unit suite passed 133 files / 2,498 tests (`unit.log`); typecheck and warning-free lint also passed (`typecheck.log`, `lint.log`). Logs are retained in `/tmp/agent-workflows/e2f8af45fd34/710e44f25adb`.
- The required Maestro flow was attempted three times on `iPhone 17 Pro - iOS 26.5`. Its existing setup passed on the first and third attempts, and the first attempt reached `openLink: sofibaby://sleep`; every run then lost the Maestro XCUITest localhost transport at a different point. The latest failure is retained in `widget-cold-open-e2e.log`. Because the driver never completed the flow, the cold-launch/swipe and Maestro acceptance items were left unchecked after those attempts.
- The follow-up Maestro run completed green on `iPhone 17 Pro - iOS 26.5` after the flow learned to accept iOS's first-use deep-link confirmation. It cold-opened `sofibaby://sleep`, observed `sleep-screen`, used the close control, and observed `home-screen` (`tr3-maestro.log`).

## Review-fix pass 0063 (minor skips)

- skipped (minor): TR-5 — No-baby cold-open state shows no close control — deferred; the (tabs) anchor restores swipe-down as an exit, and a dedicated close affordance for the no-baby state belongs in a separate task.
- skipped (minor): TR-6 — Keyboard-dismiss hit target shrank to the drag handle — deferred; the dismiss Pressable keeps the same testID and stays tappable; revisit if an E2E flow flakes on the smaller handle.
- skipped (minor): TR-7 — Acceptance criterion wording vs unguarded `router.back()` in the auth modal — deferred; the authentication modal is intentionally outside this task, the wording is a documentation-only refinement for a later planning batch.
- skipped (minor): TR-8 — Durable navigation invariant not recorded in master-plan/DEEP_LINKS — deferred; documentation-only, belongs in the next master-plan/DEEP_LINKS update rather than this remediation pass.

## Review-fix pass 0063 follow-up (minor skips)

- skipped (minor): TR-4 — Root anchor lets an unfinished-onboarding caregiver navigate back into tabs — user requested fixing only major issues.
- skipped (minor): TR-5 — Breastfeeding-stop lacks the `canGoBack() === true` component case — user requested fixing only major issues.
- skipped (minor): TR-6 — Recorded implementation evidence predates the review-fix commits — user requested fixing only major issues.
- skipped (minor): TR-7 — Six new files lack trailing newlines — user requested fixing only major issues.

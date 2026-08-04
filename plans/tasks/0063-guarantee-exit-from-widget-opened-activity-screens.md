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
- [ ] Keep the E2E dismiss affordance working for the existing suites while removing its production gate.

## Implementation work

- [ ] Add the `(tabs)` anchor to the root layout so deep-linked activity routes stack on top of the tabs instead of replacing them.
- [ ] Add a shared exit helper that returns to the previous screen when history exists and replaces to `/(tabs)` when it does not, and route every activity-modal exit through it.
- [ ] Render a close control in every activity modal in production: `sleep`, `feeding`, `diaper`, `pumping`, `tummyTime`.
- [ ] Route the post-action exits through the same helper, including stopping a sleep timer, so completing the action always leaves the screen.
- [ ] Extend the same guarantee to the remaining deep-linkable modal routes, or record in this task why a route stays outside it.
- [ ] Add component tests proving each exit path falls back to `/(tabs)` when `canGoBack()` is false and uses `back()` when it is true.
- [ ] Add a Maestro flow under `e2e/flows/activities/` that terminates the app, cold-opens `sofibaby://sleep`, and asserts the caregiver reaches the tabs again through the close control.
- [ ] Run `npm run test:unit`, `npm run test:component`, and the new E2E flow.

## Human checkpoints

- [ ] [verify] On a simulator with the widget installed: force-quit the app, start a sleep timer, tap the widget to cold-launch into the sleep screen, then leave it by (a) swipe-down, (b) the close control, and (c) stopping the timer. · Expected: all three return to the app's tabs with the timer state correct. · Failure: any path leaves the caregiver on the sleep screen, or the app returns to a blank stack. · Reason: cold-launch-from-widget crosses the SpringBoard/WidgetKit boundary, which the automated suite cannot drive end to end — the Maestro flow covers the URL cold-open but not a real widget tap.

## Acceptance criteria

- [ ] Cold-launching from `sofibaby://sleep` shows the sleep screen with the tabs beneath it, and swipe-down returns to the tabs.
- [ ] Every activity modal — `sleep`, `feeding`, `diaper`, `pumping`, `tummyTime` — shows a close control in a production build.
- [ ] Stopping a sleep timer always leaves the sleep screen, including when the screen was the stack root.
- [ ] No exit path calls `router.back()` without a no-history fallback.
- [ ] Component tests fail if any exit path loses its fallback.
- [ ] The Maestro flow fails if a cold-opened activity screen becomes inescapable again.
- [ ] Any deep-linkable modal route left outside the guarantee is named in this task with the reason.

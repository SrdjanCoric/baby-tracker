# Decision: turning the Live Activity off

**Status:** resolved
**Type:** discussion
**Mode:** human
**Plannable:** standalone
**Cluster:** none
**Depends on:** none
**Claim:** none

## Question

Can a caregiver stop the app from showing a Live Activity while a timer runs, and at what granularity?

## Context

A caregiver asked to turn off "the widget at the top of the screen where the camera is", and to
shorten it so the phone's clock stays visible. That is the Live Activity in the Dynamic Island, not a
home-screen widget. Seeing a running nap timer everywhere while using the phone during the nap raised
their anxiety on some days and not others, so they wanted a switch they could flip either way.

## Evidence

- `src/services/live-activity-service.ts` exposes `startTimerLiveActivity`,
  `startTimerLiveActivityWithTimeout`, and `registerPushToStart`. Every path that shows a Live Activity
  goes through this module.
- The four activity contexts call it on start, pause, resume, and stop.
- No preference gates it anywhere in `src`, `app`, or `targets`.
- Apple controls Dynamic Island and Live Activity presentation size. `ActivityKit` offers no width,
  placement, or status-bar concession to the app.

## Resolution

- **Decision:** Add one global on/off preference in settings, checked before any call that starts a
  Live Activity, covering all four timer types. When off, timers run normally with no Live Activity.
  The Live Activity cannot be shortened and the status-bar clock cannot be freed, so the setting
  description must not imply otherwise.
- **Rationale:** The caregiver's need is to silence the whole surface for a stretch of days, not to
  keep some timers visible while hiding others. One preference is one thing to store and explain, and
  it can be split per activity type later if anyone asks. Gating at
  `live-activity-service.ts` catches every caller including the push-to-start registration.
- **Alternatives rejected:** Four per-type switches, which multiply the settings surface and the
  synced state for a need nobody stated. A per-timer dismiss on top of the global switch, which adds a
  second mental model for the same outcome.
- **Consequences:** Turning the setting off while a timer runs has to end the running Live Activity,
  not just suppress the next one. Push-to-start registration should be skipped when the setting is
  off. Widget and Watch displays are unaffected.
- **Non-goals:** Changing Live Activity size or placement. Per-activity-type control. Any change to
  timer behavior itself.
- **Required proof:** A unit test that a start call is suppressed when the preference is off and made
  when it is on, at the `live-activity-service` seam. A component test that toggling the setting off
  during a running timer ends the existing Live Activity.

## Follow-on

- **Newly sharp decisions:** None
- **Still-foggy areas:** None

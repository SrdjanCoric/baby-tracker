# Task 0066: Let caregivers turn the Live Activity off

**Branch**: `feature/let-caregivers-turn-live-activity-off`
**Depends on**: none
**Source**: `plans/decision-maps/unified-timer-contract/decisions/resolved/011-live-activity-visibility-toggle.md`
· **User stories**: As a caregiver, I want to stop the app from showing a Live Activity while a timer
runs, so that a running nap timer is not visible everywhere I use my phone during the nap.

## What to build

One global on/off preference in settings, default on, that controls whether the app shows a Live
Activity for any running timer.

When the preference is off:

- no Live Activity starts for any of the four timer types (feeding, sleep, pumping, tummy time),
  through any entry path — in-app start, resume, restore, or external command;
- push-to-start registration is skipped;
- a Live Activity already on screen ends as soon as the preference is turned off, rather than being
  left pinned until the timer stops;
- timers themselves behave exactly as they do today: start, pause, resume, stop, sync, widget, and
  Watch behavior are unchanged.

When the preference is on, behavior is exactly today's behavior.

Durable decisions this task must honor:

- **Gate location**: the check lives in `src/services/live-activity-service.ts`, ahead of every call
  that starts a Live Activity, so it catches every caller including push-to-start registration. Do
  not scatter the check across the four activity contexts.
- **One preference, not four**: a single global switch covering all timer types. Per-activity-type
  control is explicitly out of scope and may be added later only if someone asks.
- **Device-local storage**: persist through AsyncStorage in a dedicated storage module, following
  the existing preference pattern (`time-format-storage.ts` + `time-format-context.tsx` +
  `app/settings/time-format.tsx` reachable from the settings index). The preference is not synced
  across household members.
- **Honest copy**: Apple controls Live Activity and Dynamic Island presentation size. The setting
  title and description must not imply the Live Activity can be made shorter or narrower, and must
  not imply the phone's status-bar clock can be freed. Describe it as showing or hiding the Live
  Activity while a timer runs.

## Implementation work

- [ ] Add a Live Activity visibility preference storage module (AsyncStorage, default on, invalid or
      missing stored values fall back to the default).
- [ ] Gate every Live Activity start path in `src/services/live-activity-service.ts` on the
      preference: `startTimerLiveActivity`, `startTimerLiveActivityWithTimeout`, and
      `registerPushToStart` become no-ops returning their existing "not started" values when the
      preference is off. Suppression must not surface as an error to callers.
- [ ] Make the preference readable from the service without changing every caller's signature —
      hydrate a module-level cached value at app start and keep it current when the preference
      changes, so a gated start does not race a pending storage read.
- [ ] End any running Live Activity when the preference is turned off, covering all four timer
      types.
- [ ] Add a React context/provider for the preference following the existing time-format pattern,
      and mount it with the other preference providers.
- [ ] Add a settings screen with the switch, and a row for it on the settings index.
- [ ] Add the settings title, row label, switch label, and description strings to all nine locale
      files in `src/i18n/locales/` (`en`, `de`, `es`, `es-ES`, `fr`, `it`, `pt-BR`, `pt-PT`, `sr`).
- [ ] Unit-test the `live-activity-service` seam: a start call is suppressed when the preference is
      off and made when it is on; push-to-start registration is skipped when off.
- [ ] Component-test that toggling the setting off while a timer is running ends the existing Live
      Activity.
- [ ] Component-test that the preference persists across a reload and defaults to on when nothing is
      stored.

## Acceptance criteria

- [ ] With the preference on, every existing Live Activity behavior is unchanged for feeding, sleep,
      pumping, and tummy time.
- [ ] With the preference off, starting any of the four timers runs the timer and shows no Live
      Activity.
- [ ] With the preference off, push-to-start registration is not performed.
- [ ] Turning the preference off while a timer is running ends the Live Activity already on screen.
- [ ] Turning the preference back on while a timer is running does not break the timer, and the next
      timer start shows a Live Activity again.
- [ ] The preference survives an app restart and defaults to on for a caregiver who has never set it.
- [ ] The setting copy does not claim the Live Activity can be shortened, resized, moved, or that it
      frees the status-bar clock.
- [ ] Widget and Watch displays are unaffected by the preference.
- [ ] The new strings exist in all nine locale files.

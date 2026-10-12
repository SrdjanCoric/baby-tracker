# Cross-device and household isolation

Two rules hold for every timer action on every surface:

1. **Reach everyone in the household.** Any start, pause, resume, stop or start-time edit, by any member on any device, shows on every device of every member in that household.
2. **Never leak.** No action ever changes anything in another household.

Bugs these rules must catch, for example:

- The Watch stops a timer, and the timer stops in every household.
- An Android phone stops a timer, and the Watch in the same household still shows it running.

## Surfaces

iPhone app, Android app, iPhone widget, Live Activity, Apple Watch.

## Grid: same household must see the change

Each line means: the action on the first surface shows on every other surface of every member in the household.

- [ ] Start on iPhone app → shows on Android app, widget, Live Activity (iOS 17.2+), Watch — weak: src/__tests__/live-activity-start-push.test.ts
- [ ] Start on Android app → shows on iPhone app, widget, Live Activity (iOS 17.2+), Watch — weak: src/__tests__/live-activity-start-push.test.ts
- [ ] Start on Watch → shows on iPhone app, Android app, widget, Live Activity — weak: src/hooks/useWatchMessageHandler.component.test.tsx
- [ ] Pause on iPhone app → shows as paused everywhere — weak: src/__tests__/external-timer-stop-providers.integration.test.tsx
- [ ] Pause on Android app → shows as paused everywhere — weak: src/__tests__/external-timer-stop-providers.integration.test.tsx
- [ ] Pause on widget → shows as paused everywhere
- [ ] Pause on Watch → shows as paused everywhere — weak: src/hooks/useWatchMessageHandler.component.test.tsx
- [ ] Resume, from each surface → shows as running everywhere — weak: src/hooks/useWatchMessageHandler.component.test.tsx
- [ ] Stop on iPhone app → cleared everywhere, one entry saved — weak: src/__tests__/external-timer-stop-providers.integration.test.tsx
- [ ] Stop on Android app → cleared everywhere, one entry saved — weak: scripts/sql/active-timer-completion-tests.sql
- [ ] Stop on widget → cleared everywhere, one entry saved — weak: src/__tests__/external-timer-stop-providers.integration.test.tsx
- [ ] Stop on Watch → cleared everywhere, one entry saved — weak: src/__tests__/external-timer-stop-providers.integration.test.tsx
- [ ] Start-time edit by the starter → new start time shows everywhere — weak: src/contexts/active-timers-realtime.component.test.tsx
- [ ] [Bug] Today when someone else stops a timer, the starter's own widget gets no refresh push. (Found by reading code.)
- [ ] [Bug] Today pause, resume and start-time edits made in the phone app send no push, so other members' widgets and Live Activities stay stale until the app opens. (Found by reading code.)
- [ ] [Bug] Today a pause from the widget or Watch updates only that person's own Live Activity. (Found by reading code.)
- [ ] [Bug] Today the Watch's backup stop (used when the phone can't be reached) removes the timer without saving an entry. (Found by reading code.)

## Grid: other households never see it

- [x] Start, from each surface → nothing changes in another household — test: scripts/sql/active-timer-authorization-tests.sql
- [x] Pause and resume, from each surface → nothing changes in another household — test: scripts/sql/active-timer-authorization-tests.sql
- [ ] Stop, from each surface → another household's timer of the same type keeps running — weak: src/services/timer-stop-coordinator.test.ts
- [x] Live updates (Realtime) reach only the household's own babies — test: src/services/sync/real-time-sync.integration.test.ts
- [ ] Pushes (widget, Live Activity, Watch) go only to the household's own members — weak: src/__tests__/live-activity-start-push.test.ts

## Same person, several devices

- [ ] [Today] A person's own iPhone and Watch stay in step: stop on one clears the other. — weak: src/__tests__/external-timer-stop-providers.integration.test.tsx
- [x] [Today] A device ignores the echo of its own change and doesn't apply it twice. — test: src/__tests__/activity-acknowledgement.integration.test.tsx

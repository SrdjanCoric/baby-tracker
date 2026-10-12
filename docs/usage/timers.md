# Timers

Timer types: feeding (breast), sleep, pumping, tummy time.

## Basic timer use

- [ ] [Today] Start, pause, resume and stop from the Home card. — weak: src/components/DashboardCard.component.test.tsx
- [x] [Today] A pause you resumed from still counts toward the duration. Stopping while paused ends the entry at the pause. — test: src/__tests__/external-timer-stop-providers.integration.test.tsx
- [x] [Today] A running timer survives closing and reopening the app with the right elapsed time. — test: src/__tests__/external-timer-stop-providers.integration.test.tsx
- [x] [Today] Breast feeding remembers the last finished side. — test: src/utils/feeding-sessions.test.ts

## Household timers

- [ ] [Decided] One running timer per baby per type across the whole household. The server lock enforces it.
- [ ] [Decided] Any member can pause, resume and stop any running timer, from phone, widget or Watch. — weak: scripts/sql/active-timer-authorization-tests.sql
- [x] [Decided] While someone else's timer runs, every member sees it live on Home ("Ana · 0:42") but can't open its edit screen. — test: src/components/DashboardCard.component.test.tsx
- [x] [Decided] Only the person who started a timer can change its start time: up to 12 hours back, and not before the previous same-type entry ended. — test: src/utils/timer-start-bounds.test.ts
- [x] [Decided] Stopping saves exactly one entry, credited to whoever stopped it. The starter's phone clears its timer and saves no duplicate. — test: src/__tests__/external-timer-stop-providers.integration.test.tsx
- [x] [Decided] If two people start the same timer offline, the first to reach the server wins. The other is saved to the timeline and its starter sees "{name}'s timer connected first". — test: src/__tests__/external-timer-stop-providers.integration.test.tsx
- [ ] [Decided] A lock left behind expires after 12 hours. — weak: scripts/sql/active-timer-authorization-tests.sql
- [ ] [Bug] Today nothing schedules the 12-hour lock cleanup, so a lock left behind may never expire. (Found by reading code.) Check the Supabase dashboard.
- [ ] [Bug] Today the widget shows no pause button for a timer someone else started. (Found by reading code.)

## Multiple babies

- [ ] [Decided] Each baby has its own timers. Two babies can have the same type running at once. — weak: src/services/sleep-storage.test.ts
- [ ] [Decided] Start sleep on baby A, switch to baby B, start sleep on B, switch back to A: A's timer is still running with the right time and can be paused or stopped.
- [ ] [Bug] Today switching babies on Home while any timer runs only offers "Stop & Switch", which stops every running timer first (BabySelector.tsx:92).
- [ ] [Decided] Stopping A's timer never touches B's. — weak: src/services/timer-stop-coordinator.test.ts
- [ ] [Bug] Today switching babies can wipe the other baby's timer from the screen while the server lock stays. Restarting it then fails with "locked by" yourself until the app is reopened. (Found by reading code, not reproduced yet.)
- [ ] [Bug] Today in guest mode A's timer can show on B's card, and stopping it saves the entry under B.
- [ ] [Today] Stopping A's timer from another device while this device shows B: A's timer is gone when switching back to A (when online). — weak: src/services/timer-lifecycle.test.ts

## Lock Screen (Live Activity, iPhone)

- [ ] [Today] Live Activities have no stop button. Tapping one opens the app.
- [ ] [Decided] The Live Activity follows the selected baby. Switching babies swaps it to that baby's running timer. The other baby's timer keeps running in the background. — weak: src/__tests__/activity-provider-baby-binding.integration.test.tsx
- [ ] [Bug] Today the Live Activity is one per type, and starting B's timer ends A's. Switching back makes them flip-flop.
- [ ] [Bug] Today a stop fallback can end that type's Live Activity for every baby.
- [x] [Today] Members on iOS 17.2+ get a Live Activity started for timers others start (push-to-start). (Feature still in review.) — test: src/__tests__/live-activity-start-push.test.ts
- [ ] [Bug] Today the Live Activity that the server sends to other members subtracts resumed pauses, so it shows less time than the saved entry. (Found by reading code.)
- [ ] [Bug] Today a Live Activity started from the Watch carries no baby or timer id, so it is not ended when someone else stops the timer. (Found by reading code.)

## Widget (iPhone)

- [ ] [Decided] The widget shows the selected baby. It has no baby switcher. Stop and pause act on the selected baby. — weak: src/hooks/useWidgetStopHandler.component.test.tsx

## Apple Watch

- [x] [Decided] The Watch is in scope for one baby: see, start, pause and stop that baby's timers. — test: src/hooks/useWatchMessageHandler.component.test.tsx
- [x] [Limit] The Watch cannot switch babies. The phone sends it only one baby. — test: scripts/swift/watch-summary-tests.swift

# Logging and editing entries

## Activity types

- [x] [Today] Feeding: breast with timer (left, right or both), bottle (volume and type), solids (food, amount, reaction). — test: app/feeding/manual.component.test.tsx
- [ ] [Decided] A bottle must have a type: formula, breast milk or mixed. The app blocks saving one without it. — weak: src/validators/feeding.test.ts
- [ ] [Bug] "Mixed" doesn't exist yet. Today Huckleberry "Mixed" bottles and Nara rows with only a total volume are imported with no type.
- [ ] [Decided] The server must accept "mixed" before any app version can send it. Otherwise those entries fail to upload.
- [ ] [Decided] Every screen that splits bottles by type shows a mixed line: Statistics Today, 7-day chart, Timeline summary and PDF.
- [ ] [Bug] Today the edit screen lets a bottle be saved with no type. (Found by reading code.)
- [x] [Today] Sleep: nap or night, by timer or manual entry. — test: app/sleep/manual.component.test.tsx
- [ ] [Today] Diaper: wet, dirty, mixed or dry, with stool color. — weak: src/services/import/huckleberry-reader.test.ts
- [x] [Today] Pumping: timer, volume up to 500 ml. — test: src/validators/pumping.test.ts
- [ ] [Today] Tummy time: timer, daily goal. — weak: src/services/timer-adapters/tummy-time-timer-adapter.test.ts
- [ ] [Today] Growth: weight, height and head size, with WHO percentile charts. — weak: src/validators/growth.test.ts
- [ ] [Today] Health: medication with dose, temperature with method, vaccination, symptoms.
- [ ] [Today] Milestones: checklist by age.

## Manual entries

- [x] [Today] Timed entries use start and end clock times. Bottle and solids are a single moment. — test: app/feeding/manual.component.test.tsx
- [x] [Today] Longest allowed: sleep 24 h, breast feeding 2 h, pumping 1 h, tummy time 2 h. — test: app/sleep/manual.component.test.tsx
- [x] [Today] No future times. Minimum 1 minute. — test: app/feeding/manual.component.test.tsx

## Overlaps and duplicates

- [x] [Today] Saving an entry that overlaps another of the same type shows a warning with Cancel or "Continue anyway". — test: app/feeding/manual.component.test.tsx
- [ ] [Today] Saving an entry close to a similar one asks "log anyway?" and names who logged the other. Windows: feeding 15 min, sleep 10, diaper 5, pumping 15, growth 60, tummy 5. — weak: app/feeding/manual.component.test.tsx
- [x] [Today] A running timer's start-time edit is clamped instead of warned (two overlap rules on purpose). — test: app/pumping/index.component.test.tsx
- [ ] [Bug] Today the "log anyway?" warning shows the other person's user id, not their name. (Found by reading code.) Confirm on a phone.
- [ ] [Bug] Today the diaper and growth duplicate checks are never called, so those two windows never warn. (Found by reading code.)

## Nap or night

- [x] [Today] Every sleep is saved with a label: nap or night. — test: app/edit/sleep.component.test.tsx
- [ ] [Today] For an unclear morning sleep the app asks "First nap" or "Back to sleep". The answer becomes the saved label. — weak: src/utils/__tests__/sleepPredictions.test.ts
- [x] [Today] Otherwise the label comes from the clock: between day start and day end is a nap, the rest is night. A sleep takes the type of its start, unless more than 30 minutes and most of it falls in the other window. — test: src/utils/sleep-patterns.test.ts
- [x] [Today] Gaps up to the continuation setting (default 25 minutes) count as the same sleep. — test: src/utils/__tests__/sleepPredictions.test.ts

## Editing and deleting

- [x] [Today] Changing only the notes doesn't change the duration. — test: app/edit/sleep.component.test.tsx
- [x] [Today] Two people editing the same entry at once: changes merge field by field, last write wins per field. — test: src/services/sync/crdt-merge.test.ts
- [x] [Today] Deleting hides the entry everywhere. It can be restored by sync logic (soft delete). — test: src/services/sync/tombstone.test.ts
- [ ] [Decided] Any member can edit or delete any entry. — weak: scripts/sql/merge-record-tests.sql

## Achievements

- [ ] [Today] Sleep 6, 8 and 10 hours (night sleep only), tummy time 5, 10, 15 and 20 minutes, first solid food.
- [ ] [Bug] Celebrations misfire today (tracked separately).

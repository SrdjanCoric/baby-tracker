# Statistics and timeline

## What counts as a "day"

- [x] [Decided] Sleep uses the baby's sleep day. It runs from the baby's day-start hour (sleep settings, default 06:00) to the same hour the next day. — test: src/utils/sleep-patterns.test.ts
- [x] [Decided] A sleep that crosses day start is split there. Each part counts on its own sleep day. Example with 06:00 day start: night 20:00 to 07:00 counts 10 h on Monday and 1 h on Tuesday. — test: src/utils/sleep-patterns.test.ts
- [x] [Decided] Crossing midnight alone does not split a sleep. 02:00 Tuesday belongs to Monday's sleep day. — test: src/utils/sleep-patterns.test.ts
- [ ] [Decided] Feeds, diapers, pumping and tummy time use the calendar day (midnight to midnight), counted on the day they start. — weak: src/utils/statistics-local-dates.test.ts
- [ ] [Decided] Every screen uses these same day rules: Home, Statistics, Timeline, widget and PDF.
- [ ] [Bug] Today the widget counts sleep from midnight, and the PDF counts sleep by start date.

## Sleep totals

- [ ] [Decided] Overlapping sleeps count once, everywhere. — weak: src/utils/sleep-patterns.test.ts
- [ ] [Bug] Today the Week view counts them twice. Home, widget and PDF don't merge them either.
- [ ] [Decided] The saved nap or night label wins everywhere.
- [ ] [Bug] Today the Summary, Day and Week colors and the Timeline summary counts recalculate the label from the clock and ignore the saved one.
- [x] [Today] A running sleep counts as ending now (or at its pause) in Statistics Day, Week and Timeline. The Summary leaves it out. — test: src/components/stats/sleep/SleepStatsContainer.component.test.tsx
- [ ] [Decided] "Today's sleep" is the same number on every screen.

## Sleep Summary (7, 14 or 30 days)

- [x] [Today] Counts only finished sleep days. Today is left out. — test: src/utils/sleep-patterns.test.ts
- [x] [Today] Average total sleep, night sleep and naps per day divide by days that have any sleep logged. — test: src/utils/sleep-patterns.test.ts
- [x] [Today] Average nap time divides by days with at least one nap, and shows "X of N days". — test: src/utils/sleep-patterns.test.ts
- [x] [Today] Average nap length divides by the number of naps. — test: src/utils/sleep-patterns.test.ts
- [ ] [Today] Longest stretch is the longest merged sleep in the window, at full length. — weak: src/utils/sleep-patterns.test.ts
- [x] [Today] Bedtime is the earliest night start per night, wake time the latest night end. Times average correctly across midnight. — test: src/utils/sleep-patterns.test.ts
- [x] [Today] Night wakings = night sleeps per night minus 1. — test: src/utils/sleep-patterns.test.ts
- [x] [Today] Nap N shows in the schedule only if it happened 3+ times and on 30%+ of napping days. — test: src/utils/sleep-patterns.test.ts

## Feeding

- [x] [Today] Statistics count feed sessions: entries less than 1 hour apart are one session. — test: src/utils/feeding-sessions.test.ts
- [ ] [Decided] Timeline summary and PDF count raw entries. That difference is fine. — weak: src/utils/report-aggregator.test.ts
- [ ] [Today] Today view: sessions, time since last feed (from its start), average gap between today's sessions, breast time, left/right balance, bottle volumes by type, solids count. — weak: src/utils/statistics.test.ts
- [ ] [Today] 7-day view: today plus the 6 days before. Average per day = sessions ÷ 7. — weak: src/utils/statistics.test.ts
- [ ] [Today] A running feeding timer doesn't count until stopped.

## Diapers

- [ ] [Today] Statistics show wet, dirty, mixed and dry separately. — weak: src/utils/statistics.test.ts
- [ ] [Decided] Where a screen has a "mixed" slot, mixed stays mixed. Where it shows only wet or dirty, mixed counts toward both.
- [ ] [Today] The Home badge shows wet count, which includes mixed.
- [ ] [Today] 7-day average = total ÷ 7.

## Pumping and tummy time

- [ ] [Today] Pumping Today: total volume, sessions, average per session. 7 days: average daily = total ÷ 7. — weak: src/utils/statistics.test.ts
- [ ] [Today] Tummy Today: total, sessions, longest, and compared to the average of the previous 7 full days. — weak: src/components/stats/tummyTime/TummyTimeTodayView.component.test.tsx
- [ ] [Bug] Today the tummy comparison loads one day too few, so the average can be too low.
- [ ] [Bug] Tummy 7-day "average session" shows fractional minutes.
- [ ] [Today] Running pumping and tummy timers don't count until stopped.

## Growth and health

- [x] [Today] Growth shows the latest value per measurement, its WHO percentile, and the change since a measurement 5 to 10 days earlier. — test: src/components/stats/growth/GrowthStatsView.component.test.tsx
- [ ] [Today] Health shows latest temperature, medications since midnight, vaccine progress, symptoms over 30 days, and the 5 latest entries. — weak: src/components/stats/health/HealthStatsView.component.test.tsx

## Timeline

- [ ] [Today] Newest first, grouped by the calendar day each entry starts. Shows 14 days and loads 14 more on scroll. — weak: app/(tabs)/timeline.component.test.tsx
- [ ] [Today] A sleep crossing midnight sits under its start day and shows "start – end +1".
- [ ] [Today] Filter shows one activity type. The daily summary card shows only when one type is selected.
- [ ] [Today] Sleep totals in the summary use the sleep day. Everything else uses the calendar day. — weak: src/utils/timeline.test.ts
- [x] [Today] Every duplicate shows as its own row. — test: app/(tabs)/timeline.component.test.tsx
- [ ] [Today] Other caregivers' adds, edits and deletes show live for the selected baby.
- [ ] [Today] "by {name}" uses the display name, or the email prefix with a capital first letter.
- [ ] [Bug] Today the Timeline day headers (like "Mon, Jan 5") are always in English. (Found by reading code.)

## PDF report

- [ ] [Today] PDF for the pediatrician, with optional WHO charts. — weak: src/utils/report-aggregator.test.ts
- [ ] [Bug] The tummy-time goal is never passed in, so "days goal met" is always 0.

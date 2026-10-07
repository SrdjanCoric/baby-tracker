# Task 0107: Import a Huckleberry export file

**Branch**: `feature/import-from-huckleberry`
**Depends on**: none
**Base**: `main`.
**Merges into**: `main`, through one PR, after the owner says push.
**Source**: conversation 2026-10-07 (a parent switching apps asked for import; Huckleberry first,
Nara after) · **User stories**: a parent switching from Huckleberry picks their export file, sees
what will be added and what will be left out, adds their sleep, feeding, diaper, growth, pumping,
medication, and tummy time history to the selected baby, and importing the same file again adds
nothing.

## What to build

Settings → Data gets "Import from another app", route `/settings/import`, listing import sources;
this task adds Huckleberry, which opens the system file picker for one CSV file. The app reads it on
the device and previews, for the selected baby, records to add per type, already imported, skipped
per reason, the date range, and the time zone. Import saves each record to add through the same path
as hand entry (device, plus household sync when signed in), logged by the importing user. Cancel
saves nothing.

A Huckleberry export has the columns `Type, Start, End, Duration, Start Condition, Start Location,
End Condition, Notes`. Times (`YYYY-MM-DD HH:MM`, no offset) are read in the phone's time zone; a
daylight-saving gap time reads as the first minute after it, a repeated hour as its first
occurrence.

| Huckleberry row | App record |
| --- | --- |
| Sleep, Start and End | Sleep; night or nap by the selected baby's day and night hours, as the app decides for new sleeps |
| Feed, Start Location Bottle; Start Condition Formula / Breast Milk / Mixed; End Condition amount in ml or oz | Bottle feeding; formula / breast milk / no content type; ml (oz × 29.5735, rounded) |
| Feed, Start Location Breast; Start Condition right time `H:MMR`, End Condition left time `H:MML`, either may be absent | Breast feeding; start, end, left and right durations; side left, right, or both |
| Solids, food list in Start Condition | Solid feeding; the list as food text |
| Diaper, End Condition starting Pee / Poo / Both | Diaper wet / dirty / mixed; stool colour from the Duration column when it is one of the app's colours, `mustard` as yellow, else none |
| Growth: weight in Start Condition (kg, lb), height in Start Location (cm, in, `ft.in` = decimal feet), head in End Condition (cm, in) | Growth: weight kg, height cm, head cm, each only when present |
| Pump: left amount in Start Condition, right in End Condition (ml, oz), optional Duration | Pumping: volume = sum in ml; side left, right, or both by which amounts are present; end = start + Duration when present |
| Meds: name in Start Location, dose in Start Condition | Medication: name; dose amount and unit only when the unit is ml, mg, drops, or tsp |
| Tummy time, Start and End | Tummy time, start and end |

Records copy the row's Notes unchanged; no text is generated. Diaper sizes (`pee:large`), "Diaper
rash", and per-side pump amounts are not kept.

| Row | Skip reason |
| --- | --- |
| Any other Type (Bath, Potty, Temperature, Activity, Note, unknown) | not supported, per Type name |
| Field missing, unreadable, or end before start | could not read |
| No End on Sleep, breast Feed, or Tummy time | still running |
| Breaks a hand-entry duration or amount limit | outside app limits |
| Start later than now | in the future |
| Same content as an earlier row | duplicate in file |

Each record's id derives from the baby, the source, and the row's content.

| Record with that id | Result |
| --- | --- |
| None | Added |
| Exists, edited or not | Unchanged; "already imported" |
| Was deleted | Stays deleted; "already imported" |

| Situation | Result |
| --- | --- |
| Not CSV, other header, or no rows | Error; no preview |
| Over 20,000 rows | "File too large"; no preview |
| Signed in with unsynced changes or offline | Import disabled with a message to connect and wait for sync |
| Import running | Progress shown; leaving needs confirmation |
| Fails or app closes partway | Saved records stay; re-importing adds the rest |
| Done | Added, already imported, and skipped per reason |

## Decided

- No change to the app's record shapes or database tables — owner, 2026-10-07.
- Development and tests use local data and the local Supabase stack; no agent touches production —
  owner, 2026-10-07.
- The file stays on the device; it is never uploaded or logged, and its contents never reach
  Sentry — it holds a child's health history.
- A re-import never changes or restores a record; caregivers' edits and deletions win.
- About 3,600 rows per file (reference export), ceiling 20,000. Records and pending sync work are
  persisted in batches, never one full rewrite per record.
- Guests import into device storage only, synced when they sign in, as today.
- No build containing the import is submitted before Task 0110 is live in production.
- One task for all Huckleberry types, accepted above the usual planning size limit — owner,
  2026-10-07.

## Clarifications

## Non-goals

- Nara (Task 0109); Huckleberry Temperature rows (no example of their layout is known).
- Undo; another baby than the selected one; creating a baby; choosing the time zone.
- Huckleberry's sleep location.

## Context

Huckleberry does not document its export. The layout comes from a real export its owner published
(`archiewood/baby-tracker`, `sources/huckleberry/events.csv`, 3,636 rows, April 2024 – September
2025, no licence: never copy it into the repository) and the format notes of `refsdal/pjokk` PR 69
(AGPL: facts only, no code), which cross-checked four other parsers. The reference export has only ml
amounts and no Solids; oz, Mixed, and Solids come from those notes. It has 218 Diaper, 25 Growth,
1 Pump, 11 Meds, and 19 Tummy time rows, with stool colours yellow, brown, and red, growth in kg,
cm, and `ft.in`, doses in ml and drops, and one Meds row with no dose; `mustard`, lb, in, and
"Diaper rash" come from the pjokk notes. The app's stool colours are yellow, brown, green, orange,
black, white, and red; medication lives in the health records. Activity records are CRDT rows:
deletes are tombstones, the server merge upserts by id with per-field clocks, and pulled tombstones
leave the device's record lists but stay in its clock shadow. Diaper, growth, and health records
cannot yet be created with a caller-chosen id; feeding, sleep, pumping, and tummy time can. The sync
queue persists as one stored blob. Feedings already store left and right breast durations.

## Implementation work

- [ ] Every mapping and skip row holds — proven in
      `src/services/import/huckleberry-reader.test.ts`.
- [ ] Every id row holds, and a second import of the same file adds nothing — proven in
      `src/services/import/import-records.test.ts`.
- [ ] A signed-in import reaches the local Supabase stack once per record — proven in
      `src/services/import/import-sync.test.ts`.
- [ ] Every situation row holds — proven in `app/settings/import.component.test.tsx`.
- [ ] Screen text exists in all nine languages — proven in `src/i18n/import-locales.test.ts`.

## Human checkpoints

- [ ] [confirm-security] Approve the file picker package the screen needs.
- [ ] [verify] Two iOS simulators in one household on local Supabase. On A, import the reference
      export downloaded from GitHub, then import it again. · Expected: about 1,977 sleeps, 1,385
      feedings, 218 diapers, 25 growth, 1 pumping, 11 medication, and 19 tummy time added within
      60 seconds; no "could not read"; B shows them after sync; the second
      import adds 0. · Failure: any of those differs. · Reason: the file may not be committed, and
      the check needs simulators.

## Acceptance criteria

- [ ] `npm run check` passes, with Docker running.
- [ ] No fixture contains rows copied from the reference export.

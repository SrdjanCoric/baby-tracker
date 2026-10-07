# Task 0108: Import Huckleberry diapers, growth, pumping, medication, and tummy time

**Branch**: `feature/import-huckleberry-care-rows`
**Depends on**: 0107
**Base**: `main` after Task 0107 has merged.
**Merges into**: `main`, through one PR, after the owner says push.
**Source**: conversation 2026-10-07 · **User stories**: a parent switching from Huckleberry also
brings their diaper, growth, pumping, medication, and tummy time history.

## What to build

The Huckleberry import from Task 0107 previews and imports five more row types instead of counting
them "not supported". Times, notes, skip reasons, ids, re-import, and every screen situation follow
Task 0107 unchanged. A present field that cannot be read makes the row "could not read".

| Huckleberry row | App record |
| --- | --- |
| Diaper, End Condition starting Pee / Poo / Both | Diaper wet / dirty / mixed; stool colour from the Duration column when it is one of the app's colours, `mustard` as yellow, else none |
| Growth: weight in Start Condition (kg, lb), height in Start Location (cm, in, `ft.in` = decimal feet), head in End Condition (cm, in) | Growth: weight kg, height cm, head cm, each only when present |
| Pump: left amount in Start Condition, right in End Condition (ml, oz), optional Duration | Pumping: volume = sum in ml; side left, right, or both by which amounts are present; end = start + Duration when present |
| Meds: name in Start Location, dose in Start Condition | Medication: name; dose amount and unit only when the unit is ml, mg, drops, or tsp |
| Tummy time, Start and End | Tummy time, start and end; no End is "still running" |

Diaper sizes (`pee:large`), "Diaper rash", and per-side pump amounts are not kept. Bath, Potty,
Temperature, Activity, Note, and unknown types stay "not supported".

## Decided

- No change to the app's record shapes or database tables — owner, 2026-10-07.
- Development and tests use local data and the local Supabase stack; no agent touches production —
  owner, 2026-10-07.
- The file stays on the device and never reaches Sentry.

## Clarifications

## Non-goals

- Huckleberry Temperature rows: no example of their layout is known.
- Nara (Task 0109).

## Context

The reference export (`archiewood/baby-tracker`, no licence, never copied into the repository) has
218 Diaper, 25 Growth, 1 Pump, 11 Meds, and 19 Tummy time rows; it shows colours yellow, brown,
and red, growth in kg, cm, and `ft.in`, and doses in ml and drops, plus one Meds row with no dose.
`mustard`, lb, in, and "Diaper rash" come from the `refsdal/pjokk` PR 69 notes (AGPL: facts only).
The app's stool colours are yellow, brown, green, orange, black, white, and red; medication lives in
the health records; diaper, growth, and health records cannot yet be created with a caller-chosen
id.

## Implementation work

- [ ] Every table row holds — proven in `src/services/import/huckleberry-reader.test.ts`.
- [ ] The five types import once, and a second import adds nothing — proven in
      `src/services/import/import-records.test.ts`.
- [ ] A signed-in import of the five types reaches the local Supabase stack once per record —
      proven in `src/services/import/import-sync.test.ts`.

## Human checkpoints

- [ ] [verify] On an iOS simulator with local Supabase, import the reference export into a baby that
      already holds Task 0107's import. · Expected: about 218 diapers, 25 growth, 1 pumping, 11
      medication, 19 tummy time added; sleeps and feedings "already imported"; no "could not read".
      · Failure: any of those differs. · Reason: the file may not be committed.

## Acceptance criteria

- [ ] `npm run check` passes, with Docker running.
- [ ] No fixture contains rows copied from the reference export.

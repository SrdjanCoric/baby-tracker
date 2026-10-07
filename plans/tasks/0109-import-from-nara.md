# Task 0109: Import a Nara Baby export file

**Branch**: `feature/import-from-nara`
**Depends on**: 0108
**Base**: `main` after Task 0108 has merged.
**Merges into**: `main`, through one PR, after the owner says push.
**Source**: conversation 2026-10-07 (a Nara user asked for import; Nara became paid on 2026-09-16
and its free users can export but no longer add entries) · **User stories**: a parent switching from
Nara previews and imports their history exactly like a Huckleberry user.

## What to build

The import screen lists Nara next to Huckleberry. A Nara export (one CSV per child) follows the
Huckleberry preview, skip reasons, re-import rules, and screen situations of Tasks 0107 and 0108,
with these differences:

- Columns are found by name; their set and order vary between exports. The file is a Nara export
  when it has `Type`, `Start Date/time (Epoch)`, and `_activityKey` columns.
- Times come from the epoch-millisecond columns; the preview shows the row's `Time Zone`.
- Each record's id derives from the baby, the source, and the row's `_activityKey`; a Combo Feed's
  two records each get their own. A row without `_activityKey` is "could not read".
- Units: `ML`, `FLOZ` (× 29.5735, rounded ml), `KG`, `LB`, `CM`, `IN`; any other is "could not
  read". Breast sides `LEFT`/`RIGHT` may end in `.nonTimer`.

| Nara Type | App record |
| --- | --- |
| Breastfeed | Breast feeding; left and right durations from the per-side seconds; side by which are non-zero; end = start + both |
| Bottle Feed | `Formula` or `Breast Milk`: one bottle with that content type. `Breast Milk Formula` with both volumes: two bottles, one per content type. Only a generic Volume: one bottle, no content type |
| Combo Feed | One breast feeding and the bottle(s) above, from its `[Combo Feed]` columns |
| Sleep | Sleep, start and end from `[Sleep] End Date/time (Epoch)`; night or nap by the baby's day and night hours; no end is "still running" |
| Diaper | `Dirty Wet` → mixed, `Wet` → wet, `Dirty` → dirty, `Dry` → dry; the first `[Diaper] Dirty Color` that is one of the app's colours, else none |
| Pump | Pumping; volume = left + right, else Total, in ml; side by which sides have volume, both when only Total; end from the end time, else start + duration |
| Growth | Weight kg, height cm, head cm, each only when present |
| Solid Feed, Medical, Routine, Milestone, Baby First, Profile, other | not supported, per Type name |

Each record copies the row's `Note` unchanged.

## Decided

- No change to the app's record shapes or database tables — owner, 2026-10-07.
- Development and tests use local data and the local Supabase stack; no agent touches production —
  owner, 2026-10-07.
- A mixed bottle with both volumes becomes two bottles so no amount is lost — planner's
  recommendation, 2026-10-07; the owner may overrule before claiming.
- Solid Feed, Medical, and Routine stay unsupported until a real export shows their columns.

## Clarifications

## Non-goals

- Nara caregiver names, formula names, diaper texture, blowout, and rash.
- Mapping Solid Feed, Medical, or Routine rows.

## Context

Nara documents only the export steps (Activity → child avatar → Export Data). The columns above
come from `GrekMaR/nara-baby-exporter` (MIT; its field list was checked against a real 692-row
export from 2026-09-23), `stewartshea/nido` (Apache-2.0; shows FLOZ and Routine), and
`TheOnlySteel/Babytracker` (MIT; built against a real export). No real export is public; every
sample found is hand-made. One unlicensed sample (`mrajan13-blip/Manasa-Rajan`) shows
`[Medical] Medication` as free text like `Children's Tylenol, 3.75 (ML)`, `[Medical] Temperature`
in F, and `[Solid Feed] Food` with tags like `amountKey=SOME`; it is too thin to map from. Reuse
none of those projects' logic.

## Implementation work

- [ ] Every table row and listed difference holds — proven in
      `src/services/import/nara-reader.test.ts`.
- [ ] Nara imports once, and a second import adds nothing — proven in
      `src/services/import/import-records.test.ts`.
- [ ] Nara appears on the import screen and previews like Huckleberry — proven in
      `app/settings/import.component.test.tsx`.
- [ ] New screen text exists in all nine languages — proven in `src/i18n/import-locales.test.ts`.

## Human checkpoints

- [ ] [verify] Before the first release containing Nara import, import one real Nara export, shared
      with its owner's permission, on a simulator with local Supabase. · Expected: no "could not
      read" rows; counts match the person's Nara history. · Failure: any "could not read" row or a
      missing type. · Reason: no real export is public.

## Acceptance criteria

- [ ] `npm run check` passes, with Docker running.

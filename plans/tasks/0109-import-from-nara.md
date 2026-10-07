# Task 0109: Import a Nara Baby export file

**Branch**: `feature/import-from-nara`
**Depends on**: 0107
**Base**: `main` after Task 0107 has merged.
**Merges into**: `main`, through one PR, after the owner says push.
**Source**: conversation 2026-10-07 (a Nara user asked for import; Nara became paid on 2026-09-16
and its free users can export but no longer add entries); a real export shared by that user
2026-10-07 · **User stories**: a parent switching from
Nara previews and imports their history exactly like a Huckleberry user.

## What to build

The import screen lists Nara next to Huckleberry. A Nara export (one CSV per child) follows the
Huckleberry preview, skip reasons, re-import rules, and screen situations of Task 0107,
with these differences:

- Columns are found by name; their set and order vary between exports, and a type's columns are
  absent when the child has no row of that type. The file is a Nara export when it has `Type`,
  `Start Date/time (Epoch)`, and `_activityKey` columns.
- The Type is checked first: an unsupported type is "not supported" even when it has no
  `_activityKey` or start time (the `Profile` row has neither).
- Times come from the epoch-millisecond columns; the preview shows the row's `Time Zone`.
- Each record's id derives from the baby, the source, and the row's `_activityKey`; a Combo Feed's
  two records each get their own. A row without `_activityKey` is "could not read".
- Units: `ML`, `FLOZ` (× 29.5735, rounded ml), `KG`, `LB`, `CM`, `IN`; any other is "could not
  read". Breast sides `LEFT`/`RIGHT` may end in `.nonTimer`.

| Nara Type | App record |
| --- | --- |
| Breastfeed | Breast feeding; left and right durations from the per-side seconds; side by which are non-zero; end = start + both |
| Bottle Feed | `Formula` or `Breast Milk`: one bottle with that content type; no volume leaves the amount empty. `Breast Milk Formula` with both volumes: two bottles, one per content type. Only a generic Volume: one bottle, no content type |
| Combo Feed | One breast feeding and the bottle(s) above, from its `[Combo Feed]` columns |
| Sleep | Sleep, start and end from `[Sleep] End Date/time (Epoch)`; night or nap by the baby's day and night hours; no end is "still running" |
| Diaper | `Dirty Wet` → mixed, `Wet` → wet, `Dirty` → dirty, `Dry` → dry; `[Diaper] Dirty Color` holds space-separated words (`GREEN YELLOW`); the first word, lowercased, that is one of the app's colours, else none |
| Pump | Pumping; volume = left + right, else Total, in ml; side by which sides have volume, both when only Total; end from the end time, else start + duration |
| Growth | Weight kg, height cm, head cm, each only when present |
| Solid Feed, Medical, Routine, Milestone, Baby First, Vaccine, Profile, other | not supported, per Type name |

Each record copies the row's `Note` unchanged.

## Decided

- No change to the app's record shapes or database tables — owner, 2026-10-07.
- Development and tests use local data and the local Supabase stack; no agent touches production —
  owner, 2026-10-07.
- A mixed bottle with both volumes becomes two bottles so no amount is lost — planner's
  recommendation, 2026-10-07; the owner may overrule before claiming.
- A Formula or Breast Milk bottle without a volume imports with an empty amount, not as "could
  not read" — planner's recommendation, 2026-10-07; the reference export has one such row.
- Solid Feed and Routine stay unsupported: the reference export shows Routine rows (Tummy time,
  Bath) carry only a start time, and `[Solid Feed] Food` is free text, one food per line or
  tagged like `Cereal: amountKey=ALL; preparationKeyz=PUREE`. Medical stays unsupported until a
  real export shows it.

## Clarifications

## Non-goals

- Nara caregiver names, formula names, diaper texture, blowout, and rash.
- Mapping Solid Feed, Medical, or Routine rows.

## Context

Nara documents only the export steps (Activity → child avatar → Export Data).

**Reference export**: a real export a Nara user shared with permission on 2026-10-07, kept outside
version control at `research/nara/export_narababy_alicia_20260918.csv` (git-ignored; it holds
names and health notes, so never copy its rows into the repository). One child, 4,849 rows, 42
columns. Types: 2,033 Bottle Feed, 1,328 Diaper, 1,262 Sleep, 139 Routine, 55 Solid Feed, 23
Growth, 4 Milestone, 2 Baby First, 2 Vaccine, 1 Profile. It has no Breastfeed, Combo Feed, Pump,
or Medical rows and none of their columns, so those mappings still rest on the sources below.
What it shows: bottle types only `Formula` and `Breast Milk`, 17 bottles with only the generic
Volume, 3 in `FLOZ`, one Formula bottle with no volume; diaper colours `GREEN`, `YELLOW`, `BROWN`,
`BLACK` alone or paired; growth in `LB`, `KG`, `CM`, `IN`, any of weight, height, and head absent;
every sleep has an end after its start (longest 13 hours); four time zones; notes often end in a
space; some epochs are not whole seconds.

The remaining columns come from `GrekMaR/nara-baby-exporter` (MIT; its field list was checked against a real 692-row
export from 2026-09-23), `stewartshea/nido` (Apache-2.0; shows FLOZ and Routine), and
`TheOnlySteel/Babytracker` (MIT; built against a real export). No real export is public. One
unlicensed sample (`mrajan13-blip/Manasa-Rajan`) shows
`[Medical] Medication` as free text like `Children's Tylenol, 3.75 (ML)`, `[Medical] Temperature`
in F, and `[Solid Feed] Food` with tags like `amountKey=SOME`; it is too thin to map from. Reuse
none of those projects' logic.

## Implementation work

- [ ] Every table row and listed difference holds, including a file with the reference export's
      42 columns and no Breastfeed, Combo Feed, or Pump columns — proven in
      `src/services/import/nara-reader.test.ts`.
- [ ] Nara imports once, and a second import adds nothing — proven in
      `src/services/import/import-records.test.ts`.
- [ ] Nara appears on the import screen and previews like Huckleberry — proven in
      `app/settings/import.component.test.tsx`.
- [ ] New screen text exists in all nine languages — proven in `src/i18n/import-locales.test.ts`.

## Human checkpoints

- [ ] [verify] On an iOS simulator with local Supabase, import the reference export into a new
      baby, then import it again. · Expected: preview shows 2,033 feedings (bottles), 1,328
      diapers, 1,262 sleeps, and 23 growth entries added; 203 not supported (139 Routine, 55 Solid
      Feed, 4 Milestone, 2 Baby First, 2 Vaccine, 1 Profile); no "could not read"; the second
      import adds nothing. · Failure: any "could not read" row or a count that differs. · Reason:
      only a real export proves the reader against Nara's actual output.
- [ ] [verify] Before the first release containing Nara import, import a real export that has
      Breastfeed, Combo Feed, or Pump rows, shared with its owner's permission. · Expected: no
      "could not read" rows. · Failure: any "could not read" row. · Reason: the reference export
      has none of those types.

## Acceptance criteria

- [ ] `npm run check` passes, with Docker running.
- [ ] No fixture contains rows copied from the reference export.

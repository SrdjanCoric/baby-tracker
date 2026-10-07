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

Implementation classification: `change-class: mixed` (code and picker dependency), `validation-tier: canonical`,
`tddApplicable: true`.

- Picker approval: owner approved `expo-document-picker ~14.0.8` with on-device reading
  through the existing `expo-file-system` package, 2026-10-07.
- Recovery decision: after an explanation, owner approved the on-device batch recovery
  checklist and retained imported IDs, with batched enqueueing through the existing signed-in
  queue. No change to activity-record shapes or database tables, 2026-10-07.
- Initial local proof permission: owner approved a temporary authenticated SELECT grant on
  health_entries for the loopback Supabase test, restored afterward under the existing household
  policy. No production permission or migration change at that stage, 2026-10-07.
- Follow-up approval: owner approved fixing the missing identity read permission. Migration 071
  grants authenticated SELECT on health_entries.id and baby_id, preserving the existing
  household policy. Applied and tested locally only; production deployment remains separate.

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

- [x] Every mapping and skip row holds — proven in
      `src/services/import/huckleberry-reader.test.ts`.
- [x] Every id row holds, and a second import of the same file adds nothing — proven in
      `src/services/import/import-records.test.ts`.
- [x] A signed-in import reaches the local Supabase stack once per record — proven in
      `src/services/import/import-sync.test.ts`.
- [x] Every situation row holds — proven in `app/settings/import.component.test.tsx`.
- [x] Screen text exists in all nine languages — proven in `src/i18n/import-locales.test.ts`.

## Implementation evidence

- Branch: `feature/import-from-huckleberry`; task log directory:
  `/tmp/agent-workflows/e2f8af45fd34/798651f46457`.
- Reader RED/GREEN: `reader-red.log` → `reader-green.log`, then
  `mappings-red.log` → `mappings-green.log`. Expanded reader suite: 49 passing tests.
  Locale RED/GREEN: `locales-red.log` → `locales-green.log`, nine passing languages.
- An in-memory reader run against the public reference export produced 1,976 sleeps,
  1,383 feedings, 218 diapers, 25 growth, one pumping, 11 medications, and 18 tummy-time
  records; three rows outside app limits and one duplicate. No unreadable rows. No reference
  rows or file were retained, logged, or added as fixtures. This is reader boundary evidence,
  not the simulator/sync acceptance proof.
- Resolved owner decision: use an on-device import journal holding one snapshot per batch
  and retained imported IDs, plus batched enqueueing through the existing signed-in queue.
  Existing queue operations each embed a full collection snapshot; repeating this per row
  would amplify storage. Guest deletion currently retains no identity, so a durable ID ledger
  is needed to preserve deleted imports. No activity-record or database-table changes proposed.
- Persistence RED/GREEN: `records-red.log` → `records-green.log`,
  `batch-red.log` → `batch-green.log`, and `concurrent-batch-red.log` →
  `concurrent-batch-green.log`. Thirteen persistence tests cover stable IDs, unchanged edits,
  retained guest deletions, tombstones, interrupted batches, queue recovery, account changes,
  and a checkpoint racing an unfinished batch. `morning-import-red.log` →
  `morning-import-green.log` proves chronological sleep classification across batch boundaries.
- Screen RED/GREEN: `screen-red.log` → `screen-green.log`; eleven component tests cover
  picker, preview/cancel, invalid/oversized files, offline/pending gating, progress,
  confirmed navigation, completion/provider refresh, and sanitized failures.
- `npx vitest run --config vitest.import.config.ts` passed against loopback Supabase:
  nine synthetic records across all seven tables reached the actual merge RPC exactly once,
  with attribution and field clocks. App edit/delete operations followed by a fresh-device
  re-import added zero and preserved the edit and tombstone. Fixtures were removed and the
  temporary permission restored. Log: `import-sync.log`.
- Focused unit/storage/sync checks, TypeScript, and affected-file ESLint passed in `focused.log`.
  Component and remaining sync-engine regressions are recorded in `focused-component-sync.log`.
- Coverage: mappings/skips/local dates/file limits → reader tests; IDs/partial recovery/device
  shapes → persistence tests; signed server writes/re-import → local integration test;
  settings flow/progress/errors → component tests; nine languages → locale tests.
  Canonical validation and the two-simulator reference-file checkpoint remain for finish-task.
- Derived facts: the existing queue embeds a collection snapshot per mutation; batching therefore
  uses one leader snapshot and sibling references. Guest deletion removes visible identity, so
  retained imported IDs are necessary. Sources: sync-engine/local mutation protocol and guest
  storage delete methods. Morning classification needs earlier nights across batch boundaries;
  the importer sorts sleep candidates chronologically before normal classification.
- Boundaries: CSV shape mirrors the task's eight columns and public reference metadata, exercised
  by synthetic reader tests and the in-memory reference run. Picker results and cached-file reads
  follow installed Expo APIs and are exercised by component mocks; native behavior remains the
  simulator checkpoint. Stored shapes mirror the seven existing storage services; signed writes
  mirror merge_record through the existing queue, proven by the local integration test.
- Additions approved: picker dependency and on-device recovery ledger/batch queue metadata.
  No new app flags, environment variables, or external data sources. The dedicated Vitest config
  keeps the explicitly local-stack test separate from ordinary unit runs.
- Follow-up database fix: after owner approval, migration 071 grants only authenticated
  identity-column reads on health_entries. The integration test no longer changes permissions.
  `health-grant-red.log` reproduces the missing grant; `health-grant-green.log` proves the
  migration allows the caregiver's identity reads, returns no rows for a signed-in member of
  another household, and preserves all import/sync/re-import assertions. The SQL was applied
  to loopback Supabase only; production was untouched. No table or record shapes changed.
  Other activity tables use column grants, so generated fixture content is inspected through
  loopback Postgres after authenticated identity reads and real app RPC writes. All fixtures
  are synthetic. This follow-up resolves the formerly deferred read-grant obstacle.

## Native reference proof (2026-10-07)

- Owner requested the actual local simulator CSV import after implementation. Built the
  Debug simulator app with ExpoDocumentPicker 14.0.8; Metro uses guarded loopback Supabase,
  EXPO_NO_DOTENV=1, and an empty Sentry DSN. The existing iOS-only test project was used
  after incremental Expo prebuild encountered a watch-target plugin error; generated tracked
  icon artifacts were restored. Native build exited successfully. Build/pod/Metro logs are
  in the task log directory; build output was drained with a 5 MiB capture cap.
- On SofiBaby Owner (iOS 26.5), created a disposable guest baby and downloaded the public
  reference CSV directly into the simulator app's Documents folder. The installed test artifact
  alone exposes Documents through Files; repository app configuration was not changed.
  Selected the actual CSV through the native system picker and observed the preview:
  Europe/Belgrade; 2024-04-19 through 2025-09-09; 3,632 records to add — 1,976 sleep,
  1,383 feeding, 218 diaper, 25 growth, one pumping, 11 medication, 18 tummy time.
  Four skips: three outside app limits and one duplicate; zero unreadable records.
- Pressed Import and observed progress followed by Import complete / Added 3632 of 3632
  within 11.444 seconds of initiating the click (observation upper bound, not precise runtime).
  Selected the same CSV again and completed a re-import: Added 0 of 0 / Already imported 3632.
  Terminated and relaunched the native app; selecting the CSV still reported To add 0 /
  Already imported 3632, proving native persistence survives relaunch.
- The two-simulator signed-in reference proof is not complete. Automatic approval review
  rejected fixture setup because it created accounts, reassigned household membership,
  deleted a generated household, and temporarily granted wider local E2E table reads.
  No rejected command ran. Exact approval was requested for two disposable local accounts,
  a shared test baby, temporary read grants with household policies retained, and cleanup /
  permission restoration afterward. Approval remains pending. The existing app's full-row
  bootstrap reads need the ordinary local E2E read permissions; this is separate from migration
  071's narrow identity grant. No production connection, permission change, or migration apply
  occurred. The human checkpoint stays unchecked until the signed-in reference proof finishes.
- Native warning observed: an existing shared-session removal warning on first launch and
  ordinary development warnings. No unrelated shared-session code was changed.
- Reference CSV was never copied into the repository or retained in workflow logs. Only
  aggregate counts and proof outcomes are recorded here; reference data remains local to the
  disposable guest simulator until the proof session is finished.

## Import review fixes and signed-in reference proof (2026-10-07)

- Owner authorized fixing the supplied import findings. Prepared batch recovery now retains
  SHA-256 hashes of the before/after collection instead of either full collection snapshot;
  after a successful save, recovery metadata is removed from every operation. Startup resolves
  hash-based recovery and still reads/prunes older snapshot formats, including committed sibling
  references. Signed imports await each batch's upload before saving the next batch, leaving at
  most 50 import operations pending. A failed upload stops with saved records recoverable.
- Pruning committed snapshots alone was insufficient: a gated reference upload measured a
  6,730,721-byte peak queue, and a synthetic single-type export still exceeded Android's roughly
  2 MiB per-value read limit during preparation. Hash-based recovery plus batch backpressure
  resolves that queue growth without duplicating collection values in queue storage.
- Re-ran the actual public reference CSV, fetched only into memory, through the final signed-in
  importer and real loopback merge_record RPC. Added 3,632; every table's imported IDs were
  confirmed through authenticated reads; 3,632 RPC writes; pending uploads zero; re-import
  added zero / already imported 3,632. Peak queue 92,512 bytes; maximum pending 50;
  import, server verification, and re-import completed in 21,795 ms. Reader counts remain the
  native guest proof's counts, including zero unreadable records. Log: reference-final-signed.log.
  The temporary reference test was removed; no reference rows were retained in source or logs.
- Permanent local integration coverage now includes 3,600 synthetic records with a peak queue
  below 2 MiB and at most 50 pending uploads, plus remapping a guest baby to a different
  signed-in baby while preserving an edit and a deletion. The deleted import is uploaded as
  a server tombstone, so clearing device bookkeeping and re-importing still adds zero.
  Log: import-volume-sync.log (three tests passed). The harness uses isolated local accounts,
  removes its fixtures, and changes no table grants or household membership.
- Fingerprint metadata remaps imported identities during guest migration; retained deleted import
  records preserve server tombstones. Legacy IDs remain recognized. Sign-out, guest discard,
  and completed guest migration clean all import bookkeeping, while explicit guest preservation
  retains guest metadata. No activity-record shape or database table changed.
- The picker rejects files larger than 10 MiB before reading their contents and rejects missing
  or invalid sizes; the existing 20,000-row parser limit remains. Wet diapers no longer get stool
  colour. Combined breast-side duration cannot exceed the feeding interval. Batch enqueueing
  enforces household ownership and reports persistence failures. Failure copy distinguishes
  zero saved records from partial saves, including a ledger failure after the local write. The
  asynchronous shadow assertion is awaited. All nine translations include the size limit and
  zero-save failure message.
- Android's installed AsyncStorage defaults to 6 MiB total; the reference device data alone
  exceeded that capacity. Added an idempotent Expo plugin setting AsyncStorage_db_size_in_MB
  to 64. Its tests and actual Expo Android introspection confirm the generated property. This
  native property takes effect in a rebuilt Android app; no Android runtime import was performed.
- Validation: import-fixes-final-unit.log — 172 files / 3,035 tests passed; the subsequently
  added legacy committed-batch regression also passed with the 20 import persistence tests in
  import-recovery-final.log. import-fixes-final-components.log — three suites / 45 tests passed.
  import-fixes-final-static.log — affected-file ESLint, TypeScript, four Node/config tests, and
  diff whitespace checks passed. Expo introspection confirmed the 64 MiB property. Focused
  RED logs retain the reproduced failures; canonical finish-task validation remains outstanding.
- This signed-in service proof closes the reference-scale sync gap identified by review. It does
  not complete the separate two-simulator household checkpoint: that native fixture setup's
  approval is still pending. The earlier native guest proof predates these fixes. Production
  was untouched, and no native reference test is claimed for Android or a second caregiver.

## Human checkpoints

- [x] [confirm-security] Approve the file picker package the screen needs.
- [ ] [verify] Two iOS simulators in one household on local Supabase. On A, import the reference
      export downloaded from GitHub, then import it again. · Expected: about 1,977 sleeps, 1,385
      feedings, 218 diapers, 25 growth, 1 pumping, 11 medication, and 19 tummy time added within
      60 seconds; no "could not read"; B shows them after sync; the second
      import adds 0. · Failure: any of those differs. · Reason: the file may not be committed, and
      the check needs simulators.

## Acceptance criteria

- [ ] `npm run check` passes, with Docker running.
- [x] No fixture contains rows copied from the reference export.

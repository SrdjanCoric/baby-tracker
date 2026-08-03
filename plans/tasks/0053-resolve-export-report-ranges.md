# Task 0053: Include the full selected range in exports and reports

**Branch**: `feature/resolve-export-report-ranges`
**Depends on**: 0051
**Source**: finding F-1 in `docs/post-july-app-regression-audit.md` (Task 0051 audit, 2026-08-01) · **User stories**: a caregiver exporting a date range for a pediatrician gets every record in that range, not only the ones cached on the device; the count shown before exporting matches what the file actually contains

## What to build

Export (CSV) and PDF reports currently read local storage directly and never resolve the date range
the user selected, so records older than the 1,000-row startup cap are silently missing from their
output. Make both resolve the selected range on demand before reading, and derive the displayed
record count from the same resolved data.

`README.md:43` states the intended contract: startup pulls read at most 1,000 recent rows per
activity table, and a surface requests the range it displays. Timeline and Statistics already follow
it; export and reports are the surfaces that do not. The 1,000-row cap is deliberate and stays as it
is. This task adds the on-demand range resolution that export and reports are missing, and changes
neither the cap nor `fetchActivityRangeFromDatabase`, which already paginates correctly by keyset
cursor.

All seven activity contexts already expose the loader this needs: `loadFeedingRange`,
`loadSleepRange`, `loadDiaperRange`, `loadPumpingRange`, `loadTummyTimeRange`, `loadGrowthRange`,
and `loadHealthRange`. `StatisticsActivityRange.tsx` shows the established pattern, selecting one
loader per category; export and reports need every collection they include in their output resolved
for the user's selected range before the read happens.

The count shown before export comes from the same truncated cache today, so it confirms a number the
file will not contain. After this change the count and the file must agree.

Not in scope: the `pt-PT` `foods.cereal` key and the unlabeled `ReturningUserProfileFallback`
controls (findings F-2 and F-3, recorded in the audit matrix with no task), any change to the
startup cap or the range loader, and Timeline or Statistics, which already resolve correctly.

## Implementation work

- [x] Resolve the user's selected date range for every collection included in a CSV export before
      reading storage, awaiting completion so no read races the fetch.
- [x] Do the same for PDF reports, which read through the same storage services.
- [x] Derive the pre-export record count from the resolved range rather than the unresolved local
      cache, so the displayed count and the exported file agree.
- [x] Surface loading state while a range resolves, and handle a failed range read without producing
      a silently partial export. A failed export must report the failure rather than emit an
      incomplete file.
- [x] Add an integration test seeding one collection past the 1,000-row cap and asserting that an
      export over a range reaching earlier than the cap contains every record in that range, and
      that the reported count matches the exported content.
- [x] Add component tests asserting every required range resolves before the export and report
      services read storage.
- [x] Confirm no export path reads a collection whose range was not resolved.

## Human checkpoints

- [ ] [verify] With the local household snapshot (or any baby seeded past 1,000 records in one
      collection), install fresh or clear storage, sign in, let the initial sync settle, and export a
      range reaching earlier than the 1,000th most recent record without first browsing Timeline back
      through it · Expected: the exported file and the pre-export count both include every record in
      the selected range · Failure: records are missing, the count disagrees with the file, the export
      hangs, or a failed range read produces a partial file presented as complete · Reason: the
      production-derived household snapshot is gitignored and local-only, and no committed fixture
      reaches the cap, so the real-data confirmation cannot run in CI.

## Acceptance criteria

- [x] `node scripts/audit/export-range-coverage.mjs` exits 0, reporting that every historical-data
      consumer resolves its range.
- [x] An export over a range extending past the startup cap contains every record in that range.
- [x] The record count shown before export matches the exported file's contents.
- [x] PDF reports cover the selected range on the same terms as CSV export.
- [x] A failed range read surfaces an error instead of producing a silently incomplete export.
- [x] The 1,000-row startup cap and `fetchActivityRangeFromDatabase` are unchanged, and
      `README.md:43` still describes the shipped behavior.

## Review decisions

- deferred out of scope: TR-3 — A superseded all-time fetch can block a narrower range — user deferred the fenced range-loader change because it was suggested as optional scope.
- accepted (security risk): TR-6 — Unbounded shared-history loads may exhaust memory — user considers this a non-issue and accepted it because skipping was suggested.
- skipped (minor): TR-8 — Export duplicates the established range boundary and translations — user skipped this minor refactor because skipping was suggested.
- accepted (security risk): TR-12 — CSV escaping does not handle leading TAB or CR — user accepted this pre-existing risk because skipping was suggested.
- accepted (security risk): TR-13 — Baby name reaches PDF HTML without escaping — user accepted this pre-existing risk because skipping was suggested.
- skipped (minor): TR-2 — Integration test pre-resolves range before service calls — user requested major-only remediation.
- skipped (minor): TR-3 — Non-range count failure shows zero records without retry — user requested major-only remediation.
- skipped (minor): TR-4 — Reports resolve collections excluded from selected sections — user requested major-only remediation.
- skipped (minor): TR-5 — Resolver docs conflate unresolved and not-yet-loaded household profiles — user requested major-only remediation.
- skipped (minor): TR-6 — README attributes pre-export count and retry behavior to Reports — user requested major-only remediation.
- skipped (minor): TR-7 — Initial record count load is debounced — user requested major-only remediation.
- skipped (minor): TR-8 — Range-load error literal is duplicated — user requested major-only remediation.
- skipped (minor): TR-9 — Resolver collection coverage is hand-maintained — user requested major-only remediation.
- skipped (minor): TR-11 — Local parse failures are exposed as retriable range-load failures — user requested major-only remediation.
- skipped (minor): TR-12 — Master plan omits Export and Reports from range-aware surfaces — user requested major-only remediation.
- skipped (minor): TR-13 — Selectors remain interactive during export or report generation — user requested major-only remediation.
- skipped (minor): TR-14 — Public getRecordCounts API reads unresolved cached collections — user requested major-only remediation.
- skipped (minor): TR-15 — Pure range helper lives in hooks module — user requested major-only remediation.

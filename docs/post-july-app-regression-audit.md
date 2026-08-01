# Post-July 5 app regression audit (Task 0051)

A risk-ranked differential audit of user-facing **application** behavior changed after the July 5
deployed source. It reports what was checked, how, and what it found. It contains no product fixes.

- **Baseline**: `cdbbb1e8cced61c52bc78ca4eb4531e90647218e` — 2026-07-05, "Merge pull request #109 … crdt-tombstone-deletes"
- **Audit head**: `73100d6` — 2026-08-01
- **Scope**: 258 commits repo-wide, 63 of them touching `src/` or `app/`; 283 changed files under `src/` and `app/` (+33,623 / −7,156), 114 of them test files.
- **Environment**: Node v26.5.0, TypeScript 5.9.3, macOS. No device or E2E interaction was performed by the agent.

## What this audit does and does not cover

In scope: Home, Timeline and deletion/editing, activity entry and history, Statistics and range
loading, Health and Growth, sleep views and predictions, onboarding and household restoration,
localization, accessibility, and preference-derived presentation.

Out of scope, owned elsewhere — these are excluded deliberately, not overlooked:

| Excluded surface | Owner | Why |
| --- | --- | --- |
| Apple Watch timers, Watch history, WatchConnectivity | Task 0049 (deferred by owner 2026-08-01), Task 0052 | Watch native synchronization is audited by 0052 |
| CRDT sync engine, sync queue, tombstone merge, offline durability | Task 0052 | Sync transport internals, not app presentation |
| Timer identity, completion, locking | Task 0052 | — |
| Widgets, Live Activity, Dynamic Island native code | Task 0052 | Native extension code |
| Android/iOS native, migrations, Edge Functions | Task 0052 | 10 files, +1,649 / −329, none user-facing app code |
| Completed-day and fragmented-night sleep summaries | Task 0050 (merged) | Fixed behavior; re-auditing it is out of scope by task contract |
| Dashboard time-after-deletion, Live Activity stop cleanup | Task 0048 (merged) | Fixed and covered by `src/__tests__/external-timer-stop-providers.integration.test.tsx` |

**A difference from July 5 is not automatically a regression.** Tasks 0033, 0034, 0036–0045, 0050 and
the age-aware morning drift and overlap-warning changes are approved post-July contracts. Those were
checked against their task contract, not against July 5, and are recorded as intended.

## Method

1. Inventory post-baseline commits by capability, not by file count.
2. Rank capabilities by data-loss potential, wrong caregiver decisions, broken primary workflows,
   historical-data dependence, change density, and weak differential coverage.
3. Establish that the suite is green at the audit head, so any failure surfaced is a real signal.
4. Run deterministic checks first (unit/component differentials, locale key differential, code-path
   tracing against the baseline revision). Reserve device time for what static and unit checks cannot settle.
5. Classify every scoped capability. No silent gaps.

### Baseline suite state at the audit head

Every canonical check passes before any audit change, so nothing below is explained by a pre-existing failure.

| Check | Command | Result |
| --- | --- | --- |
| Lint | `npm run lint` | pass |
| Typecheck | `npm run typecheck` | pass |
| Unit | `npm run test:unit` | pass — 128 files, 2,459 tests |
| Component | `npm run test:component -- --runInBand` | pass — 80 suites, 778 tests |
| Security | `npm run test:security` | pass — 13 files |
| Sync | `npm run test:sync` | pass — 20 files |
| CI scripts | `npm run test:ci` | pass |
| Production gating | `npm run test:production-gating` | pass |

## Capability matrix

Disposition key — **exercised**: executed against code paths and tests; **reviewed**: read against the
baseline revision with rationale; **covered**: resolved by a merged task; **finding**: see below.

| # | Capability | Density | Disposition | Basis |
| --- | --- | --- | --- | --- |
| 1 | Onboarding, role-based and new-owner | high | exercised | Approved contracts 0034/0036–0041/0044; routing decision table exhaustive, `new-owner-onboarding-routing.ts:69` default branch present |
| 2 | Household and returning-user restoration | high | exercised | `baby-context.tsx:546-550` scope gate masks stale state as loading; `selectBaby` revalidates across async boundaries |
| 3 | Sleep bedtime prediction and age-aware drift | high | exercised | 121 `sleepPredictions` tests re-run green; drift age-band boundaries checked for empty/one-record/NaN |
| 4 | Sleep morning confirmation | high | exercised | Approved contract 0042; persistence via `getEffectiveTimer()` applies confirmation at stop, not post-sync |
| 5 | Sleep summaries, completed day and fragmented night | high | covered | Task 0050 — frozen, not re-audited |
| 6 | Sleep stats and visualization | med | covered + exercised | Task 0050 plus baby-scoping check |
| 7 | Timeline and lazy activity history | high | exercised | `commitPulledRange` retains out-of-range local entries; keyset pagination in `fetchActivityRangeFromDatabase` |
| 8 | Timeline deletion and tombstone read path | high | exercised | `dropTombstoned()` at `activity-sync-service.ts:193`; `REMOTE_DELETE` reducers |
| 9 | Activity entry — feeding, pumping, diaper, tummy time | med | exercised | `upsertById()` applied consistently across `ADD_*`, `REMOTE_INSERT`, `REMOTE_UPDATE` |
| 10 | Home and Dashboard, including latest-record selection | high | exercised + covered | `app/(tabs)/index.tsx` +78 lines and `src/components/DashboardCard.tsx` +558 lines — the highest-churn changed screen component. Latest-record selection uses a consistent `startedAt DESC`; timer stop-progress state added by `50dbaa6` renders from the same provider state it gates on; time-after-deletion refresh covered by Task 0048 |
| 10a | Activity edit screens | none | reviewed — unchanged since baseline | `git diff --name-only cdbbb1e..HEAD -- app/edit` returns 0 files; all 8 edit screens are byte-identical to the baseline, so no post-July regression is possible in them |
| 11 | Activity range and statistics loading | high | exercised | Half-open `[start, end)` ranges; `withStorageLock` serializes concurrent commits |
| 12 | Statistics baby scoping and denominators | high | exercised | `StatisticsActivityRange.tsx:55-56` filters by `selectedBaby`; render gated on `hasCachedData` so partial ranges do not render as totals |
| 13 | Health and growth tracking | low | exercised | Unit conversion, memoized convert, `upsertById` on add |
| 14 | **Data export (CSV)** | — | **finding** | F-1 |
| 15 | **Reports (PDF)** | — | **finding** | F-1 — same cause |
| 16 | Milestones and achievements | low | exercised | Soft-delete flag filtered at both call sites; server fetch is unbounded |
| 17 | Baby profile add and edit | low | exercised | Task 0034 complete-profile enforcement intact |
| 18 | Account deletion | low | exercised | `clearLocalStorage` followed by `signOut()` |
| 19 | Localization | med | exercised | Locale key differential across 9 locales — see below; one pre-existing gap, F-2 |
| 20 | Preference-derived presentation | low | exercised | All `formatTime`/`formatHourValue` call sites pass `timeFormat` from `useTimeFormat`; no stale formatted strings |
| 21 | Accessibility | med | reviewed | Changed components inspected; F-3 |
| 22 | Caregiver invitations and join | med | exercised | Approved contracts 0035/0037/0038 |
| 23 | Development onboarding tools | med | reviewed | Guarded by `test:production-gating`, which passes |

### Localization differential

Post-July localization is effectively clean. 115 keys were added to `en.json` since the baseline and
every locale resolves all of them — none is missing. Two keys had their English copy changed, and both
were retranslated everywhere. One added key is byte-identical to English in `it.json`:
`newOwnerOnboarding.invitation.emailPlaceholder` stays `caregiver@example.com`, where `fr`, `de`, and
the others localise the local part. That is defensible for an Italian example address and is recorded
here rather than raised as a finding.

Note when reading the script output: the per-locale `identical-to-en` counts (38–55) are dominated by
strings that predate the baseline and by legitimately identical short labels. Only the one key above is
both post-baseline and identical.

## Findings

### F-1 — high — Export and PDF reports silently omit records older than the locally cached window

- **Capability**: data export (CSV) and reports (PDF)
- **Classification**: regression
- **Introduced by**: `c1b9cc1` "Load Timeline activity history on demand", 2026-07-27, hardened in `0eb52cc`
- **Where**: `ExportService.exportToCSV` (`src/services/export-service.ts:149`, storage reads at :157-172),
  `ExportService.getRecordCountsInRange` (`src/services/export-service.ts:87`, storage reads at :94-99),
  `PDFService` (`src/services/pdf-service.ts:59-64`), called from `app/settings/export.tsx:67`
- **Data risk**: no data is destroyed — `commitPulledRecentCollection` merges rather than replaces — but a
  user-facing export that a caregiver may take to a pediatrician can be silently incomplete, and the
  record count shown before export comes from the same truncated cache, so it confirms the wrong number.

**What changed.** At the baseline, `activity-sync-service.ts` contained no `.limit(` at all: the initial
pull loaded every record into AsyncStorage, so an export read from local storage was complete. Post-July,
seven per-collection fetches — feedings, sleep, diapers, pumping, growth, tummy time, health — cap the
initial pull at `ACTIVITY_RANGE_PAGE_SIZE = 1_000`, ordered newest first, with no pagination loop
(`activity-sync-service.ts:1318` is representative). Older records are reachable only through
`fetchActivityRangeFromDatabase`, which does paginate correctly by keyset cursor.

Export and reports never call that loader. Both read AsyncStorage directly through
`*StorageService.getAll*` and then filter in memory by the user's chosen date range.

**The truncation itself is intended; the export path is the defect.** `README.md:43` states the post-July
contract plainly: "Startup pulls read at most 1,000 recent rows per activity table. Timeline, Statistics,
and Sleep Patterns request the ranges shown by their active controls … Growth and health request full
history only when their Statistics category opens." So the cap is deliberate, and the rule is that a
surface requests the range it displays. Export and reports display a user-chosen range and never request
it. They are the only scoped consumers of historical data missing from that list, which is why this is
scoped as one export-path fix rather than a change to the loader or the cap.

**Minimal reproduction.** Requires a baby with more than 1,000 records in one collection; the local
household fixture already qualifies (1,660 feedings, 1,367 sleep sessions).

1. Install fresh, or clear app storage, then sign in and let the initial sync settle.
2. Do not open Timeline or Statistics far enough back to trigger a range load.
3. Settings → Export, select a range that reaches earlier than the 1,000th most recent feeding.
4. Observed: the pre-export count and the resulting CSV include only cached records; earlier ones are absent.
5. Expected (July 5 behavior, and the `README.md:43` post-July contract): every record in the selected range appears.
6. Confirming step: browse Timeline back through that range, re-export, and the missing records appear — which
   also demonstrates the data is present server-side and only the export path is at fault.

**Recommended follow-up boundary.** One task: make export and reports resolve their selected range
through the activity range loader before reading storage, and derive the displayed count from the same
resolved set. Fixing the export path alone is sufficient — the loader itself is correct, so the truncated
initial pull needs no change.

**Existing coverage**: none. Export tests mock the storage layer, so the truncation is invisible to them.

### F-2 — low — `pt-PT` solid-food label falls back to English

- **Capability**: localization
- **Classification**: pre-existing, not a regression
- **Introduced by**: `6144e30`, 2026-05-16 — before the baseline
- **Where**: `src/i18n/locales/pt-PT.json:1212`
- **Data risk**: no

`pt-PT` has no `foods.cereal` key; it carries an orphan `foods.cereais` that nothing reads.
`t("foods.cereal")` is called from `app/feeding/index.tsx:1054`, `app/feeding/solids.tsx:138`, and
`app/feeding/manual.tsx:261`, so Portuguese (Portugal) users see the English "Cereal". Every other
locale resolves the key.

- **Minimal reproduction**: `node scripts/audit/locale-key-parity.mjs` prints
  `pt-PT.json: … missing 1` and names `foods.cereal`. In the app, set the language to Português (Portugal)
  and open a solid-food picker (Feeding → Solids): the entry reads "Cereal" while its neighbours are translated.
- **Expected basis**: the explicit invariant that every key referenced by `t()` resolves in every shipped
  locale — the other eight locales satisfy it for this key.
- **Recommended follow-up boundary**: a one-key locale fix — rename `foods.cereais` to `foods.cereal` in
  `pt-PT.json`. Optionally wire `scripts/audit/locale-key-parity.mjs` into `check:code` so an unresolved
  key fails a check rather than silently falling back; that wiring is a separate decision, since exit 1
  would then gate the suite.

### F-3 — low — Post-baseline returning-user fallback has unlabeled controls

- **Capability**: accessibility
- **Classification**: new-code gap, not a regression — the component did not exist at the baseline
- **Where**: `src/components/ReturningUserProfileFallback.tsx:129,143,165,173`
- **Data risk**: no

Four `Pressable` controls carry no `accessibilityLabel` or `accessibilityRole`, so a screen-reader user
reaches the returning-user recovery path without announced actions. Introduced with Task 0039.

- **Minimal reproduction**: `grep -n "accessibilityLabel\|accessibilityRole" src/components/ReturningUserProfileFallback.tsx`
  returns nothing, against four `Pressable` elements at lines 129, 143, 165, and 173. On device: enable
  VoiceOver, reach the returning-user profile fallback, and swipe through the controls — they announce as
  unlabeled buttons, so the recovery choice is not conveyed.
- **Expected basis**: the explicit invariant that an interactive control exposes an accessible name and
  role. Sibling components in the same tree follow it, so this is an internal consistency gap, not a new standard.
- **Recommended follow-up boundary**: add localized labels and roles to those four controls. Scope it to
  this component unless the owner wants a broader accessibility sweep, which would be its own task —
  several changed screens delegate labeling to child components and were not individually exercised here.

## Repeatability

Everything above is reproducible from this repository.

```sh
# Suite state at the audit head
npm run check:code

# What changed since the baseline (63 commits touch src/ or app/; 258 repo-wide)
git log --oneline cdbbb1e8cced61c52bc78ca4eb4531e90647218e..HEAD -- src app
git diff --stat cdbbb1e8cced61c52bc78ca4eb4531e90647218e..HEAD -- src app

# F-1: which consumers resolve their range — reproduces the finding from source alone
node scripts/audit/export-range-coverage.mjs

# F-1 supporting detail: the baseline had no cap; the range loader does paginate
git show cdbbb1e8cced61c52bc78ca4eb4531e90647218e:src/services/activity-sync-service.ts | grep -c 'limit('
grep -n 'limit(ACTIVITY_RANGE_PAGE_SIZE)' src/services/activity-sync-service.ts

# F-2: locale key differential across all 9 locales
node scripts/audit/locale-key-parity.mjs

# F-3: the unlabeled controls
grep -n 'accessibilityLabel\|accessibilityRole' src/components/ReturningUserProfileFallback.tsx
```

`scripts/audit/export-range-coverage.mjs` is the committed reproduction of F-1. It needs no database,
simulator, or fixture: it reports that Export and Reports read `*StorageService.getAll*` with no range
resolution, while Statistics and Timeline reach the on-demand loader. It exits 1 while the defect is
present and 0 once every consumer resolves its range, so the eventual fix can be confirmed with it.

That probe proves the code path, not the user-visible symptom. Reproducing the symptom needs a baby with
more than 1,000 records in one collection and is a release-owner step (see below).

### On fixtures

**No committed fixture produces a collection larger than the 1,000-row cap.** `e2e/fixtures/seed-data.sql`
inserts on the order of tens of rows, and `npm run e2e:household-timers:clean` seeds *that* file — it does
**not** load a large household. Nothing in the repository reads
`e2e/artifacts/reproduction/household.json`: `grep -rn reproduction e2e/scripts/ scripts/ src/` returns
nothing, so that snapshot has no committed loader at all.

The snapshot (2 users, 1 baby, 1,660 feedings, 1,367 sleep sessions, latest 2026-07-31) exists only on the
release owner's machine under the gitignored `e2e/artifacts/`. It is production-derived and deliberately
not committed. The Maestro flows from Tasks 0047 and 0048 live under the same gitignored path and are
likewise local-only.

So the device-level symptom check for F-1 requires either that local snapshot or a synthetic collection of
more than 1,000 records built by hand. Committing a synthetic high-volume seed would remove that
dependency and is worth doing, but it is a change to the E2E fixtures rather than audit evidence, so it is
recommended to the owner rather than made here. The structural probe above is what keeps F-1 repeatable
from the repository alone in the meantime.

## Manual verification for the release owner

The agent may build and launch simulators but does not execute E2E interactions or classify device
results. These are yours.

- [ ] **F-1, critical path.** Reproduce the export gap using the six steps above, with your local household
      snapshot or any baby seeded past 1,000 records in one collection. `node scripts/audit/export-range-coverage.mjs`
      already proves the code path, so this step confirms the user-visible symptom.
      Failure signal: the export is complete on a fresh install, which would mean the cause is
      mis-attributed and F-1 needs re-diagnosis before a fix task is opened.
- [ ] **Decide on a committed high-volume seed.** Whether to add a synthetic >1,000-record fixture so F-1's
      symptom is reproducible without the local production-derived snapshot.
- [ ] **Statistics baby scoping.** With two babies, switch selection on Statistics and confirm no figure
      from the previous baby persists while the new range loads.
- [ ] **Timeline lazy history.** Scroll back through a page boundary and confirm no record is dropped or duplicated.
- [ ] Confirm every capability marked *reviewed* rather than *exercised* (rows 21, 23) is acceptable at that depth.

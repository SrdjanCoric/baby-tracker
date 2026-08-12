# Activity History Loading

SofiBaby uses a per-user, per-baby composite `(updated_at, id)` cursor for startup and foreground catch-up pulls. Catch-up queries order rows by `updated_at` and ID, read 1,000 rows per page, and process at most 5,000 rows per table in one pass. The first pull without a cursor starts from the oldest server row. If more than 5,000 rows exist, it stores an exact continuation cursor and resumes the bootstrap on the next pass instead of holding the baby's entire history in memory. Cached history outside each response stays in AsyncStorage and in context state.

After bootstrap, each catch-up overlaps the stored high-water mark by ten seconds. Replaying that small window keeps a row visible only after its transaction commits from being skipped when its server timestamp falls just behind a concurrently observed row. Reconciliation is idempotent, and the stored cursor never moves backward.

## Timeline ranges

Timeline converts the visible local calendar window to a half-open UTC range, `[start, end)`. Each activity context loads that range through the shared range service. The service uses these timestamps:

| Table | Timestamp |
| --- | --- |
| `feedings` | `started_at` |
| `sleep_sessions` | `started_at`, with overlap checked against `ended_at` |
| `diapers` | `changed_at` |
| `pumping_sessions` | `started_at` |
| `growth_measurements` | `measured_at` |
| `tummy_time_sessions` | `started_at` |
| `health_entries` | `logged_at` |

Range queries order by timestamp and ID, and read 1,000 rows at a time until the interval is exhausted. Sleep queries include sessions that started before the range and ended inside it, as well as sessions that are still active.

## Statistics and Sleep Patterns ranges

Statistics and Sleep Patterns use the same range service as Timeline.

- Sleep day views request one interval from the configured day start to the next day start. Week views request seven of these days. Summary views request the selected 7-, 14-, or 30-day calculation interval.
- Feeding, diaper, and pumping statistics request the active Today or 7 Days calendar interval.
- Tummy Time Today requests seven days because it compares today's total with the rolling seven-day average. Its 7 Days view reuses that coverage.
- Growth and health request a fixed all-history UTC range when their Statistics category opens. The service reads every page, including histories larger than 1,000 rows.

These requests do not run during startup. Switching controls reuses loaded or compatible in-flight coverage. The service fetches only missing subranges.

## Export and Reports ranges

Export (CSV) and PDF reports resolve the selected range through the same context-bound range loaders as Timeline and Statistics, so coverage resolved for an export is reused by the other surfaces and the contexts stay consistent with what the export reads. The pre-export record count is derived from the resolved range, so it matches the exported file. A failed range read is surfaced as an error instead of producing a silently incomplete export. A signed-in user whose household profile could not be resolved is treated as unverified rather than falling back to the startup-capped cache.

## Reconciliation

A range result enters the same per-user, per-baby storage lock used by local mutations and startup pulls. Reconciliation replaces the authoritative part of the requested interval while retaining:

- records outside the interval;
- queued creates and updates;
- queued deletes as absent local records;
- records from ranges loaded earlier; and
- CRDT tombstones needed to prevent deleted rows from returning.

The merged collection is written to AsyncStorage before its cursor advances and before the context receives it. If collection or cursor persistence fails, the next pass resumes or repeats safely. A later catch-up merges changed server rows without replacing cached historical ranges. When a tombstone cannot yet apply because that record has a queued local mutation, cursor advancement is withheld so the tombstone is delivered again after the mutation drains.

## Coverage and failures

Each activity context tracks loaded and in-flight UTC coverage for the selected baby and storage scope. Loaded ranges are reused. Overlapping requests wait for existing work and query only uncovered subranges. Results from an earlier baby or authentication scope are ignored.

Guest mode marks the requested range as locally verified and does not query Supabase. For authenticated users, Timeline, Statistics, and Sleep Patterns keep cached entries visible while a range is loading. A range without cached rows shows progress until coverage is confirmed. A failed read leaves cached data in place and shows a retry action. Zero values and empty states appear only after the requested range is confirmed. Statistics results are filtered to the selected baby while context state changes between babies.

# Activity History Loading

SofiBaby keeps startup activity pulls bounded to 1,000 recent rows per activity table. Each pull orders rows by the activity timestamp and row ID, then merges them into the user-scoped local collection. Cached history outside that response stays in AsyncStorage and in context state.

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

## Reconciliation

A range result enters the same per-user, per-baby storage lock used by local mutations and startup pulls. Reconciliation replaces the authoritative part of the requested interval while retaining:

- records outside the interval;
- queued creates and updates;
- queued deletes as absent local records;
- records from ranges loaded earlier; and
- CRDT tombstones needed to prevent deleted rows from returning.

The merged collection is written to AsyncStorage before the context receives it. A later startup pull adds recent server state without replacing cached historical ranges.

## Coverage and failures

Each activity context tracks loaded and in-flight UTC coverage for the selected baby and storage scope. Loaded ranges are reused. Overlapping requests wait for existing work and query only uncovered subranges. Results from an earlier baby or authentication scope are ignored.

Guest mode marks the requested range as locally verified and does not query Supabase. For authenticated users, Timeline, Statistics, and Sleep Patterns keep cached entries visible while a range is loading. A range without cached rows shows progress until coverage is confirmed. A failed read leaves cached data in place and shows a retry action. Zero values and empty states appear only after the requested range is confirmed. Statistics results are filtered to the selected baby while context state changes between babies.

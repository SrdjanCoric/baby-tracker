# Task 0077: Refresh the iOS Widget from a coherent activity summary

**Branch**: `feature/refresh-widget-from-native-activity-summary`
**Depends on**: none
**Change class**: `mixed`
**Validation tier**: `canonical`
**TDD applicable**: `yes`
**Source**: owner bug report and planning conversation, 2026-08-07 through 2026-08-08 · **User stories**: a caregiver whose household member stops a timer sees the Widget stop and show the newly completed activity summary together without opening the phone app; existing installed clients continue working during rollout

## What to build

Replace the iOS Widget's timer-only fresh-data path with one authenticated, read-only, versioned
native activity summary for exactly the selected baby. The reported sleep failure is the acceptance
tracer: when another caregiver completes sleep, the Widget currently removes the timer but retains
the previous `lastSleepEndedAt`, so it can claim the baby has been awake for hours until the app
opens. After this task, one successful refresh installs no sleep timer and the newly completed
sleep's end, duration, type, current-day total, nap count, and wake-window state as one coherent base.

Add a `get_baby_activity_snapshot(p_baby_id uuid, p_timezone text)`-style Postgres RPC. The exact
name may follow migration conventions, but its durable interface is one requested baby, one IANA
presentation timezone, and one JSON summary compatible with the existing native payload:

- additive `schemaVersion`, `serverAsOf`, timezone, and local-day metadata;
- `babyId`, `babyName`, canonical `activeTimers`, compatibility `activeTimer`, and `updatedAt`;
- feeding's latest time/type/side and current-day session count;
- sleep's latest time/type/duration, current-day minutes, goal, last completed end, nap count,
  applicable wake-window slot, and morning-confirmation state;
- diaper's latest time/type and current-day counts;
- pumping's latest time/side, current-day volume, and session count;
- the latest growth measurement required by Widget;
- tummy time's latest time/duration, current-day minutes, and goal.

This is a native display summary, not baby history. It returns no raw activity collections, notes,
attachments, health history, milestones, household members, other babies, tokens, or deleted rows.
Every activity read is scoped to the requested baby and filters tombstones. The RPC derives caller
identity from the authenticated session, applies existing household authorization as a
`SECURITY INVOKER`, takes no caller-supplied user ID, and exposes no baby-existence distinction to an
anonymous, outside-household, or deleted-baby request.

Build the RPC as one SQL statement so its relations share one PostgreSQL statement snapshot. Preserve
the existing completion invariant: a completed activity is durably written before its timer lock is
released. If a refresh lands between those writes, the summary must remain a coherent pre-stop view:
while a matching lock exists, its reserved activity identity does not contribute to completed
summaries. Modern timers match by stable activity/timer identity; legacy timers use the documented
baby, activity, starter, and exact-start compatibility identity.

All Widget timeline providers and Widget action reconciliation use one refresh/store coordinator.
It validates version, required sections, baby/account generation, response ordering, and timer/
summary invariants before atomically replacing a per-baby base cache. It coalesces concurrent refresh
triggers for the same baby. Timeout, `401`, non-success response, decode failure, incompatible
version, wrong baby, stale selection, or semantic failure leaves the prior complete cache unchanged;
the Widget never applies a fresh timer list by itself.

Widget stays event-driven. It requests the summary when WidgetKit reloads after the existing
timer-change push, after a Widget timer action, and during normal scheduled timeline generation. It
does not gain three- or thirty-second polling, and elapsed timers continue advancing locally.

Roll out additively: the RPC is deployable before new clients, old binaries keep their existing
endpoints, new decoders treat absent version metadata as legacy, and the singular timer field and
legacy cache key remain readable until the first valid new snapshot. Old installed clients remain
functional but keep the reported defect until upgraded.

## Implementation work

- [x] Write failing local SQL contract and authorization tests for the versioned selected-baby
      summary, including another household caregiver, an outsider, an anonymous caller, a deleted
      baby, another baby, and tombstoned activity rows.
- [x] Add the authenticated read-only RPC migration with `SECURITY INVOKER`, fully qualified
      relations, authenticated-only execution, no caller-supplied identity, one statement snapshot,
      and no production or shared-environment execution.
- [x] Implement every currently displayed Widget summary field with the shipped day-boundary,
      feeding-session, nap-count, morning-classification, goal, and wake-window meanings rather than
      inventing a parallel native interpretation.
- [x] Prove the three timer-completion read states locally: lock only; matching completed activity
      plus lock; completed activity after lock removal. The first two render a coherent pre-stop
      snapshot and the last renders the coherent completed summary.
- [x] Add shared legacy/versioned JSON fixtures that TypeScript and the Widget Swift decoder both
      accept, including additive unknown metadata and the singular-timer fallback.
- [x] Add the Widget refresh/store coordinator test-first, including full replacement, in-flight
      coalescing, equivalent refresh idempotency, cache-write-before-reload ordering, wrong-baby and
      out-of-order rejection, and byte-for-byte cache preservation on every failure class.
- [x] Route every Widget timeline provider and post-action reconciliation through the complete
      summary coordinator, and remove timer-only network results from every authoritative commit path.
- [x] Preserve existing push registration, timer-change push triggers, scheduled timeline cadence,
      local elapsed rendering, and legacy cache decoding without adding short-interval polling.
- [x] Measure the RPC payload and run local `EXPLAIN (ANALYZE, BUFFERS)` against representative
      selected-baby fixtures. Add a composite partial index only when the measured plan requires it;
      record the before/after evidence in the task completion record.
- [x] Extend the local two-caregiver sleep gate so caregiver A caches a running sleep, caregiver B
      completes it, and one Widget summary response contains no timer plus B's completed sleep and
      correct awake anchor. Force summary failure and prove no timer-only partial state is installed.
- [x] Run focused SQL, security, payload, native-source, component, and two-caregiver checks plus the
      repository's relevant canonical validation.

## Human checkpoints

- [x] [confirm-security] Approve the final RPC signature, `SECURITY INVOKER` choice, grants, caller-
      identity rule, household/deleted-baby denial behavior, timezone validation, and local-only
      migration plan before implementation.
- [x] [verify] On two household accounts and a physical iPhone Widget, start sleep under caregiver A,
      stop it under caregiver B, and do not open A's phone app · Expected: A's Widget stops after its
      WidgetKit refresh and immediately shows the new sleep end/awake duration and totals · Failure:
      the timer remains, the prior sleep end is used, totals remain from another generation, or the
      app must be opened · Reason: WidgetKit push scheduling and extension execution cannot be fully
      proved by local SQL, TypeScript, or source-contract tests. · Disposition: explicitly skipped by
      the owner on 2026-08-08 before PR creation and deferred until the implementation is available
      through TestFlight. The physical-iPhone boundary remains manually unverified and was accepted
      for this task.

## Acceptance criteria

- [x] One authenticated selected-baby RPC returns every field the Widget currently displays, as a
      compact summary rather than raw activity history or multiple babies.
- [x] Same-household access succeeds; anonymous, outside-household, deleted-baby, wrong-baby, and
      tombstoned data cannot leak into a response.
- [x] A timer and its dependent summaries always describe one coherent database state, including a
      refresh between activity persistence and lock release.
- [x] A remote sleep stop updates timer absence, `lastSleepEndedAt`, awake duration inputs, duration,
      type, current-day minutes, nap count, and wake-window state together without opening the app.
- [x] Every failed, malformed, stale, or wrong-scope refresh leaves the previous complete cache
      unchanged and retryable.
- [x] Widget refresh remains push/timeline/action driven with no short-interval polling, and concurrent
      triggers for one baby coalesce.
- [x] Old installed clients remain operational, and the new client reads legacy unversioned caches
      until its first valid versioned snapshot.
- [x] Local query-plan and payload measurements show bounded selected-baby work; any new index is
      justified by measured evidence.
- [x] No implementation or verification step reads from or mutates production.

## Implementation decisions

- **Approved security contract (2026-08-08):** add the backward-compatible
  `public.get_baby_activity_snapshot(p_baby_id uuid, p_timezone text) RETURNS jsonb` RPC in migration
  `061` as one `LANGUAGE sql STABLE SECURITY INVOKER` statement with an empty search path and fully
  qualified relations. It takes no caller identity, relies on `auth.uid()` plus existing household
  RLS, filters deleted babies and activity tombstones, returns no snapshot for invalid PostgreSQL IANA
  timezone names or inaccessible babies, revokes execution from `PUBLIC` and `anon`, and grants it
  only to `authenticated`. Apply and verify the migration only against local Supabase; existing RPCs,
  REST paths, table shapes, policies, and old native binaries remain unchanged.
- **Accepted security risk (TR-8, 2026-08-08):** retain the RPC's `SECURITY INVOKER` model and its
  RLS-protected column grants without adding a restricted executor role. This accepts the additional
  direct PostgREST surface for those granted columns; household RLS remains the authorization boundary.

## Implementation proof

- SQL RED/GREEN vectors cover the invoker signature and grants, household member/outsider/anonymous/
  deleted-baby denial, tombstones, every Widget field meaning, and lock-only, persisted-plus-lock,
  released-modern, and released-legacy completion states. A clean local reset applied all 63
  migrations through `061`, and the full SQL vector suite passed.
- The representative all-section fixture produced a 1,303-byte JSON payload. Local
  `EXPLAIN (ANALYZE, BUFFERS)` measured 28.966 ms execution with 184 shared-buffer hits. The measured
  selected-baby work did not justify an additional composite index, so none was added.
- Shared legacy/versioned fixtures pass both the TypeScript decoder and the Foundation-only Swift
  decoder. Swift coordinator RED/GREEN coverage proves coalescing, ordering, idempotency,
  write-before-reload, generation/baby/version/semantic rejection, timer-disappearance transition
  coherence, and byte preservation for malformed, timeout, unauthorized, and HTTP failures.
- All three timelines plus stop/pause reconciliation use the same authenticated RPC coordinator.
  The legacy `widgetData` key and singular timer fallback remain readable, while the app also writes
  the presentation timezone needed by the extension. Sign-out clears the native auth generation and
  every tracked per-baby snapshot before reloading the Widget.
- The two-caregiver runner now authenticates caregiver A locally, captures B's running sleep, checks
  B's completed row against one post-stop summary, and exercises forced-failure byte preservation.
  Its contract suite passed; the physical-iPhone checkpoint remains intentionally open.
- Focused validation passed: `npm run lint`, `npm run typecheck`, `npm run test:unit` (147 files,
  2,642 tests), `npm run test:security` (115 tests), the auth/Widget-context/stop component tests,
  `npm run e2e:household-timers:test`, the standalone Swift decoder/coordinator harness, a clean
  `npm run test:sql:setup && npm run test:sql`, and a generic iOS Simulator app/Widget build.

## Review decisions

- skipped (minor): TR-21 — The presentation-timezone producer has no call-site test — user limited remediation to TR-33, TR-34, and TR-37.
- skipped (minor): TR-22 — `isCachedDataFresh` is dead code — user limited remediation to TR-33, TR-34, and TR-37.
- skipped (minor): TR-23 — Planning metadata was added on the implementation branch — user limited remediation to TR-33, TR-34, and TR-37.
- skipped (minor): TR-32 — Coalesced refreshes can reload once per caller — user limited remediation to TR-33, TR-34, and TR-37.
- skipped (minor): TR-35 — Unacknowledged sleep-stop suppression has no bound — user limited remediation to TR-33, TR-34, and TR-37.
- skipped (minor): TR-36 — The no-pending-stop display direction lacks behavioral proof — user limited remediation to TR-33, TR-34, and TR-37.
- skipped (minor): TR-38 — Latest-diaper per-baby scoping is not mutation-red — user limited remediation to TR-33, TR-34, and TR-37.
- skipped (minor): TR-39 — Nap-anchor and continuation-exclusion predicates lack mutation-red vectors — user limited remediation to TR-33, TR-34, and TR-37.
- skipped (minor): TR-40 — Own-timer context branches lack vectors — user limited remediation to TR-33, TR-34, and TR-37.
- skipped (minor): TR-41 — `sleep_day_start` and `sleep_day_end` are dead code — user limited remediation to TR-33, TR-34, and TR-37.
- skipped (minor): TR-42 — The settled-first-nap pending-confirmation guard is not mutation-red — user explicitly skipped all remaining findings during finish-task.
- skipped (minor): TR-43 — The ignored-legacy pending-confirmation guard is not mutation-red — user explicitly skipped all remaining findings during finish-task.
- accepted security risk: TR-44 — A differently named future RPC could evade the regression guard for the retired clock RPC — user explicitly skipped all remaining findings during finish-task; no exploitable second RPC exists in the current migration.
- accepted security risk: TR-45 — An operationally misconfigured `widget.snapshot_now` session value could fail refreshes or freeze response ordering — user explicitly skipped all remaining findings during finish-task; authenticated callers cannot set the GUC through the current PostgREST configuration.
- skipped (minor): TR-46 — The task's approved security contract does not record the test-clock session seam — user explicitly skipped all remaining findings during finish-task.

## Completion record

- **Built:** one authenticated selected-baby activity-summary RPC and one Widget refresh/store path
  that atomically replaces the complete per-baby cache after validation. Timeline, push, and Widget
  action refreshes share this path; legacy caches and installed clients remain compatible.
- **Relevant files:** `supabase/migrations/061_get_baby_activity_snapshot.sql`,
  `targets/widget/WidgetActivitySnapshot.swift`, `targets/widget/index.swift`,
  `src/services/widget-activity-snapshot.ts`, `src/services/widget-data-service.ts`, shared fixtures
  under `fixtures/widget-activity-snapshots/`, and the SQL, Swift, TypeScript, component, security,
  native-wiring, and household-runner tests recorded above.
- **README:** updated `iOS Native Integrations` to describe complete selected-baby Widget refreshes
  and prior-cache preservation on failure. The affected prose passed two `write-well` audit passes;
  the first rewrote the previous push-only description, and the second found no remaining issues.
- **Review:** the retained review fixed TR-1 through TR-7, TR-9 through TR-20, TR-24 through TR-31,
  TR-33, TR-34, and TR-37. The user skipped TR-21 through TR-23, TR-32, TR-35, TR-36, TR-38
  through TR-43, and TR-46. The user accepted TR-8's RLS-protected column-grant surface and the
  residual TR-44 and TR-45 risks described above.
- **Final automated proof (2026-08-08):** the `npm run check` code stage passed lint, type checking,
  unit and component tests, CI contracts, the Swift Widget decoder/coordinator harness, and the
  production-bundle gate. Its SQL setup first encountered a sandbox-only `EPERM` while Supabase
  wrote `~/.supabase/telemetry.json`; rerunning only the affected SQL setup and vector stage with
  filesystem permission applied all 63 local migrations and passed every SQL vector, including the
  authenticated Widget snapshot contract.
- **Manual verification:** explicitly skipped by the owner on 2026-08-08 before PR creation and
  deferred until the implementation is available through TestFlight. The physical-iPhone,
  two-household-account boundary remains manually unverified and is a release-owner follow-up.

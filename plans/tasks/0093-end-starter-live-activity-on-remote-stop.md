# Task 0093: End starter's Live Activity on remote stop

**Branch**: `feature/end-starter-live-activity-on-remote-stop`
**Depends on**: 0091

**Implementation classification**: mixed (native/app code, edge function, database migration); validation-tier: canonical; tddApplicable: true. Focused pre-review checks here; final canonical proof belongs to finish-task.
**Source**: `plans/allow-household-timer-control.md` (planning brief, 2026-09-01) · **User stories**: As the caregiver who started a timer, when someone else stops it, my lock-screen/Dynamic Island Live Activity ends promptly even if my app is backgrounded.

## What to build

When B stops A's timer while A's app is foregrounded, realtime handles cleanup (0091). But A's Live Activity is device-local: backgrounded, it keeps ticking indefinitely. This task ends it reliably via ActivityKit remote push:

- A's device, on starting a Live Activity for a timer, obtains the per-activity ActivityKit push token and syncs it to the backend (alongside the existing widget push-token storage — exact table shape decided in-task: extend `user_push_tokens` or a sibling table keyed by `timerInstanceId`).
- The existing `send-widget-push` edge function (already triggered on `active_timers` INSERT/DELETE) gains a Live Activity branch: on DELETE, send an APNS `liveactivity` push with `event: end` to the stored token for that timer instance, ending A's Live Activity.
- Token rows are cleaned up when the activity ends (either path).
- Decision context: best-effort silent-push wake was rejected in planning (no delivery guarantee, stale ticking timer). Push-to-start mirroring on other members' devices is task 0094, not this one — but do not preclude it (the edge-function push branch and token storage should accommodate ending activities that were started remotely later).

Verify the current APNS Live Activity payload requirements (`apns-push-type: liveactivity`, topic suffix `.push-type.liveactivity`, `event` values) against Apple docs during implementation — planning asserted these from model knowledge.

## Implementation work

- [x] Swift/app: obtain and observe the Live Activity push token on activity start; sync token + `timerInstanceId` to backend; remove on end.
- [x] Backend: token storage (migration if a new table/columns are needed) with RLS restricting rows to the owning user.
- [x] Edge function: on `active_timers` DELETE, look up the Live Activity token for that timer instance and send the ActivityKit end push; keep existing widget silent-push behavior intact.
- [x] Unit/integration tests for the edge-function branch (token found → end push composed; no token → no-op) and token lifecycle.

## Human checkpoints

- [ ] [confirm-db] Apply the token-storage migration (if any) to the shared Supabase project.
- [ ] [verify] Two real devices: A starts a timer (Live Activity visible), backgrounds the app and locks the phone; B stops the timer from their app. Expected: A's Live Activity ends within seconds without opening the app. Failure: Live Activity keeps ticking until A foregrounds. Reason: this repository's CI does not exercise APNS delivery; physical background delivery remains a release-owner check.

## Acceptance criteria

- [ ] Remote stop ends the backgrounded starter's Live Activity via push (manual two-device verification passed).
- [x] Fallback intact: with push undelivered, foregrounding the app still clears timer state and dismisses the activity (0091 restore check).
- [x] Edge-function tests green; widget silent-push behavior unchanged.
- [x] Token rows cleaned up after timer end (no orphan accumulation).

## Implementation evidence (2026-09-05, pre-review)

- Chose a sibling `live_activity_push_tokens` table in migration 066, keyed per user and native
  activity, indexed by baby and timer instance. Multiple devices and future mirrored activities can
  share a timer instance. There is deliberately no foreign key to `active_timers`, because its
  asynchronous DELETE webhook still needs the tokens.
- Registration derives ownership from `auth.uid()` and also checks the expected user, preventing an
  in-flight upload from crossing an account switch. Household membership is required. Clients can
  read/delete only their own rows and cannot bypass the registration RPC with direct writes. The RPC
  locks the matching timer row `FOR UPDATE`: registration commits before DELETE, or returns false
  after DELETE without inserting an orphan.
- Native activities carry optional baby/timer/user attributes, retaining decoding compatibility with
  older activities. New identified starts reuse only a matching identity. Restored legacy/offline
  activities can be bound by their persisted native activity ID after ownership reconciliation.
  Accountless and unreconciled offline timers do not register server tokens. Android and older native
  binaries retain the existing bridge method.
- Native token/state observers persist per-activity tokens and end tombstones. The app synchronizes
  on native events, foreground, and reconnection, retries failed operations, replaces rotated tokens,
  and serializes cleanup after in-flight registration. A registration rejected because the timer is
  already gone ends the local activity. The legacy App Group token key remains available to existing
  widget/Watch actions.
- The DELETE branch runs before widget-recipient early returns and sends to all tokens for the exact
  baby/timer instance, including the starter. The Live Activity branch requires the
  service-role bearer; other webhook bearers retain existing widget delivery and skip activity ends.
  Widget headers, recipients, and payload remain unchanged. Delivery uses up to eight workers with a
  ten-second total budget; rows that were not attempted remain available until cleanup. Undelivered
  pushes retain the existing foreground fallback.
- Both native end and the DELETE handler remove token rows. A scheduled hourly cleanup removes rows
  older than 24 hours as a backstop for missed webhooks, killed apps, or failed cleanup requests.
- Apple requirements verified against [Starting and updating Live Activities with ActivityKit push
  notifications](https://developer.apple.com/documentation/activitykit/starting-and-updating-live-activities-with-activitykit-push-notifications):
  observe asynchronous token changes; use the Live Activity topic/push type; provide an end event,
  Unix timestamp, final content state, and a past dismissal date. Apple also documents Simulator push
  testing on supported Macs; this does not replace the task's physical-device acceptance check.

### Focused proof

Logs: `/tmp/agent-workflows/e2f8af45fd34/a0416957a610`.

- RED → GREEN: missing edge end branch (`edge-red.log`, `edge-green.log`), missing token-registration
  RPC (`sql-red.log`, `sql-green.log`), missing native persistent token store (`native-red.log`,
  `swift.log`), missing serialized app token synchronizer (`token-sync-red.log`,
  `token-sync-green.log`), and missing testable webhook handler (`handler-red.log`,
  `handler-green.log`). A PostgreSQL regex repetition-bound error was corrected during the SQL
  cycle; the final migration was reapplied to the task-created local table and passed.
- Five focused Vitest files: **25 passed**, covering token transport/rotation/cleanup, account
  isolation, registration/end races, no-token no-op, per-device failure handling, webhook
  authorization, unchanged widget pushes, and shared timer lifecycle (`unit.log`).
- `jest --runInBand --runTestsByPath src/__tests__/external-timer-stop-providers.integration.test.tsx
  src/contexts/widget-context.component.test.tsx`: **66 passed** (`component.log`). The real-provider
  integration file remains unchanged.
- `npm run test:widget:swift`: **PASS**, including production Widget/Watch typechecks and native token
  persistence/end-race tests (`swift.log`). Swift ActivityKit bridge typecheck and Objective-C export
  syntax check against installed React Native headers: **PASS** (`native-typecheck.log`,
  `objc-typecheck.log`; Objective-C reports only upstream React header property warnings).
- Local `scripts/sql/live-activity-push-token-tests.sql`: **PASS** for rotation, ownership,
  account-switch rejection, future mirrored-device registration, post-DELETE token retention, late
  registration rejection, and owner cleanup (`sql-green.log`). Added to `npm run test:sql`.
- `npm run typecheck`, affected-file ESLint, and edge-handler TypeScript check using the installed
  Supabase SDK declarations: **PASS** (`typecheck.log`, `lint.log`, `edge-typecheck.log`).
- Final classification remains **mixed / canonical / tddApplicable: true**. Full canonical validation,
  manual review, and physical-device proof belong to the subsequent review/finish workflow.

### Deployment prerequisites still pending

- Apply migration 066 to the shared project only at the declared `[confirm-db]` checkpoint, then
  deploy the updated `send-widget-push` function and an app binary containing the native bridge.
- The existing timer webhook is not defined in version-controlled migrations. At deployment, verify
  its `active_timers` DELETE payload includes `old_record.timer_data.timerInstanceId` and its
  Authorization header uses the service-role bearer. No shared configuration was inspected or changed
  during implementation.
- Physical two-device APNS acceptance remains pending. The combined household E2E remains assigned
  to the 0094 closeout by the master plan; it was not run here.

## Reviewed implementation and finish evidence (2026-09-05)

- Review file `reviews/0093-end-starter-live-activity-on-remote-stop-206032d.md` is closed.
  TR-1 through TR-11 are fixed in separate commits. No minor findings were skipped and no security
  risks were accepted. TR-12 documents the pre-existing unauthenticated widget webhook path and remains
  deferred outside this task; bearer verification protects the new Live Activity branch.
- Remediation preserves legacy widget delivery, retains tokens when signing fails, subtracts completed
  pauses in the final push frame, closes the sync-settlement race, and clears account-switch tombstones.
  Sign-out stops token synchronization and removes the departing user's rows before ending the session.
  Native starts end same-type orphans before requesting or reusing the matching activity.
- Both edge functions share the APNs signing and end-request builder in `supabase/functions/_shared/apns.ts`.
  Handler tests assert baby/timer lookup and cleanup filters, and failure logs retain the caught cause.
  `docs/SECURITY.md` describes token ownership, registration, retention, and fan-out limits.
- Registration serializes on the timer lock and allows eight activities per user and timer. Existing
  tokens can rotate at the cap. Delivery runs at most eight requests concurrently within ten seconds.
- README updated: iOS Native Integrations explains remote end pushes and foreground fallback;
  Edge Functions lists migration, webhook, native binary, and physical-device release requirements;
  Project Structure reflects migration 066. Affected prose passed the full write-well audit in one pass.
- Review remediation proof: 19 focused unit tests, 22 auth component tests, Swift token/selection
  harness, controller syntax, app and edge-module type checks, affected ESLint, and rollback-only local
  SQL registration/ownership/cap tests passed. Logs remain under
  `/tmp/agent-workflows/e2f8af45fd34/a0416957a610` until merged-task cleanup.
- User authorized finish-task, PR creation, and sync-main. Shared deployment and physical-device
  checkpoint status is awaiting clarification; these are not recorded as passed.

### Final automated validation

- Canonical code run passed lint, strict type checking, all 2,861 unit tests, timezone checks,
  and 117 component suites (1,093 tests). One existing Watch integration file failed at import
  because Supabase environment variables were absent in this working environment. Its 16 tests
  passed with command-local dummy configuration:
  `EXPO_PUBLIC_SUPABASE_URL=http://127.0.0.1:54321 EXPO_PUBLIC_SUPABASE_ANON_KEY=test-anon-key node node_modules/jest/bin/jest.js --watchman=false --runInBand --runTestsByPath src/__tests__/watch-realtime-baby-selection.integration.test.tsx`.
  No source or environment-file change was needed. Evidence: `canonical.log`, `component-env-proof.log`.
- Remaining canonical stages run separately after the import failure: `npm run test:ci` passed
  65 tests; `npm run test:widget:swift` passed all harnesses and production Widget/Watch type checks.
  Evidence: `canonical-ci.log`, `canonical-swift.log`.
- `npm run test:sql:setup` applied the complete local migration chain through 066;
  `npm run test:sql` passed the complete SQL suite. This reset only the local test database.
  Evidence: `sql-setup.log`, `canonical-sql.log`.
- The changed ActivityKit bridge passed `swiftc -typecheck` against the installed iOS SDK and
  React Native headers, including the new duplicate-activity selection call.
  Evidence: `finish-native-typecheck.log`.
- `npm run test:production-gating` passed and confirmed the iOS Hermes bundle excludes development
  onboarding tools (`canonical-production.log`). All canonical stages now have passing evidence;
  the initial environment-dependent component failure is resolved by the focused rerun above.
- Finish remains blocked at the required manual/deployment checkpoint. Keep the task pointer at `[~]`
  and retain its review file until the user confirms the result or explicitly defers the checkpoint.

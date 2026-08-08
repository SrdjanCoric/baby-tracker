# Task 0078: Refresh Apple Watch summaries after timer changes

**Branch**: `feature/refresh-watch-summaries-after-timer-changes`
**Depends on**: 0077
**Change class**: `mixed`
**Validation tier**: `canonical`
**TDD applicable**: `yes`
**Source**: owner bug report and planning conversation, 2026-08-07 through 2026-08-08 · **User stories**: a caregiver sees Apple Watch converge on another household member's timer stop and the newly completed activity summary without opening the phone app; Watch does not recompute the complete summary every 30 seconds

## What to build

Adopt Task 0077's versioned selected-baby native activity summary on Apple Watch while retaining the
current lightweight timer polling cost. The reported sleep tracer is the same: after another
caregiver stops sleep, Watch must not remove the timer and continue calculating awake time from the
previous completed sleep.

Keep the direct selected-baby `active_timers` request every 30 seconds only while Watch believes a
timer is active. Treat its result solely as a timer fingerprint containing the minimum identity and
state needed to detect start, stop, pause, resume, start-anchor, or context changes. An unchanged
fingerprint performs no full-summary request and no cache write. A changed fingerprint triggers one
request to the complete summary RPC, but the probe result itself is never merged into or rendered as
authoritative base state.

Watch also requests a complete summary on activation, explicit refresh, relevant post-action
reconciliation, and existing phone-reachability opportunities. A valid response atomically replaces
the selected baby's complete base. A failed full fetch after a changed fingerprint retains the old
complete base and retries through existing refresh opportunities rather than showing a fresh timer
state beside stale summaries.

Keep Watch optimistic commands separate from the immutable base, partitioned by account, baby, and
stable timer/request identity. A pending overlay may express the user's provisional start, pause,
resume, or stop, but an unrelated refresh cannot clear it or promote it to server state. Clear an
overlay only when a correlated complete snapshot or explicit command acknowledgement proves the
effect. A late response for a prior account or selected baby cannot commit.

WatchConnectivity remains an optional fast transport and bootstrap fallback. Phone-published legacy
payloads and cached `watchData`, `widgetData`, and multi-baby envelopes remain decodable during the
additive rollout, but they cannot overwrite a newer valid versioned per-baby base. A reachable-phone
sync reply may carry the same complete summary contract or the last coherent cache; it may not supply
a timer-only authoritative patch.

This task does not promise immediate delivery while the Watch app is suspended. It adds no Watch
remote-push subsystem and no full-summary request every 30 seconds. It also does not reopen the broad
deferred Watch regression or WatchConnectivity failure audits; it fixes this confirmed, bounded
convergence defect against Task 0077's contract.

**Owner-directed authorization follow-up (2026-08-08):** migration `062` revokes only direct
`authenticated` `INSERT` on `public.active_timers`, preserving the RLS-protected `SELECT` required by
the Watch probe and household visibility plus the existing owner-scoped `UPDATE` and `DELETE` paths.
Timer acquisition remains available through `acquire_timer_lock`. The existing INSERT RLS policy is
retained so the emergency rollback is the single `GRANT INSERT ON TABLE public.active_timers TO
authenticated` statement documented in the migration. Compatibility proof covers the May 2026 phone
and Watch RPC shapes and the latest clean two-caregiver simulator gate.

## Implementation work

- [x] Write failing Watch coordinator tests for an unchanged timer fingerprint, every material timer
      fingerprint change, activation, explicit refresh, post-action confirmation, and reachability
      transitions.
- [x] Keep the 30-second probe selected-baby and timer-only while any timer appears active; prove an
      unchanged fingerprint causes no summary request, cache write, or complication reload.
- [x] On a changed fingerprint, fetch Task 0077's full summary and atomically replace only the
      matching selected baby's base after version, scope, ordering, and semantic validation.
- [x] Delete timer-only reconciliation from authoritative Watch base-state commits. On full-summary
      failure, preserve the exact prior base, retain the detected change for retry, and request fresh
      phone credentials after `401` without exposing tokens.
- [x] Separate Watch optimistic overlays from the server base and reconcile them by stable request,
      timer, and reserved activity identity; prove unrelated and out-of-order snapshots do not clear
      pending work.
- [x] Add per-account/per-baby versioned cache precedence and compatibility adapters for the legacy
      single-baby and multi-baby WatchConnectivity/application-context payloads.
- [x] Ensure sign-out, household change, baby selection, and late network/phone responses cannot
      publish another account's or baby's cached summary.
- [x] Extend shared contract fixtures so Watch decodes the same versioned selected-baby summary as
      Widget while ignoring unsupported additive display fields.
- [x] Extend the local two-caregiver sleep gate: cache A's running timer on Watch, complete it under B,
      detect the changed timer fingerprint, and prove the next accepted Watch base has no timer plus
      B's new sleep end and correct summary. Force the full fetch to fail and prove no partial probe
      state is installed.
- [x] Run focused Watch source, decoder, cache, WatchConnectivity, timer-command, local Supabase, and
      two-caregiver checks plus the repository's relevant canonical validation.
- [x] Apply migration `062` locally and prove authenticated callers cannot insert timer rows directly
      while May-era and current RPC acquisition, selected-baby reads, owner updates/deletes, offline
      reconciliation, and the clean two-caregiver gate remain valid.

## Human checkpoints

- [x] [verify] On a physical paired iPhone and Apple Watch with two household caregivers, start sleep
      under caregiver A, stop it under B, leave A's phone app unopened, and observe Watch through its
      next available timer check/refresh · Expected: Watch stops the timer and shows the new sleep
      end/awake duration and totals together; an unchanged running timer produces no repeated full
      summary fetch · Failure: Watch keeps the timer, uses the previous sleep end, mixes generations,
      requires the phone app to open, or requests the full summary every 30 seconds · Reason:
      WatchConnectivity scheduling, watchOS suspension, and physical-device network timing cannot be
      fully proved by repository tests.

## Acceptance criteria

- [x] The 30-second Watch loop remains a lightweight selected-baby timer probe only while a timer is
      believed active; unchanged fingerprints cause no complete-summary work.
- [x] Every material timer fingerprint change triggers one coalesced full-summary fetch, and only the
      validated complete response can replace Watch base state.
- [x] A remote sleep stop yields timer absence and the newly completed sleep's awake anchor, duration,
      type, totals, nap count, and wake-window state together without opening the phone app.
- [x] Full-fetch failure, stale credentials, wrong baby/account, out-of-order responses, and cache-
      write failure preserve the previous coherent base and a retry path.
- [x] Optimistic Watch actions remain separate, scoped, durable where already required, and clear only
      on correlated confirmation.
- [x] New Watch code reads legacy phone/cache payloads during rollout but prevents them from
      overwriting a newer valid versioned base.
- [x] No full-summary 30-second polling, guaranteed suspended-Watch delivery, new Watch push system,
      broad deferred audit work, production access, or production mutation is introduced.
- [x] `authenticated` cannot directly insert `active_timers`, retains `SELECT`, `UPDATE`, and `DELETE`,
      and can still execute `acquire_timer_lock`; the migration preserves a one-statement rollback.

## Review decisions

- unresolved (major): TR-8 — legacy payload timestamps with fractional seconds are rejected — owner declined remediation for this pass.
- unresolved (major): TR-9 — pending diaper logs clear without correlated confirmation — owner declined remediation for this pass.
- unresolved (major): TR-10 — the release gate tests a JavaScript twin instead of the Swift coordinator — owner declined remediation for this pass.
- accepted (security risk): TR-11 — sign-out invalidation can be dropped before WatchConnectivity loads — user requested this remediation pass focus only on TR-1–TR-7.
- skipped (minor): TR-12 — optimistic overlay storage is not connected to rendered Watch state — user requested this remediation pass focus only on TR-1–TR-7.
- skipped (minor): TR-13 — a completed coalesced fetch can briefly serve stale bytes — user requested this remediation pass focus only on TR-1–TR-7.
- skipped (minor): TR-14 — a late acknowledgement can miss an overlay after a baby switch — user requested this remediation pass focus only on TR-1–TR-7.
- skipped (minor): TR-15 — pause/resume overlays can clear on an uncorrelated pre-existing state — user requested this remediation pass focus only on TR-1–TR-7.
- skipped (minor): TR-16 — migration 062 lacks a repository-gated revoke/regrant vector — user requested this remediation pass focus only on TR-1–TR-7.
- skipped (minor): TR-17 — the household-runner test is outside canonical validation — user requested this remediation pass focus only on TR-1–TR-7.
- skipped (minor): TR-18 — README omits the new Watch refresh model — user requested this remediation pass focus only on TR-1–TR-7.
- skipped (minor): TR-19 — Swift runner source-text assertions add no behavioral proof — user requested this remediation pass focus only on TR-1–TR-7.
- skipped (minor): TR-20 — the failed-path array inequality assertion is tautological — user requested this remediation pass focus only on TR-1–TR-7.
- skipped (minor): TR-21 — plan scope was expanded on the implementation branch — user requested this remediation pass focus only on TR-1–TR-7.
- skipped (minor): TR-22 — unacknowledged stop overlays can accumulate — user requested this remediation pass focus only on TR-1–TR-7.
- skipped (minor): TR-23 — README migration count stops at 060 — user requested this remediation pass focus only on TR-1–TR-7.

## Completion record

- **Implementation:** Apple Watch now keeps a versioned per-account, per-baby summary base and uses
  the selected baby's active-timer fingerprint to decide when to fetch a complete replacement.
  Optimistic commands remain separate from the base, stale or cross-scope responses cannot commit,
  and failed complete-summary requests preserve the prior coherent snapshot. Migration `062` keeps
  timer acquisition behind `acquire_timer_lock` while retaining the documented compatibility paths.
- **Key files:** `targets/watch/WatchActivitySummary.swift`, `targets/watch/index.swift`,
  `scripts/swift/watch-summary-tests.swift`, `scripts/sql/active-timer-authorization-tests.sql`,
  `e2e/scripts/run-household-timers.mjs`, and
  `supabase/migrations/062_revoke_authenticated_active_timer_insert.sql`.
- **Decisions:** The 30-second loop remains a timer-only probe and runs only while Watch believes a
  timer is active. A changed fingerprint requests one complete summary; the probe itself never
  becomes authoritative state. WatchConnectivity remains an optional fast path and compatibility
  fallback.
- **Documentation:** Updated the README Apple Watch behavior and migration range. The affected prose
  passed the `write-well` audit after two passes.
- **Review:** TR-1 through TR-7 were fixed. The finish-task documentation audit also resolved the
  README concerns in TR-18 and TR-23. TR-8 through TR-10 remain unresolved because the owner declined
  remediation for this pass. TR-11 is an accepted security risk because the user limited remediation
  to TR-1 through TR-7. TR-12 through TR-17 and TR-19 through TR-22 remain skipped minor findings for
  the same reason.
- **Automated proof:** `npx vitest run src/__tests__/native/native-resume-real-start.test.ts`,
  `npm run test:widget:swift`, and `npm run check:code` passed on 2026-08-08. The final source-text
  regression now verifies that Watch network refreshes use `WatchTimerProbeDecoder` instead of the
  removed raw timestamp mapping.
- **Manual proof:** The user confirmed the paired physical iPhone and Apple Watch two-caregiver sleep
  scenario passed on 2026-08-08. Watch removed the remotely stopped timer, refreshed the completed
  sleep summary without opening caregiver A's phone app, and did not repeatedly fetch a complete
  summary for an unchanged timer.

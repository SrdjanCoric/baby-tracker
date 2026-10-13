# Task 0131: Discard a running timer from its screen

**Branch**: `feature/discard-running-timer`
**Depends on**: none
**Base**: `main`.
**Merges into**: `main`, through one PR, after the owner says push.
**Source**: user request and conversation 2026-10-12 · **Mock**: `docs/design/discard-timer.html` · **User stories**: a parent starts a sleep timer, the baby cries three minutes later, and the parent throws the timer away from the timer screen without saving an entry and without visiting the timeline.

## What to build

On the running-timer screen of sleep, feeding, pumping and tummy time, the person who started the timer sees one extra line, "✕ Discard timer", directly under the hint line, in the hint's grey colour and size. It is there in both the running and the paused state. Everyone else sees today's screen. Build it exactly as the "Decided" frames in `docs/design/discard-timer.html` show.

Tapping it opens the native alert. Title is per type: "Discard this sleep?", "Discard this feed?", "Discard this pumping session?", "Discard this tummy time?". Body: "{elapsed} will not be saved. The timer is cleared on every phone." where {elapsed} is the time the stop would record, formatted the way the timer screen formats it. Buttons: "Keep timing" (cancel, default) and "Discard" (destructive).

| Situation | Result |
| --- | --- |
| Starter taps Discard and confirms | Household lock released, local timer cleared, Live Activity ended, no entry written, sheet closes the same way Stop closes it. |
| Starter confirms while the timer is paused | Same. |
| Starter confirms under 60 seconds | Same. The alert is always shown. |
| Starter is offline | Local timer cleared and sheet closes now; the lock release is queued and retried the way a stop's release is. |
| Another household member opens the screen | No discard line. Pause, resume and stop unchanged. |
| Another member's phone sees the lock vanish | It clears its copy and ends its Live Activity, as it does after a remote stop. |
| Accountless or offline-owned timer (no lock) | Discard line shown to the local owner; clears locally, nothing to release. |

## Decided

- Only the starter may discard. Same ownership rule the start-time editor already uses. — Owner decision: discard loses data; stop does not.
- No Undo, no toast, no control on the Home card, widget or Watch. — Owner decision, 2026-10-12.
- Always confirm, even when a stop would already discard silently. — One rule, no surprise.
- Lock release reuses the durable release path a stop uses. — No new server call; the server already allows the starter to delete its own lock.

## Clarifications

- Remote-discard proof preserves current phone behavior: another caregiver sees the household lock
  disappear; a second phone signed into the starter's account clears its restored local timer and
  ends its Live Activity. Other caregivers do not gain local timer copies or Live Activities.
  Asked and approved by the owner during implementation, 2026-10-12.

## Implementation classification

- Change class: `code`; validation tier: `canonical`; TDD applicable: `true`.
- Focused pre-review proof covers timer screens, real-provider lifecycle, locale completeness,
  affected-file lint and TypeScript. `finish-task` owns the final `npm run check:code` gate.

## Non-goals

- Discard from the Home card, the widget, the Watch or the Lock Screen.
- Letting other household members discard.
- Changing the silent under-60-second rule on Stop.

## Context

Each context already has a "finish without writing" path used when a stop is under 60 seconds (tummy time lacks it and needs one). It releases the lock durably and ends the Live Activity. Remote vanish handling already clears other phones. The four screens each hold their own running-timer view with identical control rows. Live strings live in `src/i18n/locales/*.json` (nine locales). The mock's green bars and the "Today" column are explanation, not design.

## Implementation work

- [x] The discard line appears on all four timer screens only for the starter, in running and paused states, matching the mock — proven in `app/sleep/index.component.test.tsx`, `app/feeding/index.component.test.tsx`, `app/pumping/index.component.test.tsx`, `app/tummyTime/index.component.test.tsx`
- [x] Tapping it opens the alert with the per-type title, the elapsed-time body and the two buttons; "Keep timing" changes nothing — proven in the same four screen tests
- [x] Confirming writes no entry, clears the local timer, ends the Live Activity and releases the lock durably, for each of the four types, including the paused and offline cases — proven in `src/__tests__/external-timer-stop-providers.integration.test.tsx`
- [x] Another household phone clears its timer after a discard — proven in `src/__tests__/external-timer-stop-providers.integration.test.tsx`
- [x] All nine locales carry the new strings — proven in a new per-feature locale test under `src/i18n/`, like the existing ones there

## Acceptance criteria

- [x] Every row of the decision table has a passing test.
- [x] The rendered screens match the "Decided" frames of `docs/design/discard-timer.html` in text, order, colour and placement.
- [x] `npm run check:code` passes.


## Implementation evidence

- Branch: `feature/discard-running-timer`; base: `main` at `cff421d0`.
- Logs: `/tmp/agent-workflows/e2f8af45fd34/715cd47a36e6`.
- Screen cycle: observed missing-control RED, then 24 new passing cases across the four screen
  suites. Covers running/paused visibility, hint order, matching hint typography/colour tokens,
  mock spacing, per-type alert copy, elapsed formatting, preferred cancel, no-op cancellation,
  confirmation under a minute, starter restriction, accountless/offline ownership and both modal
  exit paths. Feeding's existing test formatter pads minutes; production uses `formatDuration` on
  every screen and for the alert.
- Provider cycle: observed missing-API RED, then six passing four-type matrices for running,
  paused, short, offline release, accountless and offline-owned timers. The timers are started
  through real providers, use real storage, write no local or synced entry, clear snapshots and
  end Live Activities. Durable release is called for owned locks; no-lock timers release nothing.
- Ownership sensitivity: temporarily bypassing feeding's discard branch and ownership guard
  failed the no-entry and other-caregiver-preservation assertions. Both mutations were removed.
- Phone proof: the existing four-type observed-lock-disappearance test proves cleanup on another
  starter-account phone. The new other-caregiver test uses the real `ActiveTimersProvider` and
  real lock transformer to consume DELETE events for all four locks and remove the shared state.
- Locale cycle: missing-copy RED followed by ten passing cases for all nine locales and exact
  English copy, including the elapsed interpolation token.
- Focused validation: six complete Jest suites, 176 tests passed (`component.log`, 10s); locale
  and existing durable lock-release/retry unit suites, 32 tests passed (`unit.log`, <1s);
  TypeScript passed (`typecheck.log`, 6s); affected-file ESLint passed (`lint.log`, 2s).
  After strengthening the ownership fixture to use produced lock payloads, its focused regression
  passed again (`ownership.log`), followed by TypeScript and fixture lint (`fixture-lint.log`).
- Boundaries: lock ownership and DELETE-row shape mirror `ActiveTimerLock`, `ActiveTimerRow` and
  `transformActiveTimerFromRemote` in `src/services/active-timer-service.ts`. Lock fixtures use the
  real providers' `acquireTimerLock` payloads. Timer snapshots come from public provider starts and
  are verified through real storage getters; Live Activity and network calls remain mocked system
  boundaries. Existing service tests prove write-ahead release persistence and retry after failure.
- Derived facts: the screens' start-editor ownership condition also identifies discard ownership;
  `formatDuration` supplies alert elapsed text; per-type completion cleanup already ends Live
  Activities and clears snapshots. These are existing code conventions, not new policies.
- Deterministic screen/provider tests are the task's specified seams; device E2E would duplicate
  this proof and cannot reliably force offline release ordering. No device E2E or native screenshot
  was run. The final `npm run check:code` acceptance gate remains for `finish-task` after review.
- Deferred obstacles, additions outside the task and out-of-scope work: none. The remote-phone
  clarification above is the only question raised and was approved before its proof was added.


## Final validation

- All nine review findings fixed: cold-start protection for queued releases, durable release
  for offline-owned timers, explicit discard success/refusal results, shared ownership and
  confirmation controls, consistent translations, expanded touch targets, real-discard remote
  cleanup proof, and dependency formatting.
- Assembled focused checks passed: 186 component/integration tests, 75 unit tests, TypeScript,
  and affected-file ESLint. Review findings and detailed proof remain in the ignored review file.
- `npm run check:code` passed on 2026-10-13, including lint, TypeScript, unit tests, local-date
  coverage, the full component suite, CI-script tests, Swift checks, and production-bundle gating.
  Log: `/tmp/agent-workflows/e2f8af45fd34/715cd47a36e6/canonical.log`.
- The first canonical run exposed an existing date-sensitive retry fixture: its October 8
  `queuedAt` timestamp had crossed the 24-hour expiry window. A focused RED-GREEN check proved
  the correction to use the queue time at test runtime; the complete canonical rerun passed.
- Accountless timers queue no release. Authenticated offline-owned timers now queue durable
  release even without a confirmed lock, covering a server insert that succeeded before a timeout.
- Closed locally through finish-task; no push was performed.

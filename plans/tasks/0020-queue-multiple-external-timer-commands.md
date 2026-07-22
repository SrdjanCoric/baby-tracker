# Task 0020: Queue multiple external timer commands

**Branch**: `feature/queue-external-timer-commands`
**Depends on**: 0014, 0017
**Source**: release review conversation, July 2026 · **User stories**: widget, Live Activity, and Watch commands cannot overwrite each other before app launch; every matching timer command is consumed once

## What to build

Replace the single pending external-stop slot with a versioned command queue. Each command must identify its baby, activity type, timer instance, action, and event time. Producers append durably before remote mutation. Consumers remove only the command they handled and leave unrelated or newer commands intact.

Migrate a valid legacy `pendingWidgetStop` value into the new queue without duplicating or losing it. Preserve stale-command rejection and repeated-delivery idempotency.

## Software Repository Guidelines

**Applicable references**: `references/01-style-and-code-quality.md`, `references/02-testing.md`, `references/06-code-health-and-maintainability.md`, `references/10-definition-of-done.md`

- [x] Keep one typed queue schema and compare-and-remove implementation across native and React providers.
- [x] Test cold start, repeated delivery, multiple babies, multiple activity types, and migration without relying on timing.

## Before implementation

Run the existing provider and native intent tests from the repository root.

```bash
git status --short --branch
npm ci
npm run typecheck
npm run lint
npm run test:component -- --runInBand src/__tests__/external-timer-stop-providers.integration.test.tsx
npm run test:unit -- src/__tests__/native/widget-stop-intent-order.test.ts
```

Record the current App Group storage keys and preserve backward compatibility for installed clients.

## Implementation work

- [x] Add failing tests for two valid stop commands written before the app consumes either one.
- [x] Define and persist a versioned external timer-command queue.
- [x] Update widget, Live Activity, Watch, and routed producers to append commands.
- [x] Update consumers to claim and remove only the matching command after durable handling.
- [x] Migrate the legacy single-slot value and tolerate malformed legacy data safely.
- [x] Verify queue recovery after app termination between claim and acknowledgement.

## Acceptance criteria

- [x] Two pending commands for different timers are both retained and consumed.
- [x] Repeated delivery of one command creates one activity.
- [x] A stale command cannot stop a newer timer.
- [x] Consuming one command cannot delete another command.
- [x] Legacy pending stops remain consumable after upgrade.

## Implementation record

- Added the version 1 `externalTimerCommandQueue` App Group key and kept `pendingWidgetStop` as the migration source. The queue service validates commands, serializes React Native mutations, deduplicates command IDs, resolves legacy timer identities before handling, and removes commands by ID.
- Added the existing timer UUID to widget and Watch data. Watch-created UUIDs now pass through the phone providers and the Watch REST fallback. Widget intents persist before releasing the server lock. Routed widget links persist at the root before providers handle them. WCSession `transferUserInfo` remains the Watch-side durable queue before its REST fallback.
- Updated provider restoration, widget filtering, and the global stop consumer to match baby, activity, and timer UUID. A completed timer acknowledges a command left behind by termination without creating another activity. Pumping commands retain their volume payload.
- Migrates valid `pendingWidgetStop` JSON once, uses `selectedBabyId` or the active baby for older untargeted values, and clears malformed legacy JSON without changing valid queued commands.
- Live Activities have no Stop producer in the current UI. No new control was added. Routed command ingestion accepts the same metadata a future Live Activity Stop link would use.

### Decisions

- New commands use the persisted `timerInstanceId` UUID. Migrated commands use timestamp matching until they can be claimed against a restored UUID.
- This queue handles Stop commands only. Pause and resume keep the existing `pendingWidgetPauseToggle` path.
- Routed Stop actions are handled only by the root queue consumer. Activity screens no longer stop directly from `?action=stop`.
- Watch writes the typed command to durable `transferUserInfo` before any direct Supabase mutation, then the phone appends it idempotently to the App Group queue.

### Repository guidelines and review

- Implement references: `00-overview`, `01-style-and-code-quality`, `02-testing`, `06-code-health-and-maintainability`, and `10-definition-of-done`.
- Evidence: strict TypeScript and warning-free ESLint pass; Vitest, Jest provider integration, native source-order tests, and Swift parser checks pass; the old single-slot production API was removed after migration moved to the typed queue service.
- Task review used `base=main` with Standards, Spec, Bug, and Security lenses. One remediation pass cleared stale pause state during termination recovery and serialized native queue writes. The final pass had no unresolved findings or accepted security risks.
- README: updated the Timer Exclusivity section. The write-well audit took two passes; the second pass found no issue in the affected section.

### Verification

Baseline before implementation:

- `npm ci`
- `npm run typecheck`
- `npm run lint`
- `npm run test:component -- --runInBand src/__tests__/external-timer-stop-providers.integration.test.tsx`
- `npm run test:unit -- src/__tests__/native/widget-stop-intent-order.test.ts`

Final proof:

- `npm run test:unit`: 106 files, 2,251 tests passed.
- `npm run test:component -- --runInBand`: 50 suites, 638 tests passed.
- `npm run typecheck`
- `npm run lint`
- `xcrun swiftc -parse targets/widget/index.swift targets/widget/LiveActivity.swift`
- `xcrun swiftc -parse targets/watch/index.swift`
- No manual verification was required; provider integration tests exercise queue consumption and recovery, while native source-order tests and Swift parsing cover the extension producers.

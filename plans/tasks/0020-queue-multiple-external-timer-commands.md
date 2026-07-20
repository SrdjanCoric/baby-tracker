# Task 0020: Queue multiple external timer commands

**Branch**: `feature/queue-external-timer-commands`
**Depends on**: 0014, 0017
**Source**: release review conversation, July 2026 · **User stories**: widget, Live Activity, and Watch commands cannot overwrite each other before app launch; every matching timer command is consumed once

## What to build

Replace the single pending external-stop slot with a versioned command queue. Each command must identify its baby, activity type, timer instance, action, and event time. Producers append durably before remote mutation. Consumers remove only the command they handled and leave unrelated or newer commands intact.

Migrate a valid legacy `pendingWidgetStop` value into the new queue without duplicating or losing it. Preserve stale-command rejection and repeated-delivery idempotency.

## Software Repository Guidelines

**Applicable references**: `references/01-style-and-code-quality.md`, `references/02-testing.md`, `references/06-code-health-and-maintainability.md`, `references/10-definition-of-done.md`

- [ ] Keep one typed queue schema and compare-and-remove implementation across native and React providers.
- [ ] Test cold start, repeated delivery, multiple babies, multiple activity types, and migration without relying on timing.

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

- [ ] Add failing tests for two valid stop commands written before the app consumes either one.
- [ ] Define and persist a versioned external timer-command queue.
- [ ] Update widget, Live Activity, Watch, and routed producers to append commands.
- [ ] Update consumers to claim and remove only the matching command after durable handling.
- [ ] Migrate the legacy single-slot value and tolerate malformed legacy data safely.
- [ ] Verify queue recovery after app termination between claim and acknowledgement.

## Acceptance criteria

- [ ] Two pending commands for different timers are both retained and consumed.
- [ ] Repeated delivery of one command creates one activity.
- [ ] A stale command cannot stop a newer timer.
- [ ] Consuming one command cannot delete another command.
- [ ] Legacy pending stops remain consumable after upgrade.

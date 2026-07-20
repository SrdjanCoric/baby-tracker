# Task 0016: Deduplicate activity acknowledgements

**Branch**: `feature/deduplicate-activity-acknowledgements`
**Depends on**: 0014
**Source**: release review conversation, July 2026 · **User stories**: a local activity and its Realtime acknowledgement appear once; event ordering does not create a duplicate timeline item

## What to build

Make local activity-add actions idempotent by entity ID. If Supabase Realtime delivers an insert before the local create continuation dispatches its add action, the reducer must upsert the record rather than append a second copy. Apply the same rule to every Realtime-synced activity context that has local and remote insertion paths.

This task handles two in-memory copies of one entity ID. Task 0014 handles separate database rows created by repeated timer completion.

## Software Repository Guidelines

**Applicable references**: `references/01-style-and-code-quality.md`, `references/02-testing.md`, `references/06-code-health-and-maintainability.md`

- [ ] Use one shared, typed upsert rule instead of context-specific ordering workarounds.
- [ ] Add deterministic tests for both local-first and remote-first delivery.

## Before implementation

Run from the repository root and record the baseline.

```bash
git status --short --branch
npm ci
npm run typecheck
npm run lint
npm run test:component -- --runInBand
npm run test:sync
```

Stop for unrelated failures rather than weakening existing assertions.

## Implementation work

- [ ] Add failing reducer tests where `REMOTE_INSERT` arrives before the matching local add.
- [ ] Change local add handling to upsert by entity ID across synced activity contexts.
- [ ] Verify that updates retain the newest complete entity shape without changing list ordering unexpectedly.
- [ ] Add provider-level coverage for a fast Realtime acknowledgement during create.

## Acceptance criteria

- [ ] Remote-first and local-first acknowledgement order both produce one in-memory entity.
- [ ] Timeline and dashboard summaries do not count the same entity ID twice.
- [ ] Separate legitimate activities with different IDs remain separate.
- [ ] Reducer, provider, lint, and type-check suites pass.

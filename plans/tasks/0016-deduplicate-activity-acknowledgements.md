# Task 0016: Deduplicate activity acknowledgements

**Branch**: `feature/deduplicate-activity-acknowledgements`
**Depends on**: 0014
**Source**: release review conversation, July 2026 · **User stories**: a local activity and its Realtime acknowledgement appear once; event ordering does not create a duplicate timeline item

## What to build

Make local activity-add actions idempotent by entity ID. If Supabase Realtime delivers an insert before the local create continuation dispatches its add action, the reducer must upsert the record rather than append a second copy. Apply the same rule to every Realtime-synced activity context that has local and remote insertion paths.

This task handles two in-memory copies of one entity ID. Task 0014 handles separate database rows created by repeated timer completion.

## Software Repository Guidelines

**Applicable references**: `references/01-style-and-code-quality.md`, `references/02-testing.md`, `references/06-code-health-and-maintainability.md`

- [x] Use one shared, typed upsert rule instead of context-specific ordering workarounds.
- [x] Add deterministic tests for both local-first and remote-first delivery.

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

- [x] Add failing reducer tests where `REMOTE_INSERT` arrives before the matching local add.
- [x] Change local add handling to upsert by entity ID across synced activity contexts.
- [x] Verify that updates retain the newest complete entity shape without changing list ordering unexpectedly.
- [x] Add provider-level coverage for a fast Realtime acknowledgement during create.

## Acceptance criteria

- [x] Remote-first and local-first acknowledgement order both produce one in-memory entity.
- [x] Timeline and dashboard summaries do not count the same entity ID twice.
- [x] Separate legitimate activities with different IDs remain separate.
- [x] Reducer, provider, lint, and type-check suites pass.

## Completion record

### Implementation

- Feeding, sleep, diaper, pumping, growth, tummy-time, health, and milestone reducers now use the shared typed `upsertById` rule for local and Realtime insertion paths.
- The newest complete entity replaces an existing entity with the same ID in place, preserving list order. Different IDs still append as separate activities.
- Milestone responses retain their existing one-response-per-milestone rule while using ID-based upserts for matching acknowledgements.

### Decisions and obstacles

- No product, architecture, security, or database decision required a user checkpoint.
- The provider test initially rerendered indefinitely because its selected-baby test double returned a new object on every render. A stable test-boundary object fixed the loop without changing runtime behavior.
- The full unit suite exposed an isolated sleep reducer test that mocked the sync barrel without `upsertById`. The test now imports the production helper into that mock.

### Repository guidelines and review

- Implement-mode references: `00-overview.md`, `01-style-and-code-quality.md`, `02-testing.md`, and `06-code-health-and-maintainability.md`.
- Proof: all insertion paths use the existing shared typed helper; reducer and provider tests use fixed data and controlled boundaries; strict type checking and warning-free lint pass.
- Task review against `main` found no Standards, Spec, or Bug findings. Security was skipped because the diff does not change a trust boundary. Remediation passes: 0.

### Documentation

- Updated `README.md`, Real-Time Multi-Caregiver Sync, to describe ID-based acknowledgement upserts and ordering independence.
- `write-well` audit completed in one clean pass.

### Verification

- TDD RED and GREEN cycles were observed for remote-first local adds in feeding, sleep, diaper, pumping, growth, tummy-time, and health reducers, plus local-first diaper acknowledgement ordering. Milestone behavior was already idempotent by milestone and was retained while adopting the shared ID rule.
- `src/contexts/activity-reducers.component.test.tsx` covers both acknowledgement orders, every synced activity context, complete-entity replacement, stable ordering, and separate IDs.
- `src/__tests__/activity-acknowledgement.integration.test.tsx` proves a Realtime insert delivered before the create promise returns produces one provider activity.
- Baseline: `npm ci`, `npm run typecheck`, `npm run lint`, `npm run test:component -- --runInBand` (48 files, 608 tests), and `npm run test:sync` (20 files, 243 tests) passed.
- Final pre-review validation: `npm run test:unit` (101 files, 2,219 tests), `npm run test:component -- --runInBand` (50 files, 619 tests), `npm run typecheck`, and `npm run lint` passed.
- Final proof: `npm run test:all` (2,838 tests), `npm run typecheck`, `npm run lint`, and `git diff --check` passed.
- No manual verification was required because reducer and real-provider integration tests reproduce both event orders deterministically.

# Task 0052: Sweep adjacent native and sync regressions introduced after July 5

**Branch**: `feature/sweep-post-release-native-sync-regressions`
**Depends on**: 0051
**Source**: regression-planning conversation 2026-07-31 · **User stories**: the release owner can identify hidden post-July regressions in cross-device, offline, synchronization, and native integrations before prioritizing fixes; maintainers can assess high-risk changes without touching production state

## What to build

Perform a bounded, risk-based differential audit of post-July 5 changes across synchronization and native integration boundaries, building on the reported-issue diagnoses and app regression matrix. Cover timer identity and completion, active-timer locking, offline queue durability, foreground push-before-pull behavior, CRDT merge and tombstones, Realtime/range acknowledgement, WatchConnectivity and direct Watch fallback, widgets, Live Activities and Dynamic Island, native date selection, notification-facing state, authentication/household restoration boundaries, and the application contracts affected by post-baseline migrations and Edge Functions.

Use only local Supabase, synthetic accounts, controlled network interruption, simulators, and explicitly approved physical-device verification. Never run mutation tests against production, copy production tokens, import production active locks, reverse production migrations, or treat a schema difference alone as a defect. Compare with the July 5 deployed source `cdbbb1e8cced61c52bc78ca4eb4531e90647218e` where compatible; otherwise compare with the approved post-July task contract and record why a historical binary or schema cannot be exercised safely.

Produce a consolidated, privacy-safe native/sync regression matrix. Map every scoped post-baseline high-risk change to existing automated proof, newly executed local evidence, manual device evidence, a justified deferral, or a reproducible finding. Stress idempotency, interruption, retry, restart, stale acknowledgement, multiple caregiver/device ordering, cleanup, and failure recovery rather than checking only happy paths. Every finding must include severity, data-loss/security impact, minimal reproduction, expected basis, likely introduction range, and a recommended next task. Do not fix defects in this task.

## Software Repository Guidelines

**Applicable references**: `references/02-testing.md`, `references/03-documentation.md`, `references/07-security.md`, `references/10-definition-of-done.md`

- [ ] Exercise integration boundaries with deterministic local fixtures, controlled failures, real assertions, and explicit cleanup; cover retry, restart, concurrency, idempotency, and failure paths.
- [ ] Document the capability map, baseline or contract basis, commands, evidence, device limitations, findings, deferrals, and follow-up boundaries without credentials or personal data.
- [ ] Keep all mutation and trust-boundary testing local, use synthetic credentials, fail closed on non-local endpoints, and require user approval for physical-device or security-boundary verification.
- [ ] Leave repeatable root commands and evidence sufficient for a fresh contributor to assess each non-deferred native/sync finding.

## Implementation work

- [ ] Build a capability-level inventory of synchronization, migration, Edge Function, widget, Live Activity, Watch, native date, notification, auth-restoration, and timer changes after the July 5 baseline.
- [ ] Incorporate the identity traces, causal evidence, and discarded hypotheses from Tasks 0048 and 0049 plus relevant findings from Task 0051.
- [ ] Rank boundaries by credible data loss, duplicate completion, authorization failure, stale cross-device state, unrecoverable offline work, native cleanup failure, and weak device coverage.
- [ ] Define expected behavior from July 5 where safely comparable or from approved post-July task and migration contracts where the capability is intentionally new.
- [ ] Run existing and targeted local unit, integration, SQL-vector, security, interruption, and multi-caregiver checks, adding temporary stress harnesses where needed to raise intermittent reproduction rates.
- [ ] Exercise queue retry/restart, push-before-pull, stale Realtime/range acknowledgement, tombstone visibility, timer completion/cleanup, and multiple-device ordering with synthetic local data.
- [ ] Validate native bridges and app-extension contracts on supported simulators, then request only the physical Watch/iPhone verification that cannot be automated.
- [ ] Review post-baseline schema and Edge contracts against current app callers using local migrations; do not alter or probe production state beyond already approved read-only schema evidence.
- [ ] Record every scoped capability as covered, newly exercised, manually verified, deferred with rationale, or a reproducible finding with severity and risk.
- [ ] Publish the matrix, remove temporary instrumentation and stress artifacts, verify cleanup, and run canonical test, security, SQL, native-contract, and documentation checks.

## Human checkpoints

- [ ] [confirm-security] Review any proposed auth, authorization, token-routing, invitation, Edge Function, or native trust-boundary test before it runs; all credentials and endpoints must be synthetic and local.
- [ ] [verify] Execute the documented physical iPhone/Watch checks for critical/high findings that cannot be reproduced on simulators · Expected: device state, cleanup, retry, and convergence match the matrix · Failure: a finding cannot be reproduced, leaves stale native/timer state, or requires production mutation · Reason: WatchConnectivity, Dynamic Island, extension, and APNs-adjacent behavior cannot be fully proved in local JavaScript or simulator tests.

## Acceptance criteria

- [ ] Every scoped high-risk post-July native/sync capability is mapped to its change source and classified as covered, exercised, manually verified, deferred, or a finding.
- [ ] Happy, interruption, retry, restart, concurrency/idempotency, stale acknowledgement, and cleanup behavior receive evidence proportional to their risk.
- [ ] Intentional post-July capabilities are judged against approved contracts rather than automatically treated as regressions.
- [ ] Every finding includes severity, data-loss/security impact, minimal reproduction, expected basis, likely introduction range, and recommended follow-up boundary.
- [ ] No mutation test targets production, no production token or active lock is copied, no production migration is reversed, and all temporary instrumentation is removed.
- [ ] The release owner reviews critical/high physical-device findings before concrete fix tasks are planned.

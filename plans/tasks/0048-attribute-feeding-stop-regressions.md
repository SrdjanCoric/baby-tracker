# Task 0048: Attribute feeding stop, Timeline, and Live Activity regressions

**Branch**: `feature/attribute-feeding-stop-regressions`
**Depends on**: 0047
**Source**: regression-planning conversation 2026-07-31 · **User stories**: a caregiver stopping one feeding sees one completed activity and no continuing Dynamic Island timer; maintainers know whether the observed stopping, duplicate presentation, deletion, and native cleanup failures share a post-July 5 cause

## What to build

Diagnose one phone-originated feeding timer completion end to end on the July 5 deployed source `cdbbb1e8cced61c52bc78ca4eb4531e90647218e` and the current implementation at audit start. Reproduce the reported sequence: Stop enters a visible Stopping state, one logical feeding appears twice in Timeline, deleting either presentation removes both, and the Dynamic Island Live Activity remains active.

Use the imported household only as historical context; create a fresh local timer for every run and never import or reuse production active timer locks. Trace one stable timer/completion identity through provider state, stop coordination, local storage, sync queue, local database, Realtime acknowledgement, Timeline projection, lock release, and native Live Activity cleanup. Record IDs and counts in redacted diagnostic output so the audit can prove whether duplicate UI rows represent one ID, duplicated client state, or multiple durable records. Exercise completion ordering and failure paths sufficiently to distinguish one shared race from independent defects.

Construct a repeatable simulator/integration feedback loop first, then use an iPhone or supported Dynamic Island simulator for the native boundary. Compare baseline/current behavior and use bounded commit bisection or targeted differential tests to identify causal post-July 5 changes where possible. Produce diagnosis and future regression-test requirements only; do not fix stop behavior in this task.

## Software Repository Guidelines

**Applicable references**: `references/02-testing.md`, `references/03-documentation.md`, `references/07-security.md`, `references/10-definition-of-done.md`

- [ ] Exercise the real provider, durable local queue/storage, local Supabase, Timeline projection, and native cleanup boundary with deterministic identities and controlled failure ordering.
- [ ] Document the exact reproduction, identity trace, baseline/current result, causal evidence, cleanup, and recommended regression seam without including household personal data.
- [ ] Use local services and fixtures only, avoid logging auth tokens, and prove test timers and locks are cleaned on pass, failure, and interruption.

## Implementation work

- [ ] Prepare isolated July 5 and current builds against equivalent local household fixture state and verify neither targets production endpoints.
- [ ] Build the fastest deterministic provider-level loop that stops a feeding while controlling local save, sync acknowledgement, range pull, and Realtime ordering.
- [ ] Reproduce the complete reported UI/native sequence before testing causes and capture one redacted identity trace across every boundary.
- [ ] Query local storage and local Supabase to prove the durable row count and IDs independently from Timeline presentation.
- [ ] Trace Timeline collection inputs, grouping, keys, and deletion dispatch to explain why deleting one visible copy removes both.
- [ ] Trace Stopping state entry/exit and all error/finally paths to determine whether the UI is transient, stuck, or superseded by another state transition.
- [ ] Trace Live Activity IDs and fallback-by-type cleanup, including native success/failure results and activity state after durable completion.
- [ ] Test post-July 5 timer completion, acknowledgement, range-loading, and stop-progress changes as ranked falsifiable candidates, using bounded bisection when a repeatable loop exists.
- [ ] Classify each symptom separately and state whether the symptoms share a cause or require separate future fix tasks.
- [ ] Remove temporary instrumentation, publish a redacted diagnosis, and run focused provider, sync, Timeline, native-contract, and canonical checks.

## Human checkpoints

- [ ] [verify] On a supported iPhone or Dynamic Island simulator, start one fresh local feeding timer, run the documented stop sequence on July 5 and current builds, inspect Timeline, delete the visible completion, and inspect Dynamic Island · Expected: observations and identity counts match the audit report · Failure: the sequence differs, the timer cannot be reproduced, or native activity state is ambiguous · Reason: Dynamic Island lifecycle and historical native builds cannot be proved completely in JavaScript tests.

## Acceptance criteria

- [ ] The complete reported stop sequence is reproducible or every non-reproducing symptom names the exact missing condition or evidence.
- [ ] One timer/completion identity is traced across provider state, local persistence, queue, local database, Realtime/range acknowledgement, Timeline, lock, and Live Activity cleanup.
- [ ] The audit proves whether the two Timeline presentations share an ID and whether local/database persistence contains one or multiple logical rows.
- [ ] Each symptom has baseline/current evidence and an evidence-backed regression classification and causal commit when determinable.
- [ ] Shared versus independent causes are stated explicitly, with precise future regression seams and acceptance behavior.
- [ ] Fresh local timers and locks are cleaned, temporary instrumentation is removed, and no production service or personal snapshot content is used in tracked evidence.

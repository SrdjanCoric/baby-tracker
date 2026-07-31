# Task 0047: Discover and confirm all post-July 5 regressions before fixes

**Branch**: `feature/discover-post-july-regressions`
**Depends on**: 0046
**Source**: regression-planning conversation 2026-07-31 · **User stories**: the release owner can review every credible behavior regression introduced after the July 5 deployment before any fix begins; every confirmed bug becomes an independently prioritized task; intentional new behavior is not mistaken for a defect

## What to build

Perform a comprehensive changed-capability regression audit between the July 5 deployed source `cdbbb1e8cced61c52bc78ca4eb4531e90647218e` and the current implementation at audit start. Use the isolated, production-derived local fixtures from Task 0046 to compare equivalent household data while keeping both versions off production. Cover all changed product, persistence, synchronization, native, extension, authentication, onboarding, database-contract, Edge Function, testing, build, and release capabilities—not only issues already reported by the user.

Start with a complete inventory of post-baseline commits, merged tasks, changed capabilities, intended behavior, tests, migrations, and external/native boundaries. Differences are candidates, not automatically bugs: behavior intentionally added after July 5 must be judged against its approved task or product contract. Rank every changed capability by user impact, data-loss or duplication risk, authorization/security impact, cross-device or offline complexity, change density, and weakness of existing proof. Exercise each capability through the cheapest reliable differential feedback loop, escalating from pure/unit comparisons to real providers, local Supabase, controlled interruption, simulators, and physical iPhone/Watch verification only when required.

The audit must include the reported candidates: invalid Home relative ages despite valid database dates; card behavior after Timeline deletion; one feeding appearing twice while sharing one logical deletion; feeding Stop remaining in Stopping while Dynamic Island continues; Watch-started timers not converging when stopped on iPhone; Watch displaying hundreds of hours; incomplete current sleep days affecting averages; and incorrect Past 7 Days average bedtime. It must also actively search adjacent post-July changes for credible unreported regressions.

For every potential regression, prepare a privacy-safe evidence packet containing the affected capability, exact current reproduction, July 5 or approved-contract expectation, production-derived fixture conditions in anonymized form, severity and data/security risk, candidate introduction range, and one focused manual verification procedure. Present candidates to the user one at a time. Record the user's result as confirmed bug, intended behavior, not reproduced, or unresolved. A confirmed bug must be added through `to-plan` as its own smallest independently verifiable task, dependent on Task 0047, before the audit moves to implementation. Rejected candidates retain the user's reason; unresolved candidates retain the missing evidence and continue to block audit completion unless the user explicitly defers them.

Do not fix application behavior during this task. Temporary instrumentation and throwaway harnesses must be removed or preserved only as clearly marked privacy-safe diagnostic tools. Raw production data, source account identifiers, credentials, tokens, and private device logs must never be committed. The task is complete only when every changed capability has an explicit audit disposition, every candidate has a user disposition, every confirmed bug has an approved task, and the release owner confirms the bug inventory is ready for prioritization. Only then may fix tasks begin.

## Software Repository Guidelines

**Applicable references**: `references/01-style-and-code-quality.md`, `references/02-testing.md`, `references/03-documentation.md`, `references/07-security.md`, `references/10-definition-of-done.md`

- [ ] Use deterministic, isolated differential checks with real assertions and explicit expected contracts; fix flaky feedback loops rather than retrying or dismissing them. Run only candidate-focused device/E2E flows during the audit, retain complete non-device CI, and leave broad E2E suites for the pre-deployment release gate.
- [ ] Keep any committed audit tooling linted, strictly typed, conventionally named, and free of broad suppressions or production-data assumptions.
- [ ] Publish a navigable capability matrix, commands, evidence summaries, user dispositions, deferrals, and confirmed-bug task links sufficient for a fresh contributor to continue without rediscovery.
- [ ] Keep all mutation, auth, sync, migration, and native tests on isolated local services with synthetic credentials; fail closed on production endpoints and redact personal data and secrets.
- [ ] Leave the repository able to reproduce each confirmed or unresolved candidate through documented commands and to identify the approved task that owns every confirmed fix.

## Implementation work

- [ ] Record the immutable comparison boundary: July 5 deployed commit, audit-start current commit, matching dependencies, local schema versions, simulator/device versions, timezone, locale, and fixture manifests.
- [ ] Build a capability-level inventory of every commit and merged task after July 5, mapping changed files to user-visible behavior, persistence, sync, native/extensions, auth/onboarding, schema/Edge contracts, and release behavior.
- [ ] Recover the intended contract for each intentional post-July capability from its task, tests, migrations, and documentation so new features are not mislabeled as regressions.
- [ ] Define a finite risk-ranked audit matrix and mark every capability as pending until it has executable evidence, justified static review, an explicit user deferral, or coverage by another matrix row.
- [ ] Build isolated current and July 5 comparison loops over equivalent common fixture data, preventing either build from sharing local storage, auth state, queues, ports, or database mutations.
- [ ] Reproduce each user-reported candidate first and trace it to the smallest boundary that still differs, including stored IDs/timestamps, context state, UI projection, native state, and calculation inputs as applicable.
- [ ] Test ranked causal commits with one variable at a time and use automated bisection when a fast deterministic loop exists; record discarded hypotheses to prevent repeated work.
- [ ] Sweep adjacent callers, sibling providers, shared formatters, reducers, range loaders, native bridges, and schema contracts whenever a cause could affect more than the reported symptom.
- [ ] Exercise high-risk happy, repeat, failure, interruption, restart, retry, cancellation, concurrency/idempotency, offline, stale-acknowledgement, and cleanup behavior proportional to each capability's risk.
- [ ] Use local SQL and redacted identity traces to distinguish duplicated UI state from duplicated durable data and incorrect calculations from incorrect stored records.
- [ ] For every candidate, create a concise evidence packet and ask the user to run the exact manual verification one candidate at a time before recording its disposition.
- [ ] Invoke `to-plan` for every user-confirmed bug, obtain approval for the smallest fix-task breakdown, append the approved task pointer dependent on 0047, and do not implement it during the audit.
- [ ] Record intended/not-bug decisions with the user's reason and unresolved/deferred candidates with the exact missing evidence, owner, and risk.
- [ ] Remove temporary instrumentation and raw artifacts, scan tracked changes for PII/secrets, and run complete non-device code, test, security, SQL, native-contract, and documentation checks plus only the focused device/E2E flows needed by individual candidates; do not run broad release E2E suites.
- [ ] Present the complete matrix and confirmed task inventory to the release owner for final approval before marking the audit complete.

## Human checkpoints

- [ ] [confirm-security] Approve the differential environments and any auth, authorization, migration, Edge Function, token-routing, native bridge, or physical-device test before it runs; all mutable endpoints and credentials must be synthetic and local.
- [ ] [verify] For each potential regression, execute the candidate-specific steps supplied by the audit on the appropriate simulator or device and classify it as confirmed bug, intended behavior, not reproduced, or unresolved · Expected: every candidate receives an explicit user disposition backed by observable behavior · Failure: a candidate is silently accepted/rejected, lacks repeatable steps, or relies only on code inspection · Reason: product intent and physical-device behavior require release-owner judgment.
- [ ] [decision] Approve each confirmed bug's separately proposed `to-plan` task boundary and priority before its task file is written.
- [ ] [verify] Review the final changed-capability matrix and confirmed-bug task inventory · Expected: every post-July changed capability and every reported or newly discovered candidate has an explicit disposition, and the owner agrees fixes may begin · Failure: an unassessed capability, unresolved candidate without explicit deferral, missing confirmed-bug task, or unsupported regression claim remains · Reason: the release owner requested a complete bug-discovery gate before implementation.

## Acceptance criteria

- [ ] The comparison uses the exact July 5 deployed source and a recorded current source against isolated, equivalent local fixture data with no production runtime dependency.
- [ ] Every post-July changed capability is mapped to its intended contract and classified as executable evidence, justified static review, explicit deferral, or a candidate finding.
- [ ] Every user-reported issue is reproduced and attributed, or remains unresolved with the precise missing evidence and user-approved disposition.
- [ ] The audit actively checks adjacent shared code and high-risk failure modes and records credible unreported candidates rather than limiting itself to the original list.
- [ ] Every potential regression is presented to the user individually with repeatable steps and receives a recorded confirmed, intended, not-reproduced, or unresolved disposition.
- [ ] Every confirmed bug has an approved, independently verifiable task dependent on 0047 before any fix begins.
- [ ] Intentional post-July behavior is evaluated against its approved contract and is not automatically labeled a regression because it differs from July 5.
- [ ] The final matrix contains source boundaries, evidence, severity, causal commit or introduction range, discarded hypotheses, user dispositions, deferrals, and links to confirmed-bug tasks.
- [ ] No product fix, production mutation, raw production data, source account identifier, credential, token, private device log, or temporary instrumentation is committed.
- [ ] Audit and later bug PR evidence uses permanent focused regression tests and candidate-specific device flows; comprehensive E2E remains reserved for the pre-deployment release gate.
- [ ] The release owner explicitly confirms that the inventory is complete enough to prioritize and begin fix tasks.

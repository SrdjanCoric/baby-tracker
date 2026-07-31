# Task 0049: Attribute Watch timer and history regressions

**Branch**: `feature/attribute-watch-regressions`
**Depends on**: 0047
**Source**: regression-planning conversation 2026-07-31 · **User stories**: a caregiver can start a timer on Apple Watch and stop it from iPhone with both devices converging; Watch history uses useful age units instead of hundreds of hours; maintainers know which behavior regressed after July 5

## What to build

Diagnose Apple Watch activity synchronization and historical-age presentation on the July 5 deployed source `cdbbb1e8cced61c52bc78ca4eb4531e90647218e` and the current implementation at audit start. Reproduce a timer started on Watch and stopped in the iPhone app, then determine exactly how Watch local optimistic state, phone provider state, active timer locks, completion state, WatchConnectivity messages, direct Supabase fallback, and refreshed watch data fail to converge or dismiss gracefully.

Separately reproduce Watch history displaying a large hour count such as `959h ago`. Compare the formatter and its call sites with July 5 behavior to classify the requested transition to days at 96 hours as a regression or a product enhancement. Use fixed dates to inventory all Watch surfaces that render the same age and expose inconsistent formatting.

All activity generation and synchronization must use local Supabase and dedicated fixtures. Build a repeatable paired Watch/iPhone feedback loop, capture redacted state transitions and message identities, compare baseline/current behavior, and identify the first causal post-July 5 commit where technically determinable. Produce diagnosis and future acceptance tests only; do not fix Watch or phone behavior in this task.

## Software Repository Guidelines

**Applicable references**: `references/02-testing.md`, `references/03-documentation.md`, `references/07-security.md`, `references/10-definition-of-done.md`

- [ ] Exercise WatchConnectivity and direct-local-Supabase fallback with controlled fixtures, fixed timestamps, real assertions, cleanup, and repeatable paired-device steps.
- [ ] Document baseline/current state transitions, formatter outputs, causal evidence, unavailable physical-device evidence, and future regression seams in privacy-safe form.
- [ ] Keep Watch credentials synthetic and local, never copy production tokens or active locks, and remove temporary native instrumentation before completion.

## Implementation work

- [ ] Establish paired July 5 and current iPhone/Watch builds with synthetic local authentication and equivalent imported historical data.
- [ ] Create a fresh local timer on Watch, stop it from iPhone, and capture the phone, Watch, lock, completion, and database state before and after every message or refresh boundary.
- [ ] Exercise both reachable-phone WatchConnectivity and unreachable-phone/direct-local-Supabase paths when supported by the existing implementation.
- [ ] Determine what remains visible after phone stop: an active timer, stale optimistic timer, stopped confirmation, stale server timer, or another state.
- [ ] Reproduce large-hour history labels with fixed 95-hour, 96-hour, multi-day, and 959-hour timestamps and inventory every Watch call site using the formatter.
- [ ] Compare July 5/current native code and behavior, rank post-July 5 Watch targeting, timer command, completion, and synchronization changes, and use bounded bisection where the paired loop permits it.
- [ ] Classify cross-device stop and historical formatting independently as regression, pre-existing defect, enhancement, data-specific behavior, or unresolved.
- [ ] State whether later fixes should be independent or ordered and define their automated/native/manual proof requirements.
- [ ] Remove temporary instrumentation, publish a redacted diagnosis, and run available Watch source, packaging, integration, and canonical checks.

## Human checkpoints

**Manual device policy**: The agent may prepare, build, and launch iOS, Watch, or Android simulators, but must not execute Maestro or other E2E interactions or assertions. The release owner performs and classifies every device/E2E scenario.

- [ ] [verify] Pair a supported Apple Watch with the iPhone test build, start a fresh timer on Watch, stop it on iPhone, and inspect both devices plus a fixed 959-hour historical entry on July 5 and current builds · Expected: the observed convergence and age labels match the audit's state trace and classification · Failure: device state differs from the trace, fallback path is unknown, or historical output cannot be reproduced · Reason: real WatchConnectivity scheduling and watchOS presentation require paired-device confirmation.

## Acceptance criteria

- [ ] Watch-started/phone-stopped behavior has a complete, redacted state and message trace on current code and a baseline comparison or explicit historical-build limitation.
- [ ] The audit identifies what stale state remains and at which synchronization boundary convergence fails.
- [ ] Historical-age outputs are recorded at 95 hours, 96 hours, multiple days, and 959 hours across every affected Watch surface.
- [ ] Each symptom has an evidence-backed classification and first causal commit when technically determinable.
- [ ] Future fix ordering, regression seams, device proof, and cleanup requirements are explicit.
- [ ] No production token, production active lock, personal snapshot row, or temporary native instrumentation remains in tracked files.

# Task 0010: Enforce a warning-free production quality gate

**Branch**: `feature/warning-free-quality-gate`
**Depends on**: 0006, 0007, 0008, 0009
**Source**: production bug hunt 2026-07-14 · **User stories**: maintainers can trust lint and test output to highlight new defects instead of hiding them among an existing warning backlog

## What to build

Resolve the remaining repository lint warning backlog and make warnings fail the canonical lint command and CI. Remove dead imports, variables, arguments, and dependencies where safe; correct unstable hook values rather than suppressing them; and preserve intentional public extension points explicitly. Do not alter product behavior solely to satisfy tooling.

## Software Repository Guidelines

**Applicable references**: `references/01-style-and-code-quality.md`, `references/02-testing.md`, `references/05-ci-cd.md`, `references/06-code-health-and-maintainability.md`, `references/10-definition-of-done.md`

- [x] Lint violations, including warnings, fail locally and in CI.
- [x] Unused/dead code detection covers production and test TypeScript with narrow explicit exclusions.
- [x] Canonical validation commands remain documented and executable from the repository root.

## AFK tasks

- [x] Capture the post-0006–0009 warning inventory and classify every warning as a defect, dead code, unstable construction, or intentional extension point.
- [x] Resolve all actionable warnings without broad disables or behavior-changing workarounds.
- [x] Configure the canonical lint command and CI job with a zero-warning budget.
- [x] Run the complete unit, component, security, typecheck, and lint suites and fix regressions found.

## Acceptance criteria

- [x] `npm run lint` exits non-zero for any warning and passes with zero warnings on the completed tree.
- [x] No broad lint suppression is added.
- [x] Dead imports, variables, dependencies, and unreachable branches identified by the current analyzer are removed or narrowly justified.
- [x] Typecheck and all automated test suites pass.
- [x] CI uses the same warning-free lint contract as local development.

## Implementation log

- Classified the 64-warning baseline as 42 dead/unused symbols, 21 redundant or stale hook dependencies, and one obsolete lint suppression; removed each warning without adding disables.
- Removed dead local code while preserving intentionally supported component props and function parameters, and made dashboard time-derived values consume the live refresh timestamp directly.
- Set both lint scripts to `--max-warnings=0`; CI already invokes the canonical `npm run lint`, and the README now documents that warnings fail the gate.
- Review: no blocker, major, minor, or security findings. The security lens ran because the diff touches auth and CI-adjacent code; the changes only remove an unused auth response binding and tighten the existing lint command.
- Guidelines review loaded references 00, 01, 02, 03, 05, 06, 08, and 10; current-task lint, testing, documentation, CI, code-health, canonical-command, and definition-of-done requirements are satisfied by the committed configuration and validation evidence.
- Verification: `npm run lint` (zero warnings); synthetic warning-budget proof (one warning exits 1); `npm run typecheck`; `npm run test:unit` (98 files, 2,208 tests); `npm run test:component -- --runInBand` (44 suites, 547 tests); `npm run test:security` (8 files, 87 tests); `git diff --check`.

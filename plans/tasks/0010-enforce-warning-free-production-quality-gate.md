# Task 0010: Enforce a warning-free production quality gate

**Branch**: `feature/warning-free-quality-gate`
**Depends on**: 0006, 0007, 0008, 0009
**Source**: production bug hunt 2026-07-14 · **User stories**: maintainers can trust lint and test output to highlight new defects instead of hiding them among an existing warning backlog

## What to build

Resolve the remaining repository lint warning backlog and make warnings fail the canonical lint command and CI. Remove dead imports, variables, arguments, and dependencies where safe; correct unstable hook values rather than suppressing them; and preserve intentional public extension points explicitly. Do not alter product behavior solely to satisfy tooling.

## Software Repository Guidelines

**Applicable references**: `references/01-style-and-code-quality.md`, `references/02-testing.md`, `references/05-ci-cd.md`, `references/06-code-health-and-maintainability.md`, `references/10-definition-of-done.md`

- [ ] Lint violations, including warnings, fail locally and in CI.
- [ ] Unused/dead code detection covers production and test TypeScript with narrow explicit exclusions.
- [ ] Canonical validation commands remain documented and executable from the repository root.

## AFK tasks

- [ ] Capture the post-0006–0009 warning inventory and classify every warning as a defect, dead code, unstable construction, or intentional extension point.
- [ ] Resolve all actionable warnings without broad disables or behavior-changing workarounds.
- [ ] Configure the canonical lint command and CI job with a zero-warning budget.
- [ ] Run the complete unit, component, security, typecheck, and lint suites and fix regressions found.

## Acceptance criteria

- [ ] `npm run lint` exits non-zero for any warning and passes with zero warnings on the completed tree.
- [ ] No broad lint suppression is added.
- [ ] Dead imports, variables, dependencies, and unreachable branches identified by the current analyzer are removed or narrowly justified.
- [ ] Typecheck and all automated test suites pass.
- [ ] CI uses the same warning-free lint contract as local development.

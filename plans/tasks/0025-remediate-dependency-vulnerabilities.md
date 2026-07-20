# Task 0025: Remediate dependency vulnerabilities

**Branch**: `feature/remediate-dependency-vulnerabilities`
**Depends on**: 0022
**Source**: release review conversation, July 2026 · **User stories**: shipped and build dependencies have no unreviewed critical or high advisories; future vulnerable changes are visible in CI

## What to build

Triage the critical and high advisories reported by the release-review `npm audit`. Identify whether each path is shipped runtime code, build tooling, development-only tooling, or unreachable transitive code. Apply compatible upgrades, overrides, or package removal where supported. Do not force an Expo SDK major upgrade without a separate approved decision.

Establish a CI dependency check with a documented process for temporary, narrowly scoped exceptions. Record package path, exposure, upstream status, expiry, and owner for any accepted advisory. Add scheduled dependency update automation at a cadence that the existing CI can validate.

## Software Repository Guidelines

**Applicable references**: `references/02-testing.md`, `references/04-developer-environment.md`, `references/05-ci-cd.md`, `references/06-code-health-and-maintainability.md`, `references/07-security.md`, `references/10-definition-of-done.md`

- [ ] Review dependency changes deliberately, keep the lock file reproducible, and validate mobile builds and tests.
- [ ] Make high-severity findings fail CI or enter a documented remediation process with an expiry.

## Before implementation

Capture the locked dependency and security baseline before changing package metadata.

```bash
git status --short --branch
npm ci
npm audit --audit-level=high || true
npm outdated || true
npx expo-doctor
npm run typecheck
npm run lint
```

Save the full dependency paths for critical and high findings. Do not run `npm audit fix --force` or apply an Expo SDK major upgrade without the checkpoints below.

## Implementation work

- [ ] Capture the current audit report and dependency paths from a clean locked install.
- [ ] Classify runtime, build-time, development-only, exploitable, and non-exploitable exposure with evidence.
- [ ] Apply supported non-breaking updates or overrides and run Expo compatibility checks.
- [ ] Escalate any required major SDK upgrade through `talk-it-through` rather than applying it implicitly.
- [ ] Add CI dependency auditing and scheduled update pull requests.
- [ ] Document any temporary exception with scope, reason, upstream reference, owner, and expiry.

## Human checkpoints

- [ ] [confirm-security] Approve dependency trust changes and every temporary critical or high advisory exception before merge.

## Acceptance criteria

- [ ] No critical or high advisory remains unremediated or undocumented with explicit approval.
- [ ] Dependency installation remains locked and reproducible.
- [ ] Type checking, lint, all automated tests, Expo compatibility checks, and an iOS build pass.
- [ ] CI reports future high-severity dependency findings and scheduled updates receive normal validation.

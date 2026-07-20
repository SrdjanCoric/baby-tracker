# Task 0022: Run complete non-device checks in pull-request CI

**Branch**: `feature/complete-pr-ci`
**Depends on**: 0017
**Source**: release review conversation, July 2026 · **User stories**: pull requests cannot merge after passing only a subset of the repository tests; local database contracts are checked in controlled CI

## What to build

Expand pull-request CI to run the repository's maintained non-device checks from a clean checkout. Include lint, strict type checking, unit tests, component tests, security tests, sync tests, and SQL vectors against CI-owned local Supabase. Group jobs for useful failure reporting without weakening reproducibility.

Do not add simulator E2E to this workflow. Task 0023 owns iOS E2E execution.

## Software Repository Guidelines

**Applicable references**: `references/02-testing.md`, `references/04-developer-environment.md`, `references/05-ci-cd.md`, `references/08-recommended-canonical-commands.md`, `references/10-definition-of-done.md`

- [ ] Make CI use the same locked dependencies, scripts, migrations, and local services documented for contributors.
- [ ] Ensure every required job fails correctly and stores useful test output where supported.

## Before implementation

Run the complete current non-device baseline locally and record duration and failures.

```bash
git status --short --branch
npm ci
npm run lint
npm run typecheck
npm run test:unit
npm run test:component -- --runInBand
npm run test:security
npm run test:sync
docker info
npx supabase start
npx supabase status
npm run test:sql
```

Confirm SQL tests use `127.0.0.1:54322`. Do not use production or a linked Supabase project to make the workflow pass.

## Implementation work

- [ ] Add or correct a canonical non-device validation command without hiding individual suite failures.
- [ ] Provision local Supabase and apply migrations in the jobs that require SQL.
- [ ] Run component, security, sync, and SQL suites on pull requests and `main`.
- [ ] Pin important CI tool versions instead of downloading an unconstrained latest version.
- [ ] Add a controlled failure proof for each new required job.
- [ ] Update testing documentation and required-check guidance.

## Acceptance criteria

- [ ] Every maintained non-device suite runs on pull requests from a clean checkout.
- [ ] A failure in any suite fails its CI job and blocks the aggregate result.
- [ ] SQL tests connect only to the CI-owned local Supabase instance.
- [ ] The final pull request passes every new job without retries masking a flaky test.

# Task 0022: Run complete non-device checks in pull-request CI

**Branch**: `feature/complete-pr-ci`
**Depends on**: 0017
**Source**: release review conversation, July 2026 · **User stories**: pull requests cannot merge after passing only a subset of the repository tests; local database contracts are checked in controlled CI

## What to build

Expand pull-request CI to run the repository's maintained non-device checks from a clean checkout. Include lint, strict type checking, unit tests, component tests, security tests, sync tests, and SQL vectors against CI-owned local Supabase. Group jobs for useful failure reporting without weakening reproducibility.

Do not add simulator E2E to this workflow. Task 0023 owns iOS E2E execution.

## Software Repository Guidelines

**Applicable references**: `references/02-testing.md`, `references/04-developer-environment.md`, `references/05-ci-cd.md`, `references/08-recommended-canonical-commands.md`, `references/10-definition-of-done.md`

- [x] Make CI use the same locked dependencies, scripts, migrations, and local services documented for contributors.
- [x] Ensure every required job fails correctly and stores useful test output where supported.

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

- [x] Add or correct a canonical non-device validation command without hiding individual suite failures.
- [x] Provision local Supabase and apply migrations in the jobs that require SQL.
- [x] Run component, security, sync, and SQL suites on pull requests and `main`.
- [x] Pin important CI tool versions instead of downloading an unconstrained latest version.
- [x] Add a controlled failure proof for each new required job.
- [x] Update testing documentation and required-check guidance.

## Acceptance criteria

- [x] Every maintained non-device suite runs on pull requests from a clean checkout.
- [x] A failure in any suite fails its CI job and blocks the aggregate result.
- [x] SQL tests connect only to the CI-owned local Supabase instance.
- [ ] The final pull request passes every new job without retries masking a flaky test.

## Implementation record

- Baseline on 2026-07-22 passed after `npm ci`: lint 45s, typecheck 12s, unit 3s, component 29s, security under 1s, sync 1s, Supabase start 5s, and SQL 2s. SQL used `127.0.0.1:54322`.
- `.github/workflows/test.yml` now has separate quality, unit, component, security, sync, and SQL jobs plus `Non-device checks required`. Test jobs retain seven-day log artifacts, and `set -o pipefail` preserves suite failures through `tee`.
- `package.json` exposes `npm run check`, `npm run check:code`, and `npm run test:ci`. `.nvmrc` pins Node 20.19.4, package metadata pins npm 10.8.2, and the lockfile pins Supabase CLI 2.109.1.
- SQL CI resets an unlinked local Supabase instance, applies all committed migrations with `scripts/apply-migrations.mjs`, and fixes `SUPABASE_DB_URL` to `postgresql://postgres:postgres@127.0.0.1:54322/postgres`.
- Red-green cycles covered the aggregate success path, missing results, each required job failure, complete workflow coverage, pinned tools, retained output, and the canonical command contract. Proof is in `scripts/ci-workflow.test.mjs`, `scripts/package-scripts.test.mjs`, and `scripts/require-successful-jobs.test.mjs`.
- Repository guidelines loaded: `00-overview`, `02-testing`, `04-developer-environment`, `05-ci-cd`, `08-recommended-canonical-commands`, and `10-definition-of-done`. Proof covers locked installation and pinned tools. It also covers root commands, clean-checkout jobs, local service provisioning, failure artifacts, and the aggregate required check.
- Task review used `base=main` with Standards, Spec, Bug, and Security lenses. One remediation pass put the contract tests in CI and pinned Node in the aggregate job. It also aligned npm with Node 20.19.4 and completed contributor guidance. The second pass had no findings. No security risks were found or accepted.
- `README.md` documents the pinned setup and canonical checks in its development and testing sections. It also identifies the loopback SQL database, retained artifacts, and required branch-protection check. The write audit took two passes; the first split one overloaded sentence and the second found no issues.
- Final automated proof: clean `npm ci` followed by `npm run check` passed in 147s. The command ran every check above and applied all 58 local migrations. Test counts were 2,261 unit, 638 component, 103 focused security, 243 focused sync, and 15 CI contract tests. Every SQL assertion passed. No manual proof is required. GitHub-hosted proof remains pending until the pull request is opened.

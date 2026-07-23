# Task 0024: Correct release versioning and traceability

**Branch**: `feature/release-version-traceability`
**Depends on**: 0022, 0023
**Source**: release review conversation, July 2026 · **User stories**: a release tag builds the commit it names; an already-matching app version does not fail deployment; release checks finish before store submission

## What to build

Make the release workflow validate version metadata without committing changes back to `main`. Tag-triggered builds must check out and build the tagged commit. Manual releases must record their source commit and selected version. A matching `app.json` version is valid; a mismatch fails with instructions before any store build starts.

Run required validation against the same source commit that will be built. Keep EAS remote build-number behavior explicit. Add a pre-release checklist for required database migrations, rollback or recovery, and CI evidence. The agent must not access or modify production Supabase.

## Software Repository Guidelines

**Applicable references**: `references/03-documentation.md`, `references/04-developer-environment.md`, `references/05-ci-cd.md`, `references/07-security.md`, `references/10-definition-of-done.md`

- [x] Keep releases traceable to one version, tag, commit, validation run, build, and submission.
- [x] Keep production credentials in protected CI environments and document the human database checkpoint.

## Before implementation

Inspect the current release inputs and run the checks that deployment already invokes.

```bash
git status --short --branch
git tag --sort=-creatordate | head -n 10
node -p "require('./app.json').expo.version"
npm ci
npm run lint
npm run typecheck
npm run test:unit
```

Do not dispatch a production build, submit an app, push a tag, or access production Supabase while implementing this task.

## Implementation work

- [x] Add workflow tests or a local harness for matching, mismatched, tag, and manual version inputs.
- [x] Remove the workflow commit and push to `main`.
- [x] Check out the triggering commit consistently in validation, build, and submission jobs.
- [x] Validate version metadata before EAS work begins and report a clear mismatch error.
- [x] Require the complete PR checks and the agreed iOS pre-release E2E result.
- [x] Document source tracing, build-number behavior, migration verification, and recovery steps.

## Decisions

- GitHub does not offer required environment reviewers for this private repository on its current plan. Release builds and store submission are therefore separate workflows. Build runs never submit. A manual submission run resolves exact EAS build IDs from a completed build workflow run and records the database confirmation plus iOS E2E evidence when applicable.
- The `production-release` environment scopes release credentials and allows only `main` and `v*` refs.

## Human checkpoints

- [x] [confirm-db] Before production release, the owner performs the documented read-only migration and RPC verification in production and confirms the expected signatures are present · Expected: every migration required by the tagged client is recorded as applied and required RPC signatures exist · Failure: a migration or signature is absent or ambiguous, in which case release stops · Reason: the agent is prohibited from accessing production and production schema state cannot be inferred from local migrations. The manual submission workflow now requires this confirmation on every release; no production release or production database access occurred during implementation.

## Acceptance criteria

- [x] A tag builds the tagged commit without mutating `main`.
- [x] A matching version succeeds and a mismatched version fails before store build or submission.
- [x] Every release artifact can be traced to its source commit and validation runs.
- [x] Store submission waits for required checks and the production migration confirmation.
- [x] Manual dispatch remains supported without silently changing source version files.

## Completion record

- `.github/workflows/deploy.yml` now validates and builds only the triggering source. `.github/workflows/submit.yml` is a separate manual workflow that downloads one build run's artifacts, checks out its recorded source commit, and submits its validated EAS IDs.
- `scripts/validate-release.mjs` covers matching and mismatched tag and manual inputs. `scripts/resolve-release-submission.mjs` enforces the build-run link, source SHA, version, platform, database confirmation, iOS E2E evidence, and UUID-shaped build IDs before values reach workflow outputs or shell commands.
- `scripts/release-workflow.test.mjs` was completed through observed RED and GREEN cycles for matching tags, mismatch instructions, manual selection, source-ref propagation, no-submit build runs, database and iOS gates, cross-run rejection, malformed build IDs, and exact-ID submission. `npm run test:ci` runs the harness.
- Implement and review modes loaded Software Repository Guidelines references `00-overview`, `01-style-and-code-quality`, `02-testing`, `03-documentation`, `04-developer-environment`, `05-ci-cd`, `06-code-health-and-maintainability`, `07-security`, and `10-definition-of-done`. Evidence includes locked installs, pinned Node 20.19.4 and EAS CLI 21.1.0, exact source checkouts, retained metadata artifacts, controlled local tests, environment-scoped secrets, and provider branch/tag restrictions.
- The `production-release` GitHub environment was verified by secret name only. It contains the three required environment secrets and permits only `main` plus `v*`; no secret value was read. Required environment reviewers are unavailable on the repository's current plan, so build and submission are separate and submission records the human confirmations.
- Task review ran Standards, Spec, Bug, and Security lenses against `main`. The final pass had no unresolved findings or accepted security risks. EAS build IDs are format-validated before shell interpolation.
- `docs/RELEASE.md` documents the build and submission workflows, source evidence, EAS remote build numbers, production migration and RPC queries, failure handling, and recovery. `README.md` links the checklist and describes the current release process. The write-well audit completed in two passes; the second pass added no findings.
- Final proof: `npm run check` passed after the two-workflow design, including 2,261 unit tests, 638 component tests, security and sync suites, 58 local migrations, 26 SQL vectors, and merge/timer SQL checks. `npm run test:ci`, `npm run lint`, YAML parsing, `git diff --check`, and documentation-link checks also passed after review. No EAS build, store submission, tag push, or production Supabase action was performed.

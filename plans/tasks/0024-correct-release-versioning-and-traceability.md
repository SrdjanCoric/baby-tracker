# Task 0024: Correct release versioning and traceability

**Branch**: `feature/release-version-traceability`
**Depends on**: 0022, 0023
**Source**: release review conversation, July 2026 · **User stories**: a release tag builds the commit it names; an already-matching app version does not fail deployment; release checks finish before store submission

## What to build

Make the release workflow validate version metadata without committing changes back to `main`. Tag-triggered builds must check out and build the tagged commit. Manual releases must record their source commit and selected version. A matching `app.json` version is valid; a mismatch fails with instructions before any store build starts.

Run required validation against the same source commit that will be built. Keep EAS remote build-number behavior explicit. Add a pre-release checklist for required database migrations, rollback or recovery, and CI evidence. The agent must not access or modify production Supabase.

## Software Repository Guidelines

**Applicable references**: `references/03-documentation.md`, `references/04-developer-environment.md`, `references/05-ci-cd.md`, `references/07-security.md`, `references/10-definition-of-done.md`

- [ ] Keep releases traceable to one version, tag, commit, validation run, build, and submission.
- [ ] Keep production credentials in protected CI environments and document the human database checkpoint.

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

- [ ] Add workflow tests or a local harness for matching, mismatched, tag, and manual version inputs.
- [ ] Remove the workflow commit and push to `main`.
- [ ] Check out the triggering commit consistently in validation, build, and submission jobs.
- [ ] Validate version metadata before EAS work begins and report a clear mismatch error.
- [ ] Require the complete PR checks and the agreed iOS pre-release E2E result.
- [ ] Document source tracing, build-number behavior, migration verification, and recovery steps.

## Human checkpoints

- [ ] [confirm-db] Before production release, the owner performs the documented read-only migration and RPC verification in production and confirms the expected signatures are present · Expected: every migration required by the tagged client is recorded as applied and required RPC signatures exist · Failure: a migration or signature is absent or ambiguous, in which case release stops · Reason: the agent is prohibited from accessing production and production schema state cannot be inferred from local migrations.

## Acceptance criteria

- [ ] A tag builds the tagged commit without mutating `main`.
- [ ] A matching version succeeds and a mismatched version fails before store build or submission.
- [ ] Every release artifact can be traced to its source commit and validation runs.
- [ ] Store submission waits for required checks and the production migration confirmation.
- [ ] Manual dispatch remains supported without silently changing source version files.

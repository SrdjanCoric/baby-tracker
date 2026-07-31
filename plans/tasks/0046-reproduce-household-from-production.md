# Task 0046: Reproduce a household safely from production

**Branch**: `feature/reproduce-household-from-production`
**Depends on**: none
**Source**: regression-planning conversation 2026-07-31 · **User stories**: the account owner can reproduce the complete household-visible history in simulators without writing to production; maintainers can compare current and July 5 behavior against the same realistic local dataset without committing personal data

## What to build

Provide one documented repository command that accepts an account email at runtime, identifies that account's production household, exports the complete household-visible dataset through an explicitly read-only production database session, and imports it into local Supabase under synthetic local authentication. Include all household caregivers, babies, activity history, milestones, and settings or goals needed to reproduce Home, Timeline, Statistics, and related history views regardless of which caregiver logged an entry. The neutral snapshot must support isolated current-schema and July 5 baseline-schema local fixtures so both application versions can exercise equivalent common data without sharing mutable state.

Anonymize caregiver identities during local import while preserving relationships and timestamps needed for reproduction. Exclude authentication secrets and provider metadata, push and widget tokens, invitations and invite codes, notification delivery credentials, active timer locks, and any other capability-bearing or live operational state. Snapshot files and generated manifests must be permission-restricted, ignored by Git, and removable through an idempotent cleanup command. The importer must fail closed unless every destination endpoint is local and must replace only its dedicated reproduction fixture scope.

Production access is SELECT-only. The workflow must enforce read-only mode at the database session and transaction levels, avoid printing credentials or raw personal records, and provide count and relationship verification without persisting the source email in version-controlled files. Production schema changes, production fixture writes, and a general-purpose production backup/restore facility remain out of scope.

## Software Repository Guidelines

**Applicable references**: `references/02-testing.md`, `references/03-documentation.md`, `references/07-security.md`, `references/10-definition-of-done.md`

- [ ] Provide focused deterministic tests for production read-only enforcement, local-destination validation, anonymization, relationship preservation, idempotent fixture replacement, and cleanup; retain complete non-device CI but defer broad E2E suites to the pre-deployment release gate.
- [ ] Document prerequisites, secret-safe credential handling, export/import/verify/cleanup commands, included and excluded data, expected simulator login, and failure recovery from the repository root.
- [ ] Keep credentials and snapshots out of source control and logs, use synthetic local authentication, apply restrictive file permissions, and prove that production writes and non-local imports fail closed.
- [ ] Leave a new contributor able to create, verify, use, and remove the reproduction fixture using only version-controlled instructions and separately supplied production credentials.

## Implementation work

- [ ] Inventory the current production and local schemas and define the minimum relational dataset required for accurate household-visible Home, Timeline, Statistics, Health, Growth, milestone, and sleep behavior.
- [ ] Test-first, add guards proving the export uses an explicitly read-only session and transaction and the importer accepts only local Supabase endpoints discovered through the repository's local Supabase tooling.
- [ ] Accept the source account email only as a runtime argument, resolve its household without logging it, and export all relevant rows for household babies regardless of `logged_by` caregiver.
- [ ] Exclude capability-bearing and operational tables, including auth secrets, provider identities, tokens, invitations, invite codes, notification delivery state, and active timer locks.
- [ ] Transform the snapshot into synthetic local auth and anonymized caregiver identities while preserving baby, activity, timestamp, ownership, and settings relationships needed by the application.
- [ ] Add schema-aware, isolated import paths for the current local schema and the July 5 baseline schema, projecting equivalent common fields while retaining current-only fields only in the current fixture.
- [ ] Prove the two local fixtures cannot share ports, storage, auth state, queues, or mutations during differential testing.
- [ ] Store generated data only under an ignored, permission-restricted artifact directory and add secret/PII leak checks for tracked files and command output.
- [ ] Make import and cleanup idempotent and scope destructive local cleanup to the dedicated reproduction household.
- [ ] Add count, foreign-key, timestamp-range, and representative activity verification that compares a non-sensitive export manifest with local rows.
- [ ] Document one export/import command, one verification command, one cleanup command, simulator credentials, prerequisites, and troubleshooting.
- [ ] Run focused script, SQL, security, documentation, lint, type, and complete non-device checks; run only the fixture-specific simulator verification, not the broad E2E release suites.

## Human checkpoints

- [ ] [confirm-security] Review the exact included/excluded table list, anonymization, credential handling, artifact location, log redaction, and destination guards before any production connection is used.
- [ ] [confirm-db] Authorize one read-only production export and replacement of the dedicated local reproduction fixture after the automated guards pass; no production mutation is authorized.
- [ ] [verify] Sign in to the synthetic local account in the simulator and compare babies, Timeline coverage, and representative Statistics/Health/Growth values with the production account · Expected: equivalent household-visible behavior with anonymized caregivers and no active production timer state · Failure: missing/extra activity history, broken relationships, exposed identity data, or any production write attempt · Reason: final visual equivalence and source-account ownership cannot be proved entirely by automation.

## Acceptance criteria

- [ ] One documented command creates a complete household-visible local reproduction fixture from a runtime account email without committing or logging that email or raw personal data.
- [ ] Production access is mechanically constrained to SELECT-only read-only sessions and transactions, with no production write path in the tool.
- [ ] The importer refuses non-local destinations and modifies only the dedicated local reproduction fixture scope.
- [ ] Other caregivers are anonymized, synthetic local authentication works, and activity relationships and timestamps remain suitable for regression reproduction.
- [ ] Tokens, credentials, invitations, invite codes, active timer locks, and other capability-bearing state are absent from the snapshot.
- [ ] Automated manifests and local SQL checks prove expected row counts, referential integrity, representative coverage, and equivalent common records in isolated current and July 5 fixtures.
- [ ] Export, both schema-aware imports, verification, simulator use, and cleanup are documented and manually verified.

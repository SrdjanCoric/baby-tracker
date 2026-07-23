# Release checklist

Use this checklist for every App Store or Google Play release. The release workflow builds the commit that triggered it. It never edits `app.json` or pushes to `main`.

## One-time GitHub setup

Create a protected GitHub environment named `production-release`. Require an owner review and keep these secrets in the environment, not as repository files:

- `EXPO_TOKEN`
- `EXPO_APPLE_APP_SPECIFIC_PASSWORD`
- `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`

The build and submission jobs both use this environment. Review each approval request. Do not approve a build until the source checks, iOS gate when applicable, and production database check below have passed. Before approving submission, confirm that its EAS build ID matches the build job.

## Prepare the source

1. Update `expo.version` in `app.json` through a normal pull request. Do not rely on the release workflow to change it.
2. Record the merged commit SHA and the version.
3. Confirm the `Non-device checks required` job passed for that commit.
4. For an iOS release, check out that exact commit and run:

   ```bash
   npm run e2e:household-timers:clean
   ```

   Record the command result and the path under `e2e/artifacts/household-timers/`. A build, fixture, assertion, Maestro, or cleanup failure stops the release.
5. Complete the read-only production database check below. Agents must not access production Supabase.

## Verify production migrations and RPCs

The owner runs these read-only queries in the production Supabase SQL editor. First list the applied migrations:

```sql
SELECT version
FROM supabase_migrations.schema_migrations
ORDER BY version;
```

Compare the result with every migration under `supabase/migrations/` required by the release commit. Do not infer production state from the repository alone. If a required version is absent or ambiguous, stop the release.

Then inspect the RPC signatures used by sync and household timers:

```sql
SELECT
  p.proname,
  pg_get_function_identity_arguments(p.oid) AS arguments
FROM pg_proc AS p
JOIN pg_namespace AS n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN (
    'merge_record',
    'acquire_timer_lock',
    'release_timer_lock',
    'toggle_timer_pause'
  )
ORDER BY p.proname, arguments;
```

For the current client, confirm the query returns these names, argument names, and types:

```text
acquire_timer_lock(p_baby_id uuid, p_activity_type character varying, p_user_id uuid, p_timer_data jsonb, p_started_at timestamp with time zone)
merge_record(p_table text, p_record jsonb, p_field_clocks jsonb)
merge_record(p_table text, p_record jsonb, p_field_clocks jsonb, p_operation_id text, p_expected_user_id uuid)
release_timer_lock(p_baby_id uuid, p_activity_type character varying, p_user_id uuid)
toggle_timer_pause(p_baby_id uuid, p_activity_type text, p_user_id uuid, p_timer_data jsonb)
```

If a migration or signature is missing, do not build or submit. Apply it through the approved database change process, follow that migration's recovery plan, and rerun both queries before continuing.

## Start the workflow

### Tag release

Create `v<version>` on the already-merged release commit and push that tag. For example, `v4.6.0` must point to a commit whose `app.json` version is `4.6.0`. A mismatch fails in the metadata job before EAS starts. Do not move or recreate a published release tag; fix the source and use a new version.

### Manual release

Run **Deploy to App Stores** against the chosen branch or tag. Enter the exact version already present in `app.json` and choose `ios`, `android`, or `all`. The workflow records the selected version, source ref, and source commit. It does not change source files.

## Trace the release

Keep the workflow URL with the release record. The run provides:

- `release-metadata-<run-id>`, containing version, source ref, source commit, platform, trigger, and validation run;
- `eas-ios-build-<run-id>` or `eas-android-build-<run-id>`, containing the EAS build response and exact build ID;
- the complete reusable non-device check results for the same source commit;
- build and submission summaries that use the recorded build ID rather than `--latest`.

`eas.json` keeps `appVersionSource` set to `remote` and production `autoIncrement` enabled. `app.json` owns the user-facing marketing version. EAS increments the remote iOS build number and Android version code without committing those values to the repository.

## Recovery

- **Metadata or checks fail:** fix the source through a pull request. Do not edit or retag the failed release in place.
- **The iOS gate fails:** keep its artifacts, fix the failure, and rerun the clean gate on the final source commit.
- **The production database check fails:** stop. Apply the missing migration through the approved process or restore according to that migration's recovery plan, then repeat the read-only checks.
- **An EAS build fails:** rerun the workflow from the same source only after identifying the cause. Treat the new EAS build ID as a separate artifact.
- **The wrong build reaches submission:** stop the rollout or keep the store release in draft, using the store console as appropriate. Match the submitted EAS build ID to the workflow record before resuming. Publish a corrected build with a new remote build number; never use `--latest` to guess the artifact.
- **A submitted app must be withdrawn:** pause the staged rollout or remove the pending store version. Database changes are handled separately under their migration recovery plan; do not roll back shared schema merely because a mobile submission was stopped.

# Release checklist

Use this checklist for every App Store or Google Play release. Release builds and store submissions are separate GitHub workflows. Neither workflow edits `app.json` or pushes to `main`.

## One-time GitHub setup

Create a GitHub environment named `production-release` and store these secrets in it:

- `EXPO_TOKEN`
- `EXPO_APPLE_APP_SPECIFIC_PASSWORD`
- `GOOGLE_PLAY_SERVICE_ACCOUNT_JSON`

Limit the environment to the `main` branch and tags matching `v*`. This private repository's current GitHub plan does not provide required environment reviewers. The build workflow cannot submit to a store. The separate submission workflow requires the owner to record the database confirmation and iOS evidence before it reads the environment secrets.

## Prepare the source

1. Update `expo.version` in `app.json` through a normal pull request.
2. Record the merged commit SHA and version.
3. Confirm the `Non-device checks required` job passed for that commit.
4. For an iOS release, check out that commit and run:

   ```bash
   npm run e2e:household-timers:clean
   ```

   Record the result and the path under `e2e/artifacts/household-timers/`. A provisioning, assertion, Maestro, or cleanup failure stops the release.

## Build the release

### Tag build

Create `v<version>` on the merged release commit and push the tag. For example, `v4.6.0` must point to a commit whose `app.json` version is `4.6.0`. The **Build Store Release** workflow validates the version, reruns the complete non-device checks, and builds both platforms from the tagged commit. It does not submit either build.

A version mismatch fails before EAS starts. Fix the source through a pull request and use a new version. Do not move a published release tag.

### Manual build

Run **Build Store Release** against `main` or a release tag. Enter the version already present in `app.json` and choose `ios`, `android`, or `all`. The workflow records the selected version, source ref, source commit, and EAS build IDs without changing source files.

After the workflow succeeds, copy its numeric run ID from the Actions URL:

```text
https://github.com/<owner>/<repository>/actions/runs/<run-id>
```

## Verify production migrations and RPCs

Before store submission, the owner runs these read-only queries in the production Supabase SQL editor. Agents must not access production Supabase.

List the applied migrations:

```sql
SELECT version
FROM supabase_migrations.schema_migrations
ORDER BY version;
```

Compare the result with the migrations under `supabase/migrations/` required by the release commit. Stop if a required version is absent or ambiguous.

Inspect the RPC signatures used by sync and household timers:

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

If a migration or signature is missing, do not submit. Apply it through the approved database change process, follow that migration's recovery plan, and repeat both queries.

## Submit the recorded builds

Open **Actions → Submit Store Release → Run workflow** and select `main`. Enter:

- the successful **Build Store Release** run ID;
- `ios`, `android`, or `all`;
- confirmation that the production migration and RPC check passed;
- the clean iOS E2E result or artifact path when submitting iOS.

The workflow downloads release artifacts from that run. It rejects metadata from another run, a platform that was not built, an unconfirmed database check, and an iOS submission without E2E evidence. It then checks out the recorded source commit and submits the recorded EAS build ID. It never uses `--latest` and never rebuilds during submission.

## Trace the release

Keep both workflow URLs with the release record. The build run provides:

- `release-metadata-<run-id>`, containing the version and source commit;
- `eas-ios-build-<run-id>` or `eas-android-build-<run-id>`, containing the EAS build response and build ID;
- the complete reusable non-device check results for that source commit.

The submission run provides `submission-metadata-<run-id>`, which links the build workflow run to the source, selected platform, confirmations, and submitted build IDs. Build and submission summaries repeat the IDs used by EAS.

`eas.json` keeps `appVersionSource` set to `remote` and production `autoIncrement` enabled. `app.json` owns the marketing version. EAS increments the remote iOS build number and Android version code without committing them to the repository.

## Recovery

- **Metadata or checks fail:** fix the source through a pull request. Do not edit or retag the failed release.
- **The iOS gate fails:** keep its artifacts, fix the failure, and rerun the clean gate on the final source commit.
- **The production database check fails:** stop. Apply the missing migration through the approved process or restore according to its recovery plan, then repeat the read-only checks.
- **An EAS build fails:** identify the cause and rerun the build workflow from the same source. The new workflow run and EAS build ID are separate release artifacts.
- **Submission validation fails:** correct the run ID, platform, or missing confirmation. Do not bypass the validator or select a build with `--latest`.
- **The wrong build reaches a store:** stop the rollout or keep the release in draft. Compare the submitted EAS build ID with the submission artifact before resuming.
- **A submitted app must be withdrawn:** pause the staged rollout or remove the pending store version. Handle database recovery separately under the applicable migration plan.

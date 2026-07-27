import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { parse } from "yaml";

const appVersion = JSON.parse(readFileSync("app.json", "utf8")).expo.version;
const deployWorkflow = parse(
  readFileSync(".github/workflows/deploy.yml", "utf8")
);
const packageJson = JSON.parse(readFileSync("package.json", "utf8"));

function resolveSubmission({
  platform = "ios",
  overrides = {},
  iosBuildId = "11111111-1111-4111-8111-111111111111",
  androidBuildId = "22222222-2222-4222-8222-222222222222",
} = {}) {
  const directory = mkdtempSync(join(tmpdir(), "sofibaby-submission-"));
  const outputPath = join(directory, "github-output.txt");
  const recordPath = join(directory, "submission-metadata.json");
  writeFileSync(
    join(directory, "release-metadata.json"),
    JSON.stringify({
      version: appVersion,
      sourceCommit: "0123456789abcdef0123456789abcdef01234567",
      sourceRef: `refs/tags/v${appVersion}`,
      trigger: "push",
      platform: "all",
      validationRun: "https://github.com/example/sofibaby/actions/runs/12345",
    })
  );
  writeFileSync(
    join(directory, "eas-ios-build.json"),
    JSON.stringify([{ id: iosBuildId }])
  );
  writeFileSync(
    join(directory, "eas-android-build.json"),
    JSON.stringify([{ id: androidBuildId }])
  );

  const result = spawnSync("node", ["scripts/resolve-release-submission.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: {
      ...process.env,
      GITHUB_OUTPUT: outputPath,
      GITHUB_REF: "refs/heads/main",
      GITHUB_REPOSITORY: "example/sofibaby",
      GITHUB_SERVER_URL: "https://github.com",
      IOS_E2E_EVIDENCE: "e2e/artifacts/household-timers/2026-07-23",
      PRODUCTION_DATABASE_CONFIRMED: "true",
      RELEASE_ARTIFACTS_PATH: directory,
      RELEASE_RUN_ID: "12345",
      SUBMISSION_METADATA_PATH: recordPath,
      SUBMISSION_PLATFORM: platform,
      ...overrides,
    },
  });

  return { result, outputPath, recordPath };
}

function validateRelease(overrides = {}) {
  const directory = mkdtempSync(join(tmpdir(), "sofibaby-release-"));
  const outputPath = join(directory, "github-output.txt");
  const metadataPath = join(directory, "release-metadata.json");
  const result = spawnSync("node", ["scripts/validate-release.mjs"], {
    cwd: process.cwd(),
    encoding: "utf8",
    env: {
      ...process.env,
      GITHUB_EVENT_NAME: "push",
      GITHUB_REF: `refs/tags/v${appVersion}`,
      GITHUB_SHA: "0123456789abcdef0123456789abcdef01234567",
      GITHUB_RUN_ID: "12345",
      GITHUB_SERVER_URL: "https://github.com",
      GITHUB_REPOSITORY: "example/sofibaby",
      GITHUB_OUTPUT: outputPath,
      RELEASE_METADATA_PATH: metadataPath,
      RELEASE_PLATFORM: "all",
      RELEASE_VERSION: "",
      ...overrides,
    },
  });

  return { result, outputPath, metadataPath };
}

test("a matching release tag validates the tagged version and source commit", () => {
  const { result, outputPath, metadataPath } = validateRelease();

  assert.equal(result.status, 0, result.stderr);
  assert.match(readFileSync(outputPath, "utf8"), new RegExp(`version=${appVersion}`));
  assert.deepEqual(JSON.parse(readFileSync(metadataPath, "utf8")), {
    version: appVersion,
    sourceCommit: "0123456789abcdef0123456789abcdef01234567",
    sourceRef: `refs/tags/v${appVersion}`,
    trigger: "push",
    platform: "all",
    validationRun: "https://github.com/example/sofibaby/actions/runs/12345",
  });
});

test("a tag version mismatch stops with instructions before release work", () => {
  const { result } = validateRelease({ GITHUB_REF: "refs/tags/v99.0.0" });

  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /Release version 99\.0\.0 does not match app\.json version .*Update app\.json in the tagged commit or create a tag that matches it\. No source files were changed\./s
  );
});

test("a matching manual version records the selected version and source", () => {
  const { result, metadataPath } = validateRelease({
    GITHUB_EVENT_NAME: "workflow_dispatch",
    GITHUB_REF: "refs/heads/release-candidate",
    RELEASE_VERSION: appVersion,
    RELEASE_PLATFORM: "ios",
  });

  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(readFileSync(metadataPath, "utf8")), {
    version: appVersion,
    sourceCommit: "0123456789abcdef0123456789abcdef01234567",
    sourceRef: "refs/heads/release-candidate",
    trigger: "workflow_dispatch",
    platform: "ios",
    validationRun: "https://github.com/example/sofibaby/actions/runs/12345",
  });
});

test("a manual version mismatch explains how to select the source version", () => {
  const { result } = validateRelease({
    GITHUB_EVENT_NAME: "workflow_dispatch",
    GITHUB_REF: "refs/heads/main",
    RELEASE_VERSION: "99.0.0",
  });

  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /Select .* in the version input or update app\.json on the commit you dispatch\. No source files were changed\./s
  );
});

test("a manual run uses its selected version even when dispatched from a tag", () => {
  const { result } = validateRelease({
    GITHUB_EVENT_NAME: "workflow_dispatch",
    GITHUB_REF: `refs/tags/v${appVersion}`,
    RELEASE_VERSION: "99.0.0",
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Select .* in the version input/);
});

test("release metadata validates the triggering source before builds", () => {
  const manualInputs = deployWorkflow.on.workflow_dispatch.inputs;
  const metadata = deployWorkflow.jobs["release-metadata"];
  const serialized = JSON.stringify(deployWorkflow);

  assert.equal(manualInputs.version.required, true);
  assert.equal(manualInputs.platform.required, true);
  assert.deepEqual(metadata.outputs, {
    version: "${{ steps.validate.outputs.version }}",
    "source-sha": "${{ steps.validate.outputs.source-sha }}",
  });
  assert.equal(metadata.steps[0].with.ref, "${{ github.sha }}");
  assert.match(serialized, /node scripts\/validate-release\.mjs/);
  assert.doesNotMatch(serialized, /git (commit|push)/);
  assert.equal(deployWorkflow.jobs.test, undefined);
});

test("the release harness runs in the canonical CI contract suite", () => {
  assert.match(packageJson.scripts["test:ci"], /release-workflow\.test\.mjs/);
});

test("the operator checklist gates release approval and records recovery evidence", () => {
  const checklist = readFileSync("docs/RELEASE.md", "utf8");
  const easConfig = JSON.parse(readFileSync("eas.json", "utf8"));

  assert.match(checklist, /production-release/);
  assert.match(checklist, /npm run check/);
  assert.match(checklist, /npm run audit:dependencies/);
  assert.match(checklist, /npm run e2e:household-timers:clean/);
  assert.match(checklist, /supabase_migrations\.schema_migrations/);
  assert.match(checklist, /pg_get_function_identity_arguments/);
  assert.match(checklist, /Recovery/);
  assert.match(checklist, /release-metadata-.*eas-(ios|android)-build/s);
  assert.equal(easConfig.cli.appVersionSource, "remote");
  assert.equal(easConfig.build.production.autoIncrement, true);
});

test("a confirmed submission resolves the exact build from its release run", () => {
  const { result, outputPath, recordPath } = resolveSubmission();

  assert.equal(result.status, 0, result.stderr);
  assert.match(
    readFileSync(outputPath, "utf8"),
    /ios-build-id=11111111-1111-4111-8111-111111111111/
  );
  assert.deepEqual(JSON.parse(readFileSync(recordPath, "utf8")), {
    releaseRunId: "12345",
    version: appVersion,
    sourceCommit: "0123456789abcdef0123456789abcdef01234567",
    sourceRef: `refs/tags/v${appVersion}`,
    platform: "ios",
    productionDatabaseConfirmed: true,
    iosE2eEvidence: "e2e/artifacts/household-timers/2026-07-23",
    buildIds: { ios: "11111111-1111-4111-8111-111111111111" },
  });
});

test("submission stops unless production database verification is confirmed", () => {
  const { result } = resolveSubmission({
    overrides: { PRODUCTION_DATABASE_CONFIRMED: "false" },
  });

  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /Confirm the production migration and RPC verification before submission\./
  );
});

test("iOS submission requires evidence from the clean local gate", () => {
  const { result } = resolveSubmission({
    overrides: { IOS_E2E_EVIDENCE: "" },
  });

  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /Provide the clean iOS E2E result or artifact path before submission\./
  );
});

test("submission rejects artifacts that do not belong to the requested release run", () => {
  const { result } = resolveSubmission({
    overrides: { RELEASE_RUN_ID: "99999" },
  });

  assert.notEqual(result.status, 0);
  assert.match(
    result.stderr,
    /Release metadata does not belong to workflow run 99999\./
  );
});

test("submission rejects malformed EAS build IDs before shell use", () => {
  const { result } = resolveSubmission({
    iosBuildId: 'bad-id"; echo injected',
  });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /valid iOS EAS build ID/);
});

test("release builds never submit to an app store", () => {
  assert.doesNotMatch(JSON.stringify(deployWorkflow), /eas submit/);
  assert.equal(deployWorkflow.jobs["submit-ios"], undefined);
  assert.equal(deployWorkflow.jobs["submit-android"], undefined);
});

test("protected build jobs use the validated source and record exact EAS IDs", () => {
  for (const platform of ["ios", "android"]) {
    const build = deployWorkflow.jobs[`build-${platform}`];
    const buildCommands = build.steps.flatMap((step) =>
      step.run ? [step.run] : []
    );
    const expectedRef = "${{ needs.release-metadata.outputs.source-sha }}";

    assert.equal(build.environment, "production-release", `${platform} build`);
    assert.equal(build.needs, "release-metadata");
    assert.equal(build.outputs["build-id"], "${{ steps.build.outputs.build-id }}");
    assert.equal(build.steps[0].with.ref, expectedRef);
    assert.equal(
      build.steps.find((step) => step.uses === "actions/setup-node@v4").with[
        "node-version"
      ],
      "20.19.4"
    );
    assert.equal(
      build.steps.find(
        (step) => step.uses === "expo/expo-github-action@v8"
      ).with["eas-version"],
      "21.1.0"
    );
    assert.match(buildCommands.join("\n"), /eas build .*--wait .*--json/);
  }
});

test("manual submission downloads one release run and submits its exact builds", () => {
  const submissionWorkflow = parse(
    readFileSync(".github/workflows/submit.yml", "utf8")
  );
  const inputs = submissionWorkflow.on.workflow_dispatch.inputs;
  const resolve = submissionWorkflow.jobs["resolve-release"];
  const serialized = JSON.stringify(submissionWorkflow);

  assert.equal(inputs.release_run_id.required, true);
  assert.equal(inputs.production_database_confirmed.type, "boolean");
  assert.equal(inputs.ios_e2e_evidence.required, false);
  assert.equal(resolve.permissions.actions, "read");
  assert.match(serialized, /actions\/download-artifact@v4/);
  assert.match(serialized, /node scripts\/resolve-release-submission\.mjs/);
  assert.doesNotMatch(serialized, /eas build|--latest/);

  for (const platform of ["ios", "android"]) {
    const submit = submissionWorkflow.jobs[`submit-${platform}`];
    const commands = submit.steps.flatMap((step) =>
      step.run ? [step.run] : []
    );

    assert.equal(submit.environment, "production-release");
    assert.equal(
      submit.steps[0].with.ref,
      "${{ needs.resolve-release.outputs.source-sha }}"
    );
    assert.match(
      commands.join("\n"),
      new RegExp(`eas submit .*--id "\\$\\{\\{ needs\\.resolve-release\\.outputs\\.${platform}-build-id \\}\\}"`)
    );
  }
});

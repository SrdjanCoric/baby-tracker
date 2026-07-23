import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { parse } from "yaml";

const appVersion = JSON.parse(readFileSync("app.json", "utf8")).expo.version;
const deployWorkflow = parse(
  readFileSync(".github/workflows/deploy.yml", "utf8")
);
const testWorkflow = parse(readFileSync(".github/workflows/test.yml", "utf8"));
const packageJson = JSON.parse(readFileSync("package.json", "utf8"));

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

test("release metadata validates the triggering source before complete checks", () => {
  const manualInputs = deployWorkflow.on.workflow_dispatch.inputs;
  const metadata = deployWorkflow.jobs["release-metadata"];
  const checks = deployWorkflow.jobs.test;
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
  assert.equal(checks.needs, "release-metadata");
  assert.equal(checks.uses, "./.github/workflows/test.yml");
  assert.equal(
    checks.with.ref,
    "${{ needs.release-metadata.outputs.source-sha }}"
  );
});

test("reusable non-device checks run against the requested source commit", () => {
  assert.deepEqual(testWorkflow.on.workflow_call.inputs.ref, {
    description: "Commit to validate",
    required: false,
    type: "string",
    default: "",
  });

  for (const [jobName, job] of Object.entries(testWorkflow.jobs)) {
    const checkout = job.steps.find(
      (step) => step.uses === "actions/checkout@v4"
    );
    assert.equal(
      checkout.with.ref,
      "${{ inputs.ref || github.sha }}",
      jobName
    );
  }
});

test("the release harness runs in the canonical CI contract suite", () => {
  assert.match(packageJson.scripts["test:ci"], /release-workflow\.test\.mjs/);
});

test("the operator checklist gates release approval and records recovery evidence", () => {
  const checklist = readFileSync("docs/RELEASE.md", "utf8");
  const easConfig = JSON.parse(readFileSync("eas.json", "utf8"));

  assert.match(checklist, /production-release/);
  assert.match(checklist, /Non-device checks required/);
  assert.match(checklist, /npm run e2e:household-timers:clean/);
  assert.match(checklist, /supabase_migrations\.schema_migrations/);
  assert.match(checklist, /pg_get_function_identity_arguments/);
  assert.match(checklist, /Recovery/);
  assert.match(checklist, /release-metadata-.*eas-(ios|android)-build/s);
  assert.equal(easConfig.cli.appVersionSource, "remote");
  assert.equal(easConfig.build.production.autoIncrement, true);
});

test("store submissions use protected credentials and the exact validated builds", () => {
  for (const platform of ["ios", "android"]) {
    const build = deployWorkflow.jobs[`build-${platform}`];
    const submit = deployWorkflow.jobs[`submit-${platform}`];
    const buildCommands = build.steps.flatMap((step) =>
      step.run ? [step.run] : []
    );
    const submitCommands = submit.steps.flatMap((step) =>
      step.run ? [step.run] : []
    );
    const expectedRef = "${{ needs.release-metadata.outputs.source-sha }}";

    assert.equal(build.environment, "production-release", `${platform} build`);
    assert.ok(build.needs.includes("release-metadata"));
    assert.ok(build.needs.includes("test"));
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

    assert.equal(submit.environment, "production-release", `${platform} submit`);
    assert.ok(submit.needs.includes("release-metadata"));
    assert.ok(submit.needs.includes(`build-${platform}`));
    assert.equal(submit.steps[0].with.ref, expectedRef);
    assert.match(
      submitCommands.join("\n"),
      new RegExp(`eas submit .*--id "\\$\\{\\{ needs\\.build-${platform}\\.outputs\\.build-id \\}\\}"`)
    );
    assert.doesNotMatch(submitCommands.join("\n"), /--latest/);
  }
});

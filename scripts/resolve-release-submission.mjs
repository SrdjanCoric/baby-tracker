import { join } from "node:path";
import { readFileSync, writeFileSync } from "node:fs";

const artifactsPath = process.env.RELEASE_ARTIFACTS_PATH;
const releaseRunId = process.env.RELEASE_RUN_ID;
const platform = process.env.SUBMISSION_PLATFORM;

function fail(message) {
  console.error(message);
  process.exit(1);
}

if (process.env.PRODUCTION_DATABASE_CONFIRMED !== "true") {
  fail("Confirm the production migration and RPC verification before submission.");
}
if (
  (platform === "ios" || platform === "all") &&
  !process.env.IOS_E2E_EVIDENCE?.trim()
) {
  fail("Provide the clean iOS E2E result or artifact path before submission.");
}

const metadata = JSON.parse(
  readFileSync(join(artifactsPath, "release-metadata.json"), "utf8")
);
const allowedPlatforms = new Set(["ios", "android", "all"]);

if (process.env.GITHUB_REF !== "refs/heads/main") {
  fail("Run store submission from the main branch.");
}
if (!/^\d+$/.test(releaseRunId ?? "")) {
  fail("Release workflow run ID must contain digits only.");
}
if (!allowedPlatforms.has(platform)) {
  fail("Submission platform must be ios, android, or all.");
}
if (
  metadata.validationRun !==
  `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${releaseRunId}`
) {
  fail(`Release metadata does not belong to workflow run ${releaseRunId}.`);
}
if (!/^[0-9a-f]{40}$/.test(metadata.sourceCommit ?? "")) {
  fail("Release metadata does not contain a valid source commit.");
}
if (!/^\d+\.\d+\.\d+$/.test(metadata.version ?? "")) {
  fail("Release metadata does not contain a valid app version.");
}
if (metadata.platform !== "all" && metadata.platform !== platform) {
  fail(`Release run ${releaseRunId} did not build ${platform}.`);
}

function readBuildId(name) {
  const value = JSON.parse(
    readFileSync(join(artifactsPath, `eas-${name}-build.json`), "utf8")
  );
  const build = Array.isArray(value) ? value[0] : value;
  if (
    typeof build?.id !== "string" ||
    !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(build.id)
  ) {
    const label = name === "ios" ? "iOS" : "Android";
    fail(`The release run did not record a valid ${label} EAS build ID.`);
  }
  return build.id;
}

const buildIds = {};
if (platform === "ios" || platform === "all") {
  buildIds.ios = readBuildId("ios");
}
if (platform === "android" || platform === "all") {
  buildIds.android = readBuildId("android");
}

const record = {
  releaseRunId,
  version: metadata.version,
  sourceCommit: metadata.sourceCommit,
  sourceRef: metadata.sourceRef,
  platform,
  productionDatabaseConfirmed:
    process.env.PRODUCTION_DATABASE_CONFIRMED === "true",
  iosE2eEvidence: process.env.IOS_E2E_EVIDENCE,
  buildIds,
};

writeFileSync(
  process.env.GITHUB_OUTPUT,
  [
    `version=${record.version}`,
    `source-sha=${record.sourceCommit}`,
    `ios-build-id=${buildIds.ios ?? ""}`,
    `android-build-id=${buildIds.android ?? ""}`,
  ].join("\n") + "\n"
);
writeFileSync(
  process.env.SUBMISSION_METADATA_PATH,
  `${JSON.stringify(record, null, 2)}\n`
);

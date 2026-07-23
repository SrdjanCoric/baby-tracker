import { readFileSync, writeFileSync } from "node:fs";

const appVersion = JSON.parse(readFileSync("app.json", "utf8")).expo.version;
const sourceRef = process.env.GITHUB_REF;
const isTagRelease =
  process.env.GITHUB_EVENT_NAME === "push" &&
  sourceRef?.startsWith("refs/tags/v");
const version = isTagRelease
  ? sourceRef.slice("refs/tags/v".length)
  : process.env.RELEASE_VERSION;
const metadata = {
  version,
  sourceCommit: process.env.GITHUB_SHA,
  sourceRef,
  trigger: process.env.GITHUB_EVENT_NAME,
  platform: process.env.RELEASE_PLATFORM,
  validationRun: `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`,
};

if (version !== appVersion) {
  const resolution = isTagRelease
    ? "Update app.json in the tagged commit or create a tag that matches it."
    : `Select ${appVersion} in the version input or update app.json on the commit you dispatch.`;
  console.error(
    `Release version ${version} does not match app.json version ${appVersion}. ` +
      `${resolution} No source files were changed.`
  );
  process.exit(1);
}

writeFileSync(
  process.env.GITHUB_OUTPUT,
  `version=${version}\nsource-sha=${metadata.sourceCommit}\n`
);
writeFileSync(
  process.env.RELEASE_METADATA_PATH,
  `${JSON.stringify(metadata, null, 2)}\n`
);
console.log(`Validated SofiBaby ${version} from ${metadata.sourceCommit}.`);

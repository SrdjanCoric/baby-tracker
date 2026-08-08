import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { URL } from "node:url";
import { parse } from "yaml";

const workflow = parse(
  readFileSync(new URL("../.github/workflows/e2e.yml", import.meta.url), "utf8")
);
const packageJson = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8")
);

function commands(job) {
  return job.steps.flatMap((step) => (step.run ? [step.run] : []));
}

test("Android E2E is manual and does not run in routine CI", () => {
  assert.equal(workflow.name, "Android E2E Tests");
  assert.ok(workflow.on.workflow_dispatch);
  assert.equal(workflow.on.push, undefined);
  assert.equal(workflow.on.schedule, undefined);
  assert.ok(
    Object.values(workflow.jobs).every(
      (job) => !String(job["runs-on"]).startsWith("macos-")
    )
  );
  assert.doesNotMatch(
    JSON.stringify(workflow.jobs),
    /iphonesimulator|xcrun simctl|prebuild --platform ios/i
  );

  const android = workflow.jobs["e2e-android"];
  assert.ok(android);
  assert.equal(android["runs-on"], "ubuntu-latest");
  assert.ok(
    android.steps.some(
      (step) => step.uses === "reactivecircus/android-emulator-runner@v2"
    )
  );
  assert.match(commands(android).join("\n"), /npm run e2e:seed/);
});

test("the clean local iOS release gate is canonical and contract-tested", () => {
  assert.equal(
    packageJson.scripts["e2e:household-timers:clean"],
    "npm run test:widget:swift && node e2e/scripts/run-household-timers.mjs --clean"
  );
  assert.match(packageJson.scripts["test:ci"], /e2e-release-gate\.test\.mjs/);
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { URL } from "node:url";
import { parse } from "yaml";

const workflow = parse(
  readFileSync(
    new URL("../.github/workflows/test.yml", import.meta.url),
    "utf8"
  )
);
const packageJson = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url), "utf8")
);

function commands(jobName) {
  return workflow.jobs[jobName].steps.flatMap((step) =>
    step.run ? [step.run] : []
  );
}

function runs(jobName, command) {
  return commands(jobName).some((run) => run.includes(command));
}

const checkJobs = ["quality", "dependency-audit"];
const requiredJobs = ["changes", ...checkJobs, "android-native"];

test("pull requests and main run the required non-device checks", () => {
  assert.ok(workflow.on.pull_request);
  assert.ok(workflow.on.push);
  assert.equal(workflow.on.workflow_call, undefined);
  assert.deepEqual(Object.keys(workflow.jobs), [
    "changes",
    "quality",
    "dependency-audit",
    "android-native",
    "required",
  ]);

  assert.ok(runs("quality", "npm run lint"));
  assert.ok(runs("quality", "npm run typecheck"));
  assert.ok(runs("dependency-audit", "npm run audit:dependencies"));
  assert.doesNotMatch(
    JSON.stringify(workflow),
    /npm run test:|supabase start|maestro/i
  );
});

test("Android CI clean-prebuilds and builds both phone and Wear apps", () => {
  const job = workflow.jobs["android-native"];
  const javaStep = job.steps.find(
    (step) => step.uses === "actions/setup-java@v4"
  );
  const robolectricCacheStep = job.steps.find(
    (step) => step.name === "Cache Robolectric Android runtime"
  );
  const gradleStep = job.steps.find((step) =>
    step.run?.includes(":wear:testDebugUnitTest")
  );

  assert.equal(job["timeout-minutes"], 30);
  assert.equal(javaStep.with.distribution, "temurin");
  assert.equal(javaStep.with["java-version"], "17");
  assert.equal(javaStep.with.cache, "gradle");
  assert.equal(robolectricCacheStep.uses, "actions/cache@v4");
  assert.equal(
    robolectricCacheStep.with.path,
    "~/.m2/repository/org/robolectric"
  );
  assert.match(
    robolectricCacheStep.with.key,
    /robolectric-\$\{\{ hashFiles\('plugins\/with-wear-os\/android\/wear\/build\.gradle'\) \}\}/
  );
  assert.ok(runs("android-native", "npm ci"));
  assert.ok(
    runs(
      "android-native",
      "cp .github/fixtures/google-services.ci.json google-services.json"
    )
  );
  assert.ok(
    runs("android-native", "npx expo prebuild --platform android --clean")
  );
  assert.equal(gradleStep["working-directory"], "android");
  assert.match(gradleStep.run, /:app:assembleDebug/);
  assert.match(gradleStep.run, /:wear:assembleDebug/);
  assert.match(
    gradleStep.run,
    /-PreactNativeArchitectures=arm64-v8a/
  );
});

test("dependency advisories remain a required pull-request check", () => {
  assert.equal(
    packageJson.scripts["audit:dependencies"],
    "node scripts/audit-dependencies.mjs"
  );
  assert.ok(runs("dependency-audit", "npm ci"));
  assert.ok(workflow.jobs.required.needs.includes("dependency-audit"));
});

test("fast jobs use locked dependencies, pinned Node, and timeouts", () => {
  for (const jobName of checkJobs) {
    const job = workflow.jobs[jobName];
    const nodeStep = job.steps.find(
      (step) => step.uses === "actions/setup-node@v4"
    );

    assert.ok(
      job.steps.some((step) => step.uses === "actions/checkout@v4"),
      jobName
    );
    assert.equal(nodeStep.with["node-version"], "20.19.4", jobName);
    assert.ok(runs(jobName, "npm ci"), jobName);
    assert.equal(job["timeout-minutes"], 10, jobName);
  }

  assert.equal(workflow.jobs.required["timeout-minutes"], 5);
  assert.equal(workflow.concurrency["cancel-in-progress"], true);
});

test("the aggregate required check evaluates every required job after failure", () => {
  const required = workflow.jobs.required;
  const command = commands("required").join("\n");

  assert.equal(required.if, "always()");
  assert.deepEqual(required.needs, requiredJobs);
  for (const jobName of requiredJobs) {
    assert.match(
      command,
      new RegExp(`${jobName}=\\$\\{\\{ needs\\.${jobName}\\.result \\}\\}`)
    );
  }
});

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

const checkJobs = [
  "quality",
  "unit-tests",
  "component-tests",
  "security-tests",
  "sync-tests",
  "sql-tests",
];

test("pull requests and main run every maintained non-device check", () => {
  assert.ok(workflow.on.pull_request);
  assert.ok(workflow.on.push);

  assert.ok(runs("quality", "npm run lint"));
  assert.ok(runs("quality", "npm run typecheck"));
  assert.ok(runs("quality", "npm run test:ci"));
  assert.ok(runs("unit-tests", "npm run test:unit"));
  assert.ok(runs("component-tests", "npm run test:component -- --runInBand"));
  assert.ok(runs("security-tests", "npm run test:security"));
  assert.ok(runs("sync-tests", "npm run test:sync"));
  assert.ok(runs("sql-tests", "npm run test:sql:setup"));
  assert.ok(runs("sql-tests", "npm run test:sql"));
});

test("every check job uses locked dependencies and pinned tool versions", () => {
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
  }

  const requiredNodeStep = workflow.jobs.required.steps.find(
    (step) => step.uses === "actions/setup-node@v4"
  );

  assert.equal(requiredNodeStep.with["node-version"], "20.19.4");
  assert.equal(packageJson.devDependencies.supabase, "2.109.1");
  assert.equal(
    workflow.jobs["sql-tests"].env.SUPABASE_DB_URL,
    "postgresql://postgres:postgres@127.0.0.1:54322/postgres"
  );
});

test("test jobs retain their output even when a suite fails", () => {
  for (const jobName of [
    "unit-tests",
    "component-tests",
    "security-tests",
    "sync-tests",
    "sql-tests",
  ]) {
    const upload = workflow.jobs[jobName].steps.find(
      (step) => step.uses === "actions/upload-artifact@v4"
    );

    const loggedCommands = commands(jobName).filter((run) =>
      run.includes("tee test-results/")
    );

    assert.ok(loggedCommands.length > 0, jobName);
    assert.ok(
      loggedCommands.every((run) => run.includes("set -o pipefail")),
      jobName
    );
    assert.equal(upload.if, "always()", jobName);
    assert.equal(upload.with.name, `${jobName}-output`, jobName);
    assert.equal(upload.with["if-no-files-found"], "error", jobName);
  }
});

test("the aggregate required check evaluates every non-device job even after a failure", () => {
  const required = workflow.jobs.required;
  const command = commands("required").join("\n");

  assert.equal(required.if, "always()");
  assert.deepEqual(required.needs, checkJobs);
  for (const jobName of checkJobs) {
    assert.match(
      command,
      new RegExp(`${jobName}=\\$\\{\\{ needs\\.${jobName}\\.result \\}\\}`)
    );
  }
});

test("the non-device workflow does not invoke simulator E2E", () => {
  assert.doesNotMatch(JSON.stringify(workflow), /maestro|simulator|e2e:/i);
});

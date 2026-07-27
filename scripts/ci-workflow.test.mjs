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

test("pull requests and main run only fast non-test checks", () => {
  assert.ok(workflow.on.pull_request);
  assert.ok(workflow.on.push);
  assert.equal(workflow.on.workflow_call, undefined);
  assert.deepEqual(Object.keys(workflow.jobs), [
    "quality",
    "dependency-audit",
    "required",
  ]);

  assert.ok(runs("quality", "npm run lint"));
  assert.ok(runs("quality", "npm run typecheck"));
  assert.ok(runs("dependency-audit", "npm run audit:dependencies"));
  assert.doesNotMatch(JSON.stringify(workflow), /npm run test:|supabase start|maestro/i);
});

test("dependency advisories remain a required pull-request check", () => {
  assert.equal(packageJson.scripts["audit:dependencies"], "node scripts/audit-dependencies.mjs");
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

test("the aggregate required check evaluates every fast job after failure", () => {
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

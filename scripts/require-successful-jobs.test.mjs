import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { URL } from "node:url";

const command = new URL("./require-successful-jobs.mjs", import.meta.url);

function run(...results) {
  return spawnSync(process.execPath, [command.pathname, ...results], {
    encoding: "utf8",
  });
}

const successfulResults = [
  "quality=success",
  "dependency-audit=success",
  "unit-tests=success",
  "component-tests=success",
  "security-tests=success",
  "sync-tests=success",
  "sql-tests=success",
];

test("accepts a successful result from every required non-device job", () => {
  const result = run(...successfulResults);

  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /All required non-device jobs passed/);
});

test("rejects an incomplete set of required job results", () => {
  const result = run(...successfulResults.slice(0, -1));

  assert.equal(result.status, 1);
  assert.match(result.stderr, /sql-tests=missing/);
});

for (const failedResult of successfulResults) {
  const jobName = failedResult.split("=", 1)[0];

  test(`rejects a failed ${jobName} result`, () => {
    const result = run(
      ...successfulResults.map((value) =>
        value === failedResult ? `${jobName}=failure` : value
      )
    );

    assert.equal(result.status, 1);
    assert.match(result.stderr, new RegExp(`${jobName}=failure`));
  });
}

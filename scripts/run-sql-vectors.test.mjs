import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import { URL } from "node:url";

const source = readFileSync(
  new URL("./run-sql-vectors.mjs", import.meta.url),
  "utf8"
);
const functions = source.slice(
  source.indexOf("function runActiveTimerAuthorizationTests()"),
  source.indexOf("function runLiveActivityPushTokenTests()")
);
const reporting = source.slice(
  source.indexOf('console.log("");\nconst timerAuthorization'),
  source.indexOf('console.log("");\nconst liveActivityTokens')
);

for (const failed of [
  "timer-permission-session-tests.sql",
  "active-timer-authorization-tests.sql",
]) {
  test(`reports each timer SQL suite independently when ${failed} fails`, () => {
    const calls = [];
    const lines = [];
    const context = {
      ROOT: "/repo",
      join,
      GREEN: "",
      RED: "",
      RESET: "",
      hardFail: false,
      psql: ([, file]) => {
        calls.push(file);
        if (file.endsWith(failed))
          throw { stdout: "failing assertion", stderr: "" };
        return "PASS: assertion";
      },
      console: { log: (line) => lines.push(line) },
      process: { stdout: { write: () => {} } },
    };
    runInNewContext(functions + reporting, context);
    assert.equal(calls.length, 2);
    assert.ok(
      calls.some((file) => file.endsWith("timer-permission-session-tests.sql"))
    );
    assert.ok(
      calls.some((file) =>
        file.endsWith("active-timer-authorization-tests.sql")
      )
    );
    const summaries = lines.filter((line) => /[✓✗]/u.test(line));
    assert.equal(summaries.length, 2);
    assert.equal(summaries.filter((line) => line.includes("✓")).length, 1);
    assert.equal(summaries.filter((line) => line.includes("✗")).length, 1);
    assert.equal(context.hardFail, true);
  });
}

import assert from "node:assert/strict";
import { chmodSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const projectDir = path.resolve(import.meta.dirname, "../..");
const runner = path.join(projectDir, "e2e/scripts/run-onboarding-network-failure.sh");

function runHarness({
  failCommand = "",
  apiUrl = "http://127.0.0.1:54321",
  dbUrl = "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
} = {}) {
  const directory = mkdtempSync(path.join(tmpdir(), "onboarding-network-runner-"));
  const binDirectory = path.join(directory, "bin");
  const logPath = path.join(directory, "commands.log");
  const statePath = path.join(directory, "api-state");
  const metroStatePath = path.join(directory, "metro-state");
  spawnSync("mkdir", ["-p", binDirectory]);
  writeFileSync(statePath, "running\n");
  writeFileSync(metroStatePath, "stopped\n");

  const fakeCommand = path.join(directory, "fake-command.mjs");
  writeFileSync(
    fakeCommand,
    `#!/usr/bin/env node
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
const command = path.basename(process.argv[1]);
const args = process.argv.slice(2);
const invocation = command + " " + args.join(" ");
appendFileSync(process.env.COMMAND_LOG, invocation + "\\n");
if (process.env.CANCEL_COMMAND && invocation.includes(process.env.CANCEL_COMMAND)) {
  process.kill(process.ppid, "SIGTERM");
  setTimeout(() => process.exit(0), 3000);
} else if (process.env.FAIL_COMMAND && invocation.includes(process.env.FAIL_COMMAND)) {
  process.exit(23);
} else if (command === "npx") {
  process.stdout.write(JSON.stringify({ API_URL: process.env.FAKE_API_URL, DB_URL: process.env.FAKE_DB_URL, SERVICE_ROLE_KEY: "not-logged", ANON_KEY: "not-logged" }));
} else if (command === "jq") {
  for await (const chunk of process.stdin) void chunk;
  const filter = args.at(-1);
  const values = { ".API_URL // empty": process.env.FAKE_API_URL, ".DB_URL // empty": process.env.FAKE_DB_URL, ".SERVICE_ROLE_KEY // empty": "not-logged", ".ANON_KEY // empty": "not-logged", ".extra.expoClient._internal.projectRoot // empty": process.env.FAKE_PROJECT_DIR };
  process.stdout.write((values[filter] ?? "") + "\\n");
} else if (command === "docker") {
  if (args[0] === "stop") writeFileSync(process.env.API_STATE, "stopped\\n");
  if (args[0] === "start" || args[0] === "unpause") writeFileSync(process.env.API_STATE, "running\\n");
  if (args[0] === "inspect") {
    const state = readFileSync(process.env.API_STATE, "utf8").trim();
    process.stdout.write(args.includes("{{.State.Paused}}") ? "false\\n" : state + "\\n");
  }
} else if (command === "curl") {
  const url = args.find((arg) => arg.startsWith("http")) ?? "";
  if (url.includes(":8081/status")) {
    if (readFileSync(process.env.METRO_STATE, "utf8").trim() !== "running") process.exit(7);
    process.stdout.write("packager-status:running");
  } else if (/127\\.0\\.0\\.1:8081\\/?$/.test(url)) {
    process.stdout.write(JSON.stringify({ extra: { expoClient: { _internal: { projectRoot: process.env.FAKE_PROJECT_DIR } } } }));
  } else if (readFileSync(process.env.API_STATE, "utf8").trim() !== "running") {
    process.exit(7);
  }
} else if (command === "npm" && args.join(" ").includes("e2e:start-caregiver-join")) {
  writeFileSync(process.env.METRO_STATE, "running\\n");
  setInterval(() => {}, 1000);
}
`
  );
  chmodSync(fakeCommand, 0o755);
  for (const command of ["curl", "docker", "jq", "maestro", "npm", "npx", "psql"]) {
    symlinkSync(fakeCommand, path.join(binDirectory, command));
  }

  const startedAt = Date.now();
  const result = spawnSync("bash", [runner], {
    cwd: projectDir,
    env: {
      ...process.env,
      API_STATE: statePath,
      METRO_STATE: metroStatePath,
      COMMAND_LOG: logPath,
      FAIL_COMMAND: failCommand,
      CANCEL_COMMAND: failCommand.startsWith("cancel:") ? failCommand.slice(7) : "",
      FAKE_API_URL: apiUrl,
      FAKE_DB_URL: dbUrl,
      FAKE_PROJECT_DIR: projectDir,
      MAESTRO_DEVICE: "test-device",
      PATH: `${binDirectory}:${process.env.PATH}`,
    },
    encoding: "utf8",
    timeout: 10_000,
  });

  return {
    ...result,
    durationMs: Date.now() - startedAt,
    commands: readFileSync(logPath, "utf8").trim().split("\n"),
    apiState: readFileSync(statePath, "utf8").trim(),
  };
}

test("network recovery runner starts guarded Metro before changing fixtures and proves the database result", () => {
  const result = runHarness();

  assert.equal(result.status, 0, result.stderr);
  const metroIndex = result.commands.findIndex((command) =>
    command.includes("e2e:start-caregiver-join")
  );
  const fixtureIndex = result.commands.findIndex((command) => command === "npm run e2e:seed");
  assert.ok(metroIndex >= 0 && metroIndex < fixtureIndex, "guarded Metro did not start before fixture changes");
  const recoverIndex = result.commands.findIndex((command) =>
    command.includes("network-failure-recover.yaml")
  );
  const verificationIndex = result.commands.findIndex((command) =>
    command.includes("verify-caregiver-join-recovery.sql")
  );
  assert.ok(recoverIndex >= 0, "recovery flow did not run");
  assert.ok(verificationIndex > recoverIndex, "database verification did not follow recovery");
  assert.equal(result.apiState, "running");
});

test("network recovery runner restores the API when an interrupted phase fails", () => {
  const result = runHarness({ failCommand: "network-failure-offline.yaml" });

  assert.notEqual(result.status, 0);
  assert.equal(result.apiState, "running");
  const restoreIndex = result.commands.findIndex((command) => command.startsWith("docker start "));
  const diagnosticsIndex = result.commands.findIndex((command) => command.startsWith("psql "));
  assert.ok(restoreIndex >= 0 && restoreIndex < diagnosticsIndex, "diagnostics ran before API restoration");
});

test("network recovery runner restores the API when the run is cancelled", () => {
  const result = runHarness({ failCommand: "cancel:network-failure-offline.yaml" });

  assert.notEqual(result.status, 0);
  assert.equal(result.apiState, "running");
  assert.ok(
    result.commands.some((command) => command.startsWith("docker start ")),
    result.commands.join("\n")
  );
  assert.ok(result.durationMs < 2500, `cancellation took ${result.durationMs}ms`);
});

test("network recovery runner rejects non-local API and database endpoints before fixtures change", () => {
  const remoteApi = runHarness({ apiUrl: "https://project.supabase.co" });
  const remoteDatabase = runHarness({ dbUrl: "postgresql://postgres:secret@database.example.com/postgres" });

  for (const result of [remoteApi, remoteDatabase]) {
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /Refusing to run onboarding network failure against non-local Supabase endpoints/);
    assert.equal(result.commands.some((command) => command.startsWith("npm ")), false);
  }
});

test("network recovery runner bounds every API health request", () => {
  const result = runHarness();

  assert.equal(result.status, 0, result.stderr);
  const healthRequests = result.commands.filter((command) => command.includes("/auth/v1/health"));
  assert.ok(healthRequests.length > 0);
  assert.ok(healthRequests.every((command) => command.includes("--max-time 1")));
});

test("flow files structurally place offline submission before restart and persisted Retry before resubmission", () => {
  const offlineFlow = readFileSync(
    path.join(projectDir, "e2e/flows/onboarding/network-failure-offline.yaml"),
    "utf8"
  );
  const recoverFlow = readFileSync(
    path.join(projectDir, "e2e/flows/onboarding/network-failure-recover.yaml"),
    "utf8"
  );

  const offlineSubmitIndex = offlineFlow.indexOf("join-family-submit-button");
  const offlineLaunchIndex = offlineFlow.indexOf("launchApp:");
  const recoverRetryIndex = recoverFlow.indexOf("retry-join-button");
  const recoverSubmitIndex = recoverFlow.indexOf("join-family-submit-button");

  assert.ok(offlineSubmitIndex >= 0 && offlineLaunchIndex > offlineSubmitIndex);
  assert.ok(offlineFlow.match(/retry-join-button/g)?.length >= 2);
  assert.ok(recoverRetryIndex >= 0 && recoverSubmitIndex > recoverRetryIndex);
  assert.match(recoverFlow, /Delete my data and join/);
});

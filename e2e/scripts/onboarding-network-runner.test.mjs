import assert from "node:assert/strict";
import { chmodSync, mkdtempSync, readFileSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

const projectDir = path.resolve(import.meta.dirname, "../..");
const runner = path.join(projectDir, "e2e/scripts/run-onboarding-network-failure.sh");

function runHarness({ failCommand = "", apiUrl = "http://127.0.0.1:54321" } = {}) {
  const directory = mkdtempSync(path.join(tmpdir(), "onboarding-network-runner-"));
  const binDirectory = path.join(directory, "bin");
  const logPath = path.join(directory, "commands.log");
  const statePath = path.join(directory, "api-state");
  spawnSync("mkdir", ["-p", binDirectory]);
  writeFileSync(statePath, "running\n");

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
  process.exit(0);
}
if (process.env.FAIL_COMMAND && invocation.includes(process.env.FAIL_COMMAND)) process.exit(23);
if (command === "npx") {
  process.stdout.write(JSON.stringify({ API_URL: process.env.FAKE_API_URL, DB_URL: "postgresql://postgres:postgres@127.0.0.1:54322/postgres", SERVICE_ROLE_KEY: "not-logged", ANON_KEY: "not-logged" }));
} else if (command === "jq") {
  const filter = args.at(-1);
  const values = { ".API_URL // empty": process.env.FAKE_API_URL, ".DB_URL // empty": "postgresql://postgres:postgres@127.0.0.1:54322/postgres", ".SERVICE_ROLE_KEY // empty": "not-logged", ".ANON_KEY // empty": "not-logged" };
  process.stdout.write((values[filter] ?? "") + "\\n");
} else if (command === "docker") {
  if (args[0] === "stop") writeFileSync(process.env.API_STATE, "stopped\\n");
  if (args[0] === "start" || args[0] === "unpause") writeFileSync(process.env.API_STATE, "running\\n");
  if (args[0] === "inspect") {
    const state = readFileSync(process.env.API_STATE, "utf8").trim();
    process.stdout.write(args.includes("{{.State.Paused}}") ? "false\\n" : state + "\\n");
  }
} else if (command === "curl") {
  if (readFileSync(process.env.API_STATE, "utf8").trim() !== "running") process.exit(7);
}
`
  );
  chmodSync(fakeCommand, 0o755);
  for (const command of ["curl", "docker", "jq", "maestro", "npm", "npx", "psql"]) {
    symlinkSync(fakeCommand, path.join(binDirectory, command));
  }

  const result = spawnSync("bash", [runner], {
    cwd: projectDir,
    env: {
      ...process.env,
      API_STATE: statePath,
      COMMAND_LOG: logPath,
      FAIL_COMMAND: failCommand,
      CANCEL_COMMAND: failCommand.startsWith("cancel:") ? failCommand.slice(7) : "",
      FAKE_API_URL: apiUrl,
      MAESTRO_DEVICE: "test-device",
      PATH: `${binDirectory}:${process.env.PATH}`,
    },
    encoding: "utf8",
  });

  return {
    ...result,
    commands: readFileSync(logPath, "utf8").trim().split("\n"),
    apiState: readFileSync(statePath, "utf8").trim(),
  };
}

test("network recovery runner proves the database result after the UI recovers", () => {
  const result = runHarness();

  assert.equal(result.status, 0, result.stderr);
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
  assert.ok(result.commands.some((command) => command.startsWith("docker start ")));
});

test("network recovery runner restores the API when the run is cancelled", () => {
  const result = runHarness({ failCommand: "cancel:network-failure-offline.yaml" });

  assert.notEqual(result.status, 0);
  assert.equal(result.apiState, "running");
  assert.ok(result.commands.some((command) => command.startsWith("docker start ")));
});

test("network recovery runner rejects a non-local Supabase endpoint before fixtures change", () => {
  const result = runHarness({ apiUrl: "https://project.supabase.co" });

  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Refusing to run onboarding network failure against non-local Supabase endpoints/);
  assert.equal(result.commands.some((command) => command.startsWith("npm ")), false);
});

test("offline submission happens before restart and recovery uses the persisted Retry action", () => {
  const offlineFlow = readFileSync(
    path.join(projectDir, "e2e/flows/onboarding/network-failure-offline.yaml"),
    "utf8"
  );
  const recoverFlow = readFileSync(
    path.join(projectDir, "e2e/flows/onboarding/network-failure-recover.yaml"),
    "utf8"
  );

  assert.ok(offlineFlow.indexOf("join-family-submit-button") < offlineFlow.indexOf("launchApp:"));
  assert.ok(offlineFlow.match(/retry-join-button/g)?.length >= 2);
  assert.ok(recoverFlow.indexOf("retry-join-button") < recoverFlow.indexOf("join-family-submit-button"));
  assert.match(recoverFlow, /Delete my data and join/);
});

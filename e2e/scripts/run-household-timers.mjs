#!/usr/bin/env node

import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

import {
  SLEEP_ACTIVITY,
  assertLocalEndpoint,
  assertMetroProjectRoot,
  getLocalApiRecoveryAction,
  getXcodebuildArgs,
  parseRunnerOptions,
  selectNamedSimulators,
  stopProcessGroup,
} from "./lib/household-runner.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const projectDir = path.resolve(scriptDir, "../..");
const runId = new Date()
  .toISOString()
  .replaceAll(":", "-")
  .replaceAll(".", "-");
const artifactDir = path.join(
  projectDir,
  "e2e",
  "artifacts",
  "household-timers",
  runId
);
const flowDir = path.join(projectDir, "e2e", "flows", "household-timers");
const ownerEmail = "e2e-owner@test.local";
const memberEmail = "e2e-member@test.local";
const primaryBabyId = "00000000-0000-0000-0001-000000000001";
const appId = "com.sofibaby.app";
const localApiContainer = "supabase_kong_baby-tracker";
const { cleanEnvironment } = parseRunnerOptions(process.argv.slice(2));

let simulators = [];
let metro;
let metroLogFd;
let cleanupFailed = false;
let failed = false;

fs.mkdirSync(artifactDir, { recursive: true });
process.chdir(projectDir);

function quote(value) {
  return `'${String(value).replaceAll("'", `'\\''`)}'`;
}

function run(command, args, label, options = {}) {
  const logPath = path.join(artifactDir, `${label}.log`);
  const shellCommand = [command, ...args].map(quote).join(" ");
  const result = spawnSync(
    "bash",
    ["-o", "pipefail", "-c", `${shellCommand} 2>&1 | tee ${quote(logPath)}`],
    {
      cwd: projectDir,
      env: { ...process.env, ...options.env },
      stdio: "inherit",
      timeout: options.timeout,
    }
  );

  if (result.error) {
    throw result.error;
  }
  if (result.status !== 0 && !options.allowFailure) {
    throw new Error(`${label} failed with exit code ${result.status}`);
  }
  return result;
}

function capture(command, args, label, options = {}) {
  const result = spawnSync(command, args, {
    cwd: projectDir,
    env: { ...process.env, ...options.env },
    encoding: "utf8",
    timeout: options.timeout,
    maxBuffer: options.maxBuffer ?? 50 * 1024 * 1024,
  });
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  fs.writeFileSync(path.join(artifactDir, `${label}.log`), output);
  if (result.error && !options.allowFailure) throw result.error;
  if (result.status !== 0 && !options.allowFailure) {
    throw new Error(
      `${label} failed with exit code ${result.status}: ${output.trim()}`
    );
  }
  return result.stdout ?? "";
}

function requireCommand(command) {
  const result = spawnSync("bash", ["-lc", `command -v ${quote(command)}`], {
    encoding: "utf8",
  });
  if (result.status !== 0) {
    throw new Error(`Missing required command: ${command}`);
  }
}

function readSupabaseStatus() {
  const status = JSON.parse(
    capture(
      "npx",
      ["supabase", "status", "--output", "json"],
      "supabase-status"
    )
  );
  assertLocalEndpoint(status.API_URL, "Supabase API");
  assertLocalEndpoint(status.DB_URL, "Supabase database");
  return status;
}

function findRuntime() {
  const output = JSON.parse(
    capture(
      "xcrun",
      ["simctl", "list", "runtimes", "--json"],
      "simulator-runtimes"
    )
  );
  const runtimes = output.runtimes
    .filter(
      (runtime) =>
        runtime.isAvailable !== false &&
        runtime.identifier.includes("SimRuntime.iOS")
    )
    .sort((a, b) =>
      a.version.localeCompare(b.version, undefined, { numeric: true })
    );
  const runtime = runtimes.at(-1);
  if (!runtime)
    throw new Error("No available iOS Simulator runtime is installed");
  return runtime;
}

function findDeviceType() {
  const output = JSON.parse(
    capture(
      "xcrun",
      ["simctl", "list", "devicetypes", "--json"],
      "simulator-device-types"
    )
  );
  const preferred = output.devicetypes.find(
    (type) => type.name === "iPhone 17 Pro"
  );
  const fallback = output.devicetypes.find(
    (type) => type.name.startsWith("iPhone") && !type.name.includes("SE")
  );
  const deviceType = preferred ?? fallback;
  if (!deviceType)
    throw new Error("No iPhone Simulator device type is installed");
  return deviceType.identifier;
}

function ensureSimulators(runtimeIdentifier) {
  const names = ["SofiBaby Owner", "SofiBaby Member"];
  const deviceType = findDeviceType();
  let devices = JSON.parse(
    capture(
      "xcrun",
      ["simctl", "list", "devices", "--json"],
      "simulator-devices-before"
    )
  );
  const runtimeDevices = devices.devices?.[runtimeIdentifier] ?? [];

  for (const name of names) {
    if (
      !runtimeDevices.some(
        (device) => device.name === name && device.isAvailable !== false
      )
    ) {
      run(
        "xcrun",
        ["simctl", "create", name, deviceType, runtimeIdentifier],
        `create-${name.toLowerCase().replaceAll(" ", "-")}`
      );
    }
  }

  devices = JSON.parse(
    capture(
      "xcrun",
      ["simctl", "list", "devices", "--json"],
      "simulator-devices-after"
    )
  );
  simulators = selectNamedSimulators(devices, runtimeIdentifier, names);

  for (const simulator of simulators) {
    const state = devices.devices[runtimeIdentifier].find(
      (device) => device.udid === simulator.udid
    )?.state;
    if (state !== "Booted") {
      run(
        "xcrun",
        ["simctl", "boot", simulator.udid],
        `boot-${simulator.name.toLowerCase().replaceAll(" ", "-")}`
      );
    }
    run(
      "xcrun",
      ["simctl", "bootstatus", simulator.udid, "-b"],
      `bootstatus-${simulator.name.toLowerCase().replaceAll(" ", "-")}`
    );
    run(
      "xcrun",
      [
        "simctl",
        "spawn",
        simulator.udid,
        "defaults",
        "write",
        "NSGlobalDomain",
        "AppleLanguages",
        "-array",
        "en",
      ],
      `language-${simulator.name.toLowerCase().replaceAll(" ", "-")}`
    );
    run(
      "xcrun",
      [
        "simctl",
        "spawn",
        simulator.udid,
        "defaults",
        "write",
        "NSGlobalDomain",
        "AppleLocale",
        "en_US",
      ],
      `locale-${simulator.name.toLowerCase().replaceAll(" ", "-")}`
    );
  }
}

function reinstallExistingAppForReuse() {
  const installedAppPath = capture(
    "xcrun",
    ["simctl", "get_app_container", simulators[0].udid, appId, "app"],
    "reuse-installed-app"
  ).trim();
  if (!installedAppPath.endsWith(".app")) {
    throw new Error(
      "Reuse mode requires the E2E app to be installed on SofiBaby Owner"
    );
  }

  const reusableAppPath = path.join(artifactDir, "ReusedSofiBaby.app");
  fs.cpSync(installedAppPath, reusableAppPath, { recursive: true });
  for (const simulator of simulators) {
    capture(
      "xcrun",
      ["simctl", "terminate", simulator.udid, appId],
      `reuse-terminate-${simulator.name.toLowerCase().replaceAll(" ", "-")}`,
      { allowFailure: true, timeout: 30_000 }
    );
    run(
      "xcrun",
      ["simctl", "uninstall", simulator.udid, appId],
      `reuse-uninstall-${simulator.name.toLowerCase().replaceAll(" ", "-")}`
    );
    run(
      "xcrun",
      ["simctl", "install", simulator.udid, reusableAppPath],
      `reuse-install-${simulator.name.toLowerCase().replaceAll(" ", "-")}`
    );
  }
  fs.rmSync(reusableAppPath, { recursive: true, force: true });
}

function findBuiltApp(derivedDataPath) {
  const productDir = path.join(
    derivedDataPath,
    "Build",
    "Products",
    "Debug-iphonesimulator"
  );
  const appName = fs
    .readdirSync(productDir)
    .find(
      (entry) =>
        entry.endsWith(".app") &&
        !entry.includes("Watch") &&
        !entry.includes("Widget")
    );
  if (!appName)
    throw new Error(`No simulator app was produced in ${productDir}`);
  return path.join(productDir, appName);
}

async function waitForMetro() {
  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    if (metro.exitCode !== null)
      throw new Error(`Metro exited with code ${metro.exitCode}`);
    try {
      const response = await fetch("http://127.0.0.1:8081/status");
      if ((await response.text()).includes("packager-status:running")) return;
    } catch {
      // Metro is still starting.
    }
    await delay(1000);
  }
  throw new Error("Metro did not become ready within 120 seconds");
}

async function isMetroRunning() {
  try {
    const response = await fetch("http://127.0.0.1:8081/status");
    return (await response.text()).includes("packager-status:running");
  } catch {
    return false;
  }
}

async function stopExistingMetro() {
  if (!(await isMetroRunning())) return;

  const manifest = await (await fetch("http://127.0.0.1:8081")).json();
  assertMetroProjectRoot(
    manifest.extra?.expoClient?._internal?.projectRoot,
    projectDir
  );
  const listenerPid = capture(
    "lsof",
    ["-tiTCP:8081", "-sTCP:LISTEN"],
    "existing-metro-listener"
  ).trim();
  const processGroupId = capture(
    "ps",
    ["-o", "pgid=", "-p", listenerPid],
    "existing-metro-process-group"
  ).trim();

  process.kill(-Number(processGroupId), "SIGTERM");
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline) {
    if (!(await isMetroRunning())) return;
    await delay(100);
  }
  process.kill(-Number(processGroupId), "SIGKILL");
}

async function startMetro(env) {
  metroLogFd = fs.openSync(path.join(artifactDir, "metro.log"), "a");
  metro = spawn(
    "npx",
    ["expo", "start", "--dev-client", "--port", "8081", "--clear"],
    {
      cwd: projectDir,
      env: { ...process.env, ...env, CI: "1" },
      detached: true,
      stdio: ["ignore", metroLogFd, metroLogFd],
    }
  );
  await waitForMetro();
}

function maestro(simulator, relativeFlow, variables = {}) {
  if (relativeFlow !== "login.yaml") {
    capture(
      "xcrun",
      ["simctl", "launch", simulator.udid, appId],
      `foreground-${simulator.name.toLowerCase().replaceAll(" ", "-")}-${Date.now()}`,
      { timeout: 30_000 }
    );
  }

  const outputDir = path.join(
    artifactDir,
    "maestro",
    `${simulator.name.replaceAll(" ", "-")}-${path.basename(relativeFlow, ".yaml")}-${Date.now()}`
  );
  const environmentArgs = Object.entries(variables).flatMap(([key, value]) => [
    "-e",
    `${key}=${value}`,
  ]);
  run(
    "maestro",
    [
      "--device",
      simulator.udid,
      "test",
      "--test-output-dir",
      outputDir,
      ...environmentArgs,
      path.join(flowDir, relativeFlow),
    ],
    `maestro-${simulator.name.toLowerCase().replaceAll(" ", "-")}-${path.basename(relativeFlow, ".yaml")}-${Date.now()}`,
    {
      env: { MAESTRO_DRIVER_STARTUP_TIMEOUT: "120000" },
      timeout: 240_000,
    }
  );
}

function psql(status, sql, label, options = {}) {
  return capture(
    "psql",
    [status.DB_URL, "-v", "ON_ERROR_STOP=1", "-Atqc", sql],
    label,
    options
  ).trim();
}

function resetScenarioData(status) {
  psql(
    status,
    `
      DELETE FROM active_timers
      WHERE baby_id = '${primaryBabyId}'::uuid
        AND activity_type = '${SLEEP_ACTIVITY.lockType}';
      DELETE FROM sleep_sessions
      WHERE baby_id = '${primaryBabyId}'::uuid;
    `,
    "reset-household-scenarios"
  );
}

async function waitForDatabase(
  status,
  activity,
  expectedActivities,
  expectedLocks
) {
  const deadline = Date.now() + 60_000;
  let lastResult = "";
  while (Date.now() < deadline) {
    lastResult = psql(
      status,
      `
        SELECT
          (SELECT count(*) FROM ${activity.table} WHERE baby_id = '${primaryBabyId}'::uuid AND deleted = false),
          (SELECT count(*) FROM active_timers WHERE baby_id = '${primaryBabyId}'::uuid AND activity_type = '${activity.lockType}');
      `,
      `database-poll-${activity.key}-${Date.now()}`,
      { allowFailure: true }
    );
    if (lastResult === `${expectedActivities}|${expectedLocks}`) return;
    await delay(1000);
  }
  throw new Error(
    `Database did not converge for ${activity.key}; expected ${expectedActivities}|${expectedLocks}, received ${lastResult}`
  );
}

function verifyCaregiverCompletions(status) {
  const result = psql(
    status,
    `
      SELECT string_agg(email || ':' || completion_count, ',' ORDER BY email)
      FROM (
        SELECT u.email, count(*) AS completion_count
        FROM ${SLEEP_ACTIVITY.table} a
        JOIN users u ON u.id = a.logged_by
        WHERE a.baby_id = '${primaryBabyId}'::uuid
          AND a.deleted = false
          AND u.email IN ('${ownerEmail}', '${memberEmail}')
        GROUP BY u.email
      ) completions;
    `,
    "verify-sleep-caregivers"
  );
  const expected = `${memberEmail}:1,${ownerEmail}:1`;
  if (result !== expected) {
    throw new Error(
      `Expected exactly one sleep completion from each caregiver; received ${result || "none"}`
    );
  }
}

function ensureLocalApiIsRunning() {
  const state = JSON.parse(capture(
    "docker",
    ["inspect", "--format", "{{json .State}}", localApiContainer],
    `inspect-local-supabase-api-${Date.now()}`,
    { timeout: 30_000 }
  ));
  const action = getLocalApiRecoveryAction(state.Status, state.Paused === true);
  if (!action) return;

  run(
    "docker",
    [action, localApiContainer],
    `${action}-local-supabase-api-${Date.now()}`,
    { timeout: 30_000 }
  );
}

function disconnectLocalApi() {
  run(
    "docker",
    ["stop", "--timeout", "10", localApiContainer],
    `stop-local-supabase-api-${Date.now()}`,
    { timeout: 30_000 }
  );
}

async function reconnectLocalApi(status) {
  ensureLocalApiIsRunning();
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${status.API_URL}/auth/v1/health`);
      if (response.ok) return;
    } catch {
      // The local API container is still starting.
    }
    await delay(250);
  }
  throw new Error("Local Supabase API did not recover within 30 seconds");
}

function restartApp(simulator, label) {
  capture(
    "xcrun",
    ["simctl", "terminate", simulator.udid, appId],
    `${label}-terminate-${Date.now()}`,
    { allowFailure: true, timeout: 30_000 }
  );
  capture(
    "xcrun",
    ["simctl", "launch", simulator.udid, appId, "-e2eMode", "true"],
    `${label}-launch-${Date.now()}`,
    { timeout: 30_000 }
  );
}

async function runSleepHandoff(status, owner, member) {
  console.log("\n=== sleep: offline reconnect and two-caregiver household handoff ===");

  disconnectLocalApi();
  try {
    maestro(owner, "start/sleep.yaml");
    await waitForDatabase(status, SLEEP_ACTIVITY, 0, 0);
  } finally {
    await reconnectLocalApi(status);
  }

  restartApp(owner, "restart-offline-owner");
  maestro(owner, "assert-owned.yaml");
  await waitForDatabase(status, SLEEP_ACTIVITY, 0, 1);
  restartApp(member, "restart-offline-member");
  maestro(member, "assert-locked.yaml", {
    ACTIVITY_CARD: SLEEP_ACTIVITY.card,
    LOCK_STATE: "locked-active",
  });
  await waitForDatabase(status, SLEEP_ACTIVITY, 0, 1);

  maestro(owner, "stop/sleep.yaml");
  await waitForDatabase(status, SLEEP_ACTIVITY, 1, 0);
  restartApp(member, "refresh-member-after-owner-stop");
  maestro(member, "assert-unlocked.yaml", {
    ACTIVITY_CARD: SLEEP_ACTIVITY.card,
  });

  maestro(member, "start/sleep.yaml");
  await waitForDatabase(status, SLEEP_ACTIVITY, 1, 1);
  restartApp(owner, "refresh-owner-after-member-start");
  maestro(owner, "assert-locked.yaml", {
    ACTIVITY_CARD: SLEEP_ACTIVITY.card,
    LOCK_STATE: "locked-active",
  });

  maestro(member, "stop/sleep.yaml");
  await waitForDatabase(status, SLEEP_ACTIVITY, 2, 0);
  verifyCaregiverCompletions(status);
  restartApp(owner, "refresh-owner-after-member-stop");
  maestro(owner, "assert-unlocked.yaml", {
    ACTIVITY_CARD: SLEEP_ACTIVITY.card,
  });
}

function collectDiagnostics(status) {
  for (const simulator of simulators) {
    const slug = simulator.name.toLowerCase().replaceAll(" ", "-");
    capture(
      "xcrun",
      [
        "simctl",
        "io",
        simulator.udid,
        "screenshot",
        path.join(artifactDir, `${slug}.png`),
      ],
      `screenshot-${slug}`,
      { allowFailure: true }
    );
    capture(
      "xcrun",
      [
        "simctl",
        "spawn",
        simulator.udid,
        "log",
        "show",
        "--last",
        "20m",
        "--style",
        "compact",
        "--predicate",
        'process == "SofiBabyTracker"',
      ],
      `device-log-${slug}`,
      { allowFailure: true, timeout: 60_000 }
    );
  }
  if (status?.DB_URL) {
    capture(
      "psql",
      [
        status.DB_URL,
        "-c",
        "TABLE active_timers; SELECT id, baby_id, logged_by, deleted, created_at FROM sleep_sessions ORDER BY created_at;",
      ],
      "database-diagnostics",
      { allowFailure: true }
    );
  }
  capture(
    "docker",
    ["logs", "--tail", "500", localApiContainer],
    "supabase-api-diagnostics",
    { allowFailure: true }
  );
}

async function cleanup() {
  try {
    ensureLocalApiIsRunning();
  } catch {
    cleanupFailed = true;
  }
  await stopProcessGroup(metro);
  if (metroLogFd !== undefined) {
    fs.closeSync(metroLogFd);
    metroLogFd = undefined;
  }
  if (!cleanEnvironment) {
    fs.writeFileSync(
      path.join(artifactDir, "cleanup.log"),
      "Metro stopped. Installed E2E apps, simulators, and local fixtures were retained for the next fast run.\n"
    );
    return;
  }

  for (const simulator of simulators) {
    capture(
      "xcrun",
      ["simctl", "terminate", simulator.udid, appId],
      `cleanup-terminate-${simulator.name}`,
      { allowFailure: true, timeout: 30_000 }
    );
    try {
      run(
        "xcrun",
        ["simctl", "shutdown", simulator.udid],
        `cleanup-shutdown-${simulator.name}`,
        { timeout: 30_000 }
      );
    } catch {
      cleanupFailed = true;
    }
  }
  const result = spawnSync("npm", ["run", "e2e:cleanup"], {
    cwd: projectDir,
    encoding: "utf8",
    timeout: 60_000,
  });
  fs.writeFileSync(
    path.join(artifactDir, "cleanup.log"),
    `${result.stdout ?? ""}${result.stderr ?? ""}`
  );
  if (result.error || result.status !== 0) cleanupFailed = true;
}

async function main() {
  let status;
  try {
    const requiredCommands = cleanEnvironment
      ? [
          "docker",
          "jq",
          "lsof",
          "maestro",
          "npx",
          "ps",
          "npm",
          "pod",
          "psql",
          "ruby",
          "xcodebuild",
          "xcrun",
        ]
      : ["docker", "lsof", "maestro", "npx", "ps", "psql", "xcrun"];
    for (const command of requiredCommands) requireCommand(command);

    if (cleanEnvironment) {
      run("npm", ["ci"], "npm-ci", { timeout: 1_200_000 });
      run("npx", ["supabase", "start"], "supabase-start", {
        timeout: 1_200_000,
      });
      ensureLocalApiIsRunning();
      status = readSupabaseStatus();
      run(
        "npx",
        ["supabase", "db", "reset", "--no-seed"],
        "supabase-reset",
        { timeout: 1_200_000 }
      );
      run("node", ["scripts/apply-migrations.mjs"], "apply-migrations", {
        timeout: 1_200_000,
      });
      run("npm", ["run", "e2e:seed"], "seed-fixtures", {
        timeout: 180_000,
      });
    }

    ensureLocalApiIsRunning();
    status = readSupabaseStatus();
    const runtime = findRuntime();
    ensureSimulators(runtime.identifier);
    if (!cleanEnvironment) reinstallExistingAppForReuse();
    resetScenarioData(status);

    const localEnv = {
      SOFIBABY_E2E_LOCAL_ENV: "1",
      EXPO_PUBLIC_SUPABASE_URL: status.API_URL,
      EXPO_PUBLIC_SUPABASE_ANON_KEY: status.ANON_KEY,
      EXPO_PUBLIC_E2E_TIMER_MINIMUM_SECONDS: "0",
    };
    if (cleanEnvironment) {
      run(
        "npx",
        ["expo", "prebuild", "--platform", "ios", "--clean"],
        "expo-prebuild",
        { env: localEnv, timeout: 1_200_000 }
      );
      run(
        "ruby",
        ["e2e/scripts/prepare-ios-project.rb"],
        "prepare-ios-project"
      );
      const derivedDataPath = path.join(artifactDir, "DerivedData");
      run(
        "xcodebuild",
        getXcodebuildArgs(derivedDataPath, simulators[0].udid),
        "xcodebuild",
        { env: localEnv, timeout: 1_800_000 }
      );
      const appPath = findBuiltApp(derivedDataPath);
      for (const simulator of simulators) {
        run(
          "xcrun",
          ["simctl", "install", simulator.udid, appPath],
          `install-${simulator.name.toLowerCase().replaceAll(" ", "-")}`
        );
      }
    }
    await stopExistingMetro();
    await startMetro(localEnv);

    const [owner, member] = simulators;
    maestro(owner, "login.yaml", { E2E_EMAIL: ownerEmail });
    maestro(member, "login.yaml", { E2E_EMAIL: memberEmail });

    await runSleepHandoff(status, owner, member);
    maestro(owner, "date-picker.yaml");

    console.log(
      `\nHousehold timer suite passed. Artifacts: ${path.relative(projectDir, artifactDir)}`
    );
  } catch (error) {
    failed = true;
    console.error(
      `\nHousehold timer suite failed: ${error instanceof Error ? error.message : String(error)}`
    );
    collectDiagnostics(status);
  } finally {
    await cleanup();
  }

  if (failed || cleanupFailed) {
    console.error(`Diagnostics: ${path.relative(projectDir, artifactDir)}`);
    process.exitCode = 1;
  }
}

await main();

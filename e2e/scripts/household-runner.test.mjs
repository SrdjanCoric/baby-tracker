import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import { createRequire } from "node:module";
import test from "node:test";

import babel from "@babel/core";

const require = createRequire(import.meta.url);
const inlineE2EEnv = require("./babel-inline-e2e-env.cjs");

import {
  SLEEP_ACTIVITY,
  assertLocalEndpoint,
  assertMetroProjectRoot,
  getLocalApiRecoveryAction,
  getXcodebuildArgs,
  parseRunnerOptions,
  prepareDatePickerCodegenConfig,
  selectNamedSimulators,
  stopProcessGroup,
} from "./lib/household-runner.mjs";

test("household timer runner accepts loopback endpoints and rejects remote services", () => {
  assert.doesNotThrow(() =>
    assertLocalEndpoint("http://127.0.0.1:54321", "Supabase API")
  );
  assert.doesNotThrow(() =>
    assertLocalEndpoint(
      "postgresql://postgres:postgres@localhost:54322/postgres",
      "database"
    )
  );
  assert.doesNotThrow(() =>
    assertLocalEndpoint("http://[::1]:54321", "Supabase API")
  );
  assert.throws(
    () => assertLocalEndpoint("https://project.supabase.co", "Supabase API"),
    /Refusing to use non-local Supabase API/
  );
});

test("household timer runner uses sleep as its only representative activity", () => {
  assert.deepEqual(SLEEP_ACTIVITY, {
    key: "sleep",
    table: "sleep_sessions",
    card: "sleep-card",
    lockType: "sleep",
  });
});

test("household timer cleanup restores a stopped or paused local API", () => {
  assert.equal(getLocalApiRecoveryAction("running", false), null);
  assert.equal(getLocalApiRecoveryAction("running", true), "unpause");
  assert.equal(getLocalApiRecoveryAction("exited", false), "start");
});

test("E2E dependency preparation removes only the invalid date picker module provider", () => {
  const packageJson = {
    codegenConfig: {
      ios: {
        componentProvider: { RNDatePicker: "RNDatePicker" },
        modulesProvider: { RNDatePicker: "RNDatePickerManager" },
      },
    },
  };

  prepareDatePickerCodegenConfig(packageJson);

  assert.deepEqual(packageJson.codegenConfig.ios, {
    componentProvider: { RNDatePicker: "RNDatePicker" },
  });
  assert.doesNotThrow(() => prepareDatePickerCodegenConfig(packageJson));
});

test("E2E dependency preparation preserves unrelated module providers", () => {
  const packageJson = {
    codegenConfig: {
      ios: {
        modulesProvider: {
          RNDatePicker: "RNDatePickerManager",
          OtherModule: "OtherModuleManager",
        },
      },
    },
  };

  prepareDatePickerCodegenConfig(packageJson);

  assert.deepEqual(packageJson.codegenConfig.ios.modulesProvider, {
    OtherModule: "OtherModuleManager",
  });
});

test("E2E dependency preparation refuses an unknown date picker provider", () => {
  const packageJson = {
    codegenConfig: {
      ios: {
        modulesProvider: { RNDatePicker: "UnexpectedManager" },
      },
    },
  };

  assert.throws(
    () => prepareDatePickerCodegenConfig(packageJson),
    /Unexpected react-native-date-picker module provider/
  );
});

test("E2E Babel transform pins Supabase configuration without changing other environment variables", () => {
  const result = babel.transformSync(
    `
      const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
      const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
      const timerMinimum = process.env.EXPO_PUBLIC_E2E_TIMER_MINIMUM_SECONDS;
      const other = process.env.EXPO_PUBLIC_OTHER;
    `,
    {
      configFile: false,
      plugins: [
        [
          inlineE2EEnv,
          {
            values: {
              EXPO_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54321",
              EXPO_PUBLIC_SUPABASE_ANON_KEY: "local-anon-key",
              EXPO_PUBLIC_E2E_TIMER_MINIMUM_SECONDS: "0",
            },
          },
        ],
      ],
    }
  );

  assert.match(result.code, /"http:\/\/127\.0\.0\.1:54321"/);
  assert.match(result.code, /"local-anon-key"/);
  assert.match(result.code, /timerMinimum = "0"/);
  assert.match(result.code, /process\.env\.EXPO_PUBLIC_OTHER/);
  assert.doesNotMatch(result.code, /process\.env\.EXPO_PUBLIC_SUPABASE/);
});

test("household timer runner refuses to stop Metro for another project", () => {
  assert.doesNotThrow(() =>
    assertMetroProjectRoot("/tmp/baby-tracker", "/tmp/baby-tracker")
  );
  assert.throws(
    () => assertMetroProjectRoot("/tmp/another-app", "/tmp/baby-tracker"),
    /another project/
  );
});

test("household timer runner defaults to fast reuse and makes clean provisioning explicit", () => {
  assert.deepEqual(parseRunnerOptions([]), { cleanEnvironment: false });
  assert.deepEqual(parseRunnerOptions(["--clean"]), { cleanEnvironment: true });
  assert.throws(() => parseRunnerOptions(["--unknown"]), /Unknown runner option/);
});

test("household timer runner builds only the active arm64 simulator architecture", () => {
  const args = getXcodebuildArgs("/tmp/DerivedData", "OWNER-UDID");

  assert.ok(args.includes("ARCHS=arm64"));
  assert.ok(args.includes("ONLY_ACTIVE_ARCH=YES"));
  assert.deepEqual(
    args.slice(args.indexOf("-destination"), args.indexOf("-destination") + 2),
    ["-destination", "platform=iOS Simulator,id=OWNER-UDID"]
  );
});

test("household timer runner escalates Metro shutdown without hanging", async () => {
  const child = new EventEmitter();
  child.pid = 42;
  child.exitCode = null;
  child.unref = () => {
    child.unrefCalled = true;
  };
  const signals = [];

  await stopProcessGroup(
    child,
    (pid, signal) => {
      signals.push([pid, signal]);
    },
    1
  );

  assert.deepEqual(signals, [
    [-42, "SIGTERM"],
    [-42, "SIGKILL"],
  ]);
  assert.equal(child.unrefCalled, true);
});

test("household timer runner addresses two named simulators independently", () => {
  const simulators = selectNamedSimulators(
    {
      devices: {
        "com.apple.CoreSimulator.SimRuntime.iOS-26-5": [
          { name: "SofiBaby Owner", udid: "OWNER-UDID", isAvailable: true },
          { name: "SofiBaby Member", udid: "MEMBER-UDID", isAvailable: true },
        ],
      },
    },
    "com.apple.CoreSimulator.SimRuntime.iOS-26-5",
    ["SofiBaby Owner", "SofiBaby Member"]
  );

  assert.deepEqual(simulators, [
    { name: "SofiBaby Owner", udid: "OWNER-UDID" },
    { name: "SofiBaby Member", udid: "MEMBER-UDID" },
  ]);
});

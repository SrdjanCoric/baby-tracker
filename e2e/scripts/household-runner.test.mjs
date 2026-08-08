import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
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
  assertRemoteSleepCompletion,
  authenticateLocalCaregiver,
  fetchWidgetActivitySnapshot,
  parseRunnerOptions,
  refreshSnapshotBytes,
  selectNamedSimulators,
  stopProcessGroup,
} from "./lib/household-runner.mjs";

test("household timer runner authenticates a caregiver and requests only the selected-baby snapshot", async () => {
  const requests = [];
  const fetchImpl = async (url, options) => {
    requests.push([url, options]);
    if (url.includes("/auth/v1/token")) {
      return {
        ok: true,
        status: 200,
        text: async () => JSON.stringify({ access_token: "owner-token" }),
      };
    }
    return {
      ok: true,
      status: 200,
      text: async () => JSON.stringify({
        schemaVersion: 1,
        babyId: "baby-1",
        activeTimer: null,
        activeTimers: [],
        activities: { sleep: { isActive: false } },
      }),
    };
  };

  const token = await authenticateLocalCaregiver({
    apiUrl: "http://127.0.0.1:54321",
    anonKey: "local-anon",
    email: "owner@test.local",
    password: "password",
    fetchImpl,
  });
  const result = await fetchWidgetActivitySnapshot({
    apiUrl: "http://127.0.0.1:54321",
    anonKey: "local-anon",
    accessToken: token,
    babyId: "baby-1",
    timezone: "UTC",
    fetchImpl,
  });

  assert.equal(requests.length, 2);
  assert.equal(
    requests[1][0],
    "http://127.0.0.1:54321/rest/v1/rpc/get_baby_activity_snapshot"
  );
  assert.deepEqual(JSON.parse(requests[1][1].body), {
    p_baby_id: "baby-1",
    p_timezone: "UTC",
  });
  assert.equal(result.snapshot.babyId, "baby-1");
  assert.deepEqual(JSON.parse(result.bytes.toString("utf8")), result.snapshot);
});

test("household timer runner proves one remote sleep completion summary and preserves bytes on failure", async () => {
  const running = {
    activeTimers: [{ type: "sleep", timerInstanceId: "timer-1" }],
    activities: { sleep: { isActive: true } },
  };
  const completed = {
    activeTimer: null,
    activeTimers: [],
    activities: {
      sleep: {
        isActive: false,
        lastTime: "2026-08-08T10:30:00.000Z",
        lastSleepEndedAt: "2026-08-08T10:30:00.000Z",
        lastDurationMinutes: 30,
        sleepType: "nap",
        todayMinutes: 30,
        napCountToday: 1,
        wakeWindowMinutes: 90,
        wakeWindowSlotLabel: "First",
      },
    },
  };

  assert.doesNotThrow(() => assertRemoteSleepCompletion({
    runningSnapshot: running,
    completedSnapshot: completed,
    completedSleep: {
      startedAt: "2026-08-08T10:00:00.000Z",
      endedAt: "2026-08-08T10:30:00.000Z",
      durationMinutes: 30,
      sleepType: "nap",
    },
  }));

  const retained = Buffer.from(JSON.stringify(running));
  const afterFailure = await refreshSnapshotBytes(retained, async () => {
    throw new Error("forced summary failure");
  });
  assert.strictEqual(afterFailure, retained);
});

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

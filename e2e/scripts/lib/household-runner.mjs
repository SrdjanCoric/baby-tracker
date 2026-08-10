import { Buffer } from "node:buffer";
import { clearTimeout, setTimeout } from "node:timers";
import { URL } from "node:url";

export const SLEEP_ACTIVITY = {
  key: "sleep",
  table: "sleep_sessions",
  card: "sleep-card",
  lockType: "sleep",
};

export const HOUSEHOLD_TIMER_TIMEOUTS = {
  xcodeBuildMs: 3_600_000,
  maestroDriverStartupMs: 1_200_000,
  maestroCommandMs: 1_500_000,
};

export function getLocalApiRecoveryAction(status, isPaused) {
  if (isPaused) return "unpause";
  if (status !== "running") return "start";
  return null;
}

export function parseRunnerOptions(args) {
  const unknownOption = args.find((arg) => arg !== "--clean");
  if (unknownOption) {
    throw new Error(`Unknown runner option: ${unknownOption}`);
  }
  return { cleanEnvironment: args.includes("--clean") };
}

export function selectNamedSimulators(simctlOutput, runtimeIdentifier, names) {
  const runtimeDevices = simctlOutput.devices?.[runtimeIdentifier] ?? [];
  const selected = names.map((name) => {
    const device = runtimeDevices.find(
      (candidate) => candidate.name === name && candidate.isAvailable !== false
    );

    if (!device?.udid) {
      throw new Error(`Simulator is unavailable: ${name}`);
    }

    return { name, udid: device.udid };
  });

  if (new Set(selected.map(({ udid }) => udid)).size !== selected.length) {
    throw new Error("Household timer tests require two distinct simulators");
  }

  return selected;
}

export function getXcodebuildArgs(derivedDataPath, simulatorUdid) {
  return [
    "-workspace",
    "ios/SofiBabyTracker.xcworkspace",
    "-scheme",
    "SofiBabyTracker",
    "-configuration",
    "Debug",
    "-sdk",
    "iphonesimulator",
    "-destination",
    `platform=iOS Simulator,id=${simulatorUdid}`,
    "-derivedDataPath",
    derivedDataPath,
    "ARCHS=arm64",
    "ONLY_ACTIVE_ARCH=YES",
    "build",
  ];
}

function waitForProcessExit(child, timeoutMs) {
  if (child.exitCode !== null) return Promise.resolve(true);

  return new Promise((resolve) => {
    const onExit = () => finish(true);
    const timer = setTimeout(() => finish(false), timeoutMs);

    function finish(exited) {
      clearTimeout(timer);
      child.removeListener("exit", onExit);
      resolve(exited);
    }

    child.once("exit", onExit);
    if (child.exitCode !== null) finish(true);
  });
}

export async function stopProcessGroup(
  child,
  signalProcessGroup = (pid, signal) => process.kill(pid, signal),
  graceMs = 5000
) {
  if (!child?.pid) return;

  try {
    if (child.exitCode !== null) return;

    try {
      signalProcessGroup(-child.pid, "SIGTERM");
    } catch {
      return;
    }

    if (await waitForProcessExit(child, graceMs)) return;

    try {
      signalProcessGroup(-child.pid, "SIGKILL");
    } catch {
      return;
    }

    await waitForProcessExit(child, graceMs);
  } finally {
    child.unref?.();
  }
}

export function assertMetroProjectRoot(actualProjectRoot, expectedProjectRoot) {
  if (actualProjectRoot !== expectedProjectRoot) {
    throw new Error(
      `Port 8081 is serving another project: ${actualProjectRoot || "unknown"}`
    );
  }
}

export function assertLocalEndpoint(value, label) {
  let hostname;

  try {
    hostname = new URL(value).hostname;
  } catch {
    throw new Error(`Invalid ${label}: ${value || "missing"}`);
  }

  if (
    hostname !== "127.0.0.1" &&
    hostname !== "localhost" &&
    hostname !== "[::1]"
  ) {
    throw new Error(`Refusing to use non-local ${label}: ${value}`);
  }
}

async function readSuccessfulJson(response, label) {
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`${label} failed with status ${response.status}`);
  }
  try {
    return { bytes: Buffer.from(body), value: JSON.parse(body) };
  } catch {
    throw new Error(`${label} returned invalid JSON`);
  }
}

export async function authenticateLocalCaregiver({
  apiUrl,
  anonKey,
  email,
  password,
  fetchImpl = fetch,
}) {
  assertLocalEndpoint(apiUrl, "Supabase API");
  const response = await fetchImpl(
    `${apiUrl}/auth/v1/token?grant_type=password`,
    {
      method: "POST",
      headers: {
        apikey: anonKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    }
  );
  const { value } = await readSuccessfulJson(response, "caregiver authentication");
  if (typeof value.access_token !== "string" || value.access_token.length === 0) {
    throw new Error("caregiver authentication returned no access token");
  }
  return value.access_token;
}

export async function fetchWidgetActivitySnapshot({
  apiUrl,
  anonKey,
  accessToken,
  babyId,
  timezone,
  fetchImpl = fetch,
}) {
  assertLocalEndpoint(apiUrl, "Supabase API");
  const response = await fetchImpl(
    `${apiUrl}/rest/v1/rpc/get_baby_activity_snapshot`,
    {
      method: "POST",
      headers: {
        apikey: anonKey,
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        p_baby_id: babyId,
        p_timezone: timezone,
      }),
    }
  );
  const { bytes, value } = await readSuccessfulJson(response, "Widget summary request");
  if (!value || typeof value !== "object" || value.babyId !== babyId) {
    throw new Error("Widget summary returned the wrong selected baby");
  }
  return { bytes, snapshot: value };
}

export function assertRemoteSleepCompletion({
  runningSnapshot,
  completedSnapshot,
  completedSleep,
}) {
  const runningTimers = runningSnapshot?.activeTimers;
  const completedTimers = completedSnapshot?.activeTimers;
  const runningSleep = runningSnapshot?.activities?.sleep;
  const completedSummary = completedSnapshot?.activities?.sleep;

  if (!Array.isArray(runningTimers)
    || !runningTimers.some((timer) => timer?.type === "sleep")
    || runningSleep?.isActive !== true) {
    throw new Error("Owner snapshot did not cache the running sleep base");
  }
  if (!Array.isArray(completedTimers)
    || completedTimers.some((timer) => timer?.type === "sleep")
    || completedSnapshot.activeTimer?.type === "sleep"
    || completedSummary?.isActive !== false) {
    throw new Error("Completed Widget summary retained the sleep timer");
  }

  const expected = {
    lastTime: completedSleep.endedAt,
    lastSleepEndedAt: completedSleep.endedAt,
    lastDurationMinutes: completedSleep.durationMinutes,
    sleepType: completedSleep.sleepType,
  };
  for (const [field, value] of Object.entries(expected)) {
    if (completedSummary[field] !== value) {
      throw new Error(
        `Completed Widget sleep ${field} mismatch: expected ${value}, received ${completedSummary[field]}`
      );
    }
  }
  if (!Number.isFinite(completedSummary.todayMinutes)
    || completedSummary.todayMinutes < completedSleep.durationMinutes) {
    throw new Error("Completed Widget sleep total is invalid");
  }
  if (runningSleep.napCountToday !== 0
    || runningSleep.wakeWindowMinutes !== 90
    || runningSleep.wakeWindowSlotLabel !== "First"
    || completedSummary.napCountToday !== 1
    || completedSummary.wakeWindowMinutes !== 120
    || completedSummary.wakeWindowSlotLabel !== "Second") {
    throw new Error("Completed Widget nap count or wake-window state did not advance coherently");
  }
}

export function watchTimerFingerprint(timers) {
  if (!Array.isArray(timers)) return "[]";
  return JSON.stringify(timers.map((timer) => ({
    type: timer?.type ?? null,
    startTime: timer?.startTime ?? null,
    timerInstanceId: timer?.timerInstanceId ?? null,
    context: timer?.isRemote === true ? null : (timer?.context ?? null),
    isRemote: timer?.isRemote === true,
    isPaused: timer?.isPaused === true,
    accumulatedSeconds: timer?.accumulatedSeconds ?? null,
  })).sort((left, right) => {
    const leftKey = `${left.timerInstanceId ?? left.type}|${left.type}`;
    const rightKey = `${right.timerInstanceId ?? right.type}|${right.type}`;
    return leftKey.localeCompare(rightKey);
  }));
}

export function reconcileWatchTimerProbe({ base, fingerprint, fullSummary }) {
  const baseFingerprint = watchTimerFingerprint(base?.activeTimers);
  if (fingerprint === baseFingerprint) return base;
  if (!fullSummary
    || fullSummary.schemaVersion !== 1
    || fullSummary.babyId !== base?.babyId
    || watchTimerFingerprint(fullSummary.activeTimers) !== fingerprint) {
    return base;
  }
  return fullSummary;
}

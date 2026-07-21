import { clearTimeout, setTimeout } from "node:timers";
import { URL } from "node:url";

export const SLEEP_ACTIVITY = {
  key: "sleep",
  table: "sleep_sessions",
  card: "sleep-card",
  lockType: "sleep",
};

export function parseRunnerOptions(args) {
  const unknownOption = args.find((arg) => arg !== "--clean");
  if (unknownOption) {
    throw new Error(`Unknown runner option: ${unknownOption}`);
  }
  return { cleanEnvironment: args.includes("--clean") };
}

export function prepareDatePickerCodegenConfig(packageJson) {
  const iosCodegen = packageJson.codegenConfig?.ios;
  const provider = iosCodegen?.modulesProvider?.RNDatePicker;

  if (provider === undefined) return;
  if (provider !== "RNDatePickerManager") {
    throw new Error(
      `Unexpected react-native-date-picker module provider: ${provider}`
    );
  }

  delete iosCodegen.modulesProvider.RNDatePicker;
  if (Object.keys(iosCodegen.modulesProvider).length === 0) {
    delete iosCodegen.modulesProvider;
  }
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

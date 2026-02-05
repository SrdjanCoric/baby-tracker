import { Platform, NativeModules } from "react-native";

export type TimerActivityType = "feeding" | "sleep" | "pumping" | "tummyTime";
export type BreastSide = "left" | "right" | "both";
export type SleepType = "nap" | "night";

const LIVE_ACTIVITY_CHECK_TIMEOUT_MS = 3000;
const LIVE_ACTIVITY_START_TIMEOUT_MS = 5000;

function withTimeout<T>(promise: Promise<T>, timeoutMs: number, fallbackValue: T): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((resolve) => {
      setTimeout(() => resolve(fallbackValue), timeoutMs);
    }),
  ]);
}

interface LiveActivityControllerModule {
  startTimerActivity(
    activityType: string,
    babyName: string,
    context: string | null
  ): Promise<string | null>;
  updateTimerActivity(
    activityId: string,
    context: string | null
  ): Promise<boolean>;
  endTimerActivity(activityId: string): Promise<boolean>;
  endAllActivities(): Promise<void>;
  endActivityByType(activityType: string): Promise<boolean>;
  isActivityRunning(activityId: string): Promise<boolean>;
}

function getLiveActivityModule(): LiveActivityControllerModule | null {
  if (Platform.OS !== "ios") {
    return null;
  }

  const module = NativeModules.LiveActivityController as
    | LiveActivityControllerModule
    | undefined;

  if (!module) {
    return null;
  }

  return module;
}

export async function startTimerLiveActivity(
  activityType: TimerActivityType,
  babyName: string,
  context?: BreastSide | SleepType
): Promise<string | null> {
  const module = getLiveActivityModule();
  if (!module) {
    return null;
  }

  try {
    const activityId = await module.startTimerActivity(
      activityType,
      babyName,
      context ?? null
    );
    return activityId;
  } catch (error) {
    console.error("[LiveActivity] Failed to start:", error);
    return null;
  }
}

export async function updateTimerLiveActivity(
  activityId: string,
  context?: BreastSide | SleepType
): Promise<boolean> {
  const module = getLiveActivityModule();
  if (!module) {
    return false;
  }

  try {
    const success = await module.updateTimerActivity(activityId, context ?? null);
    return success;
  } catch (error) {
    console.error("[LiveActivity] Failed to update:", error);
    return false;
  }
}

export async function endTimerLiveActivity(activityId: string): Promise<boolean> {
  const module = getLiveActivityModule();
  if (!module) {
    return false;
  }

  try {
    const success = await module.endTimerActivity(activityId);
    return success;
  } catch (error) {
    console.error("[LiveActivity] Failed to end:", error);
    return false;
  }
}

export async function endAllLiveActivities(): Promise<void> {
  const module = getLiveActivityModule();
  if (!module) {
    return;
  }

  try {
    await module.endAllActivities();
  } catch (error) {
    console.error("[LiveActivity] Failed to end all:", error);
  }
}

export async function endLiveActivityByType(activityType: TimerActivityType): Promise<boolean> {
  const module = getLiveActivityModule();
  if (!module) {
    return false;
  }

  try {
    const ended = await module.endActivityByType(activityType);
    return ended;
  } catch (error) {
    console.error("[LiveActivity] Failed to end by type:", error);
    return false;
  }
}

export function isLiveActivitySupported(): boolean {
  return Platform.OS === "ios" && parseInt(Platform.Version as string, 10) >= 16;
}

export async function isLiveActivityRunning(activityId: string): Promise<boolean> {
  const module = getLiveActivityModule();
  if (!module) {
    return false;
  }

  try {
    const isRunning = await module.isActivityRunning(activityId);
    return isRunning;
  } catch (error) {
    console.error("[LiveActivity] Failed to check activity status:", error);
    return false;
  }
}

export async function isLiveActivityRunningWithTimeout(activityId: string): Promise<boolean> {
  return withTimeout(
    isLiveActivityRunning(activityId),
    LIVE_ACTIVITY_CHECK_TIMEOUT_MS,
    false
  );
}

export async function startTimerLiveActivityWithTimeout(
  activityType: TimerActivityType,
  babyName: string,
  context?: BreastSide | SleepType
): Promise<string | null> {
  return withTimeout(
    startTimerLiveActivity(activityType, babyName, context),
    LIVE_ACTIVITY_START_TIMEOUT_MS,
    null
  );
}

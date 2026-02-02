import { Platform, NativeModules } from "react-native";

export type TimerActivityType = "feeding" | "sleep" | "pumping" | "tummyTime";
export type BreastSide = "left" | "right" | "both";
export type SleepType = "nap" | "night";

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
}

function getLiveActivityModule(): LiveActivityControllerModule | null {
  if (Platform.OS !== "ios") {
    return null;
  }

  const module = NativeModules.LiveActivityController as
    | LiveActivityControllerModule
    | undefined;

  if (!module) {
    console.log("[LiveActivity] Native module not available");
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
    console.log("[LiveActivity] Started:", activityId);
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
    console.log("[LiveActivity] Updated:", activityId, success);
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
    console.log("[LiveActivity] Ended:", activityId, success);
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
    console.log("[LiveActivity] Ended all activities");
  } catch (error) {
    console.error("[LiveActivity] Failed to end all:", error);
  }
}

export function isLiveActivitySupported(): boolean {
  return Platform.OS === "ios" && parseInt(Platform.Version as string, 10) >= 16;
}

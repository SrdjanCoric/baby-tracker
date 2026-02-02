import { Platform, NativeModules } from "react-native";
import type { TimerActivityType, BreastSide, SleepType } from "@/constants/activities";

interface LiveActivityController {
  startTimerActivity: (
    activityType: string,
    babyName: string,
    context?: string
  ) => Promise<string | null>;
  updateTimerActivity: (
    activityId: string,
    context?: string
  ) => Promise<boolean>;
  endTimerActivity: (activityId: string) => Promise<boolean>;
  endAllActivities: () => Promise<void>;
}

let liveActivityModule: LiveActivityController | null = null;

async function getLiveActivityModule(): Promise<LiveActivityController | null> {
  if (Platform.OS !== "ios") {
    return null;
  }

  if (liveActivityModule) {
    return liveActivityModule;
  }

  try {
    const module = NativeModules.LiveActivityController as LiveActivityController | undefined;
    if (module) {
      liveActivityModule = module;
      return liveActivityModule;
    }
  } catch (error) {
    console.log("[LiveActivityService] Native module not available:", error);
  }

  return null;
}

export async function startTimerLiveActivity(
  activityType: TimerActivityType,
  babyName: string,
  context?: BreastSide | SleepType
): Promise<string | null> {
  const module = await getLiveActivityModule();
  if (!module) {
    return null;
  }

  try {
    const activityId = await module.startTimerActivity(activityType, babyName, context);
    console.log("[LiveActivityService] Started activity:", activityId);
    return activityId;
  } catch (error) {
    console.error("[LiveActivityService] Failed to start activity:", error);
    return null;
  }
}

export async function updateTimerLiveActivity(
  activityId: string,
  context?: BreastSide | SleepType
): Promise<boolean> {
  const module = await getLiveActivityModule();
  if (!module) {
    return false;
  }

  try {
    const success = await module.updateTimerActivity(activityId, context);
    console.log("[LiveActivityService] Updated activity:", activityId, success);
    return success;
  } catch (error) {
    console.error("[LiveActivityService] Failed to update activity:", error);
    return false;
  }
}

export async function endTimerLiveActivity(activityId: string): Promise<boolean> {
  const module = await getLiveActivityModule();
  if (!module) {
    return false;
  }

  try {
    const success = await module.endTimerActivity(activityId);
    console.log("[LiveActivityService] Ended activity:", activityId, success);
    return success;
  } catch (error) {
    console.error("[LiveActivityService] Failed to end activity:", error);
    return false;
  }
}

export async function endAllLiveActivities(): Promise<void> {
  const module = await getLiveActivityModule();
  if (!module) {
    return;
  }

  try {
    await module.endAllActivities();
    console.log("[LiveActivityService] Ended all activities");
  } catch (error) {
    console.error("[LiveActivityService] Failed to end all activities:", error);
  }
}

export function isLiveActivitySupported(): boolean {
  return Platform.OS === "ios" && parseInt(Platform.Version as string, 10) >= 16;
}

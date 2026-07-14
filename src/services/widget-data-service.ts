import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import type { ActivityType, BreastSide, DiaperType, SleepType } from "@/constants/activities";

const APP_GROUP = "group.com.sofibaby.app";
const WIDGET_DATA_KEY = "@widget_data";
const WIDGET_CONFIG_KEY = "@widget_config";

export interface WidgetActivityData {
  feeding: {
    lastTime: string | null;
    todayCount: number;
    lastType: string | null;
    lastSide: BreastSide | null;
  };
  sleep: {
    lastTime: string | null;
    todayMinutes: number;
    goalMinutes: number;
    lastDurationMinutes: number | null;
    isActive: boolean;
    sleepType: SleepType | null;
    wakeWindowMinutes: number | null;
    wakeWindowSlotLabel: string | null;
    lastSleepEndedAt: string | null;
    napCountToday: number;
  };
  diaper: {
    lastTime: string | null;
    todayCounts: { wet: number; dirty: number; mixed: number; dry: number };
    lastType: DiaperType | null;
  };
  pumping: {
    lastTime: string | null;
    todayVolumeMl: number;
    sessionCount: number;
    lastSide: BreastSide | null;
  };
  growth: {
    lastMeasurement: {
      date: string;
      weightKg?: number;
      heightCm?: number;
      headCircumferenceCm?: number;
    } | null;
  };
  tummyTime: {
    lastTime: string | null;
    todayMinutes: number;
    goalMinutes: number;
    lastDurationMinutes: number | null;
  };
}

export interface ActiveTimerData {
  type: "feeding" | "pumping" | "sleep" | "tummyTime";
  startTime: string;
  context?: string;
  isRemote?: boolean;
  isPaused?: boolean;
  accumulatedSeconds?: number;
}

export interface WidgetData {
  babyId: string;
  babyName: string;
  activities: WidgetActivityData;
  activeTimer: ActiveTimerData | null;
  activeTimers: ActiveTimerData[];
  updatedAt: string;
}

export interface BabyWatchData {
  id: string;
  name: string;
  activities: WidgetActivityData;
  activeTimers: ActiveTimerData[];
}

export interface WatchData {
  babies: BabyWatchData[];
  selectedBabyId: string;
  updatedAt: string;
}

export interface WidgetConfiguration {
  smallWidgetActivity: ActivityType;
  quickLogActivities: [ActivityType, ActivityType, ActivityType, ActivityType];
  summaryActivities: [ActivityType, ActivityType, ActivityType, ActivityType];
  lockScreenActivities: ActivityType[];
  watchActivities: [ActivityType, ActivityType, ActivityType, ActivityType];
}

const DEFAULT_WIDGET_CONFIG: WidgetConfiguration = {
  smallWidgetActivity: "feeding",
  quickLogActivities: ["feeding", "sleep", "diaper", "pumping"],
  summaryActivities: ["feeding", "sleep", "diaper", "pumping"],
  lockScreenActivities: ["feeding", "sleep"],
  watchActivities: ["feeding", "sleep", "diaper", "pumping"],
};

const DEFAULT_WIDGET_ACTIVITY_DATA: WidgetActivityData = {
  feeding: {
    lastTime: null,
    todayCount: 0,
    lastType: null,
    lastSide: null,
  },
  sleep: {
    lastTime: null,
    todayMinutes: 0,
    goalMinutes: 0,
    lastDurationMinutes: null,
    isActive: false,
    sleepType: null,
    wakeWindowMinutes: null,
    wakeWindowSlotLabel: null,
    lastSleepEndedAt: null,
    napCountToday: 0,
  },
  diaper: {
    lastTime: null,
    todayCounts: { wet: 0, dirty: 0, mixed: 0, dry: 0 },
    lastType: null,
  },
  pumping: {
    lastTime: null,
    todayVolumeMl: 0,
    sessionCount: 0,
    lastSide: null,
  },
  growth: {
    lastMeasurement: null,
  },
  tummyTime: {
    lastTime: null,
    todayMinutes: 0,
    goalMinutes: 30,
    lastDurationMinutes: null,
  },
};

let ExtensionStorageModule: {
  set: (key: string, value: string, groupId: string) => Promise<void>;
  get: (key: string, groupId: string) => Promise<string | null>;
  reloadWidget: () => Promise<void>;
} | null = null;

async function loadExtensionStorage(): Promise<typeof ExtensionStorageModule> {
  if (Platform.OS !== "ios") {
    return null;
  }

  if (ExtensionStorageModule) {
    return ExtensionStorageModule;
  }

  try {
    const appleTargets = await import("@bacons/apple-targets");
    if (appleTargets.ExtensionStorage) {
      ExtensionStorageModule = {
        set: async (key: string, value: string, groupId: string) => {
          const storage = new appleTargets.ExtensionStorage(groupId);
          await storage.set(key, value);
        },
        get: async (key: string, groupId: string) => {
          const storage = new appleTargets.ExtensionStorage(groupId);
          return storage.get(key);
        },
        reloadWidget: async () => {
          await appleTargets.ExtensionStorage.reloadWidget();
        },
      };
      return ExtensionStorageModule;
    }
  } catch (error) {
    console.log("[WidgetDataService] ExtensionStorage not available:", error);
  }

  return null;
}

export interface WatchAuthContext {
  supabaseUrl: string;
  supabaseAnonKey: string;
  accessToken: string;
  userId: string;
  liveActivityPushToken?: string;
  pushToStartToken?: string;
}

export async function updateWidgetData(data: WidgetData, authContext?: WatchAuthContext): Promise<void> {
  const jsonData = JSON.stringify(data);

  await AsyncStorage.setItem(WIDGET_DATA_KEY, jsonData);

  if (Platform.OS === "ios") {
    try {
      const extensionStorage = await loadExtensionStorage();
      if (extensionStorage) {
        await extensionStorage.set("widgetData", jsonData, APP_GROUP);
        await extensionStorage.reloadWidget();
      }
    } catch (error) {
      console.error("[WidgetDataService] Failed to update widget data:", error);
    }

    try {
      const { syncToWatch } = await import("./watch-service");
      const watchData: WatchData = {
        babies: [
          {
            id: data.babyId,
            name: data.babyName,
            activities: data.activities,
            activeTimers: data.activeTimers,
          },
        ],
        selectedBabyId: data.babyId,
        updatedAt: data.updatedAt,
      };
      await syncToWatch(data, watchData, authContext);
    } catch (error) {
      console.error("[WidgetDataService] Failed to sync to watch:", error);
    }
  }
}

export async function getWidgetData(): Promise<WidgetData | null> {
  try {
    const jsonData = await AsyncStorage.getItem(WIDGET_DATA_KEY);
    if (jsonData) {
      return JSON.parse(jsonData);
    }
  } catch (error) {
    console.error("[WidgetDataService] Failed to get widget data:", error);
  }
  return null;
}

export async function getWidgetConfiguration(): Promise<WidgetConfiguration> {
  try {
    const jsonData = await AsyncStorage.getItem(WIDGET_CONFIG_KEY);
    if (jsonData) {
      return { ...DEFAULT_WIDGET_CONFIG, ...JSON.parse(jsonData) };
    }
  } catch (error) {
    console.error("[WidgetDataService] Failed to get widget config:", error);
  }
  return DEFAULT_WIDGET_CONFIG;
}

export async function saveWidgetConfiguration(
  config: Partial<WidgetConfiguration>
): Promise<void> {
  try {
    const currentConfig = await getWidgetConfiguration();
    const newConfig = { ...currentConfig, ...config };
    const jsonData = JSON.stringify(newConfig);

    await AsyncStorage.setItem(WIDGET_CONFIG_KEY, jsonData);

    if (Platform.OS === "ios") {
      const extensionStorage = await loadExtensionStorage();
      if (extensionStorage) {
        await extensionStorage.set("widgetConfig", jsonData, APP_GROUP);
        await extensionStorage.reloadWidget();
      }
    }
  } catch (error) {
    console.error("[WidgetDataService] Failed to save widget config:", error);
  }
}

export function createEmptyWidgetData(babyId: string, babyName: string): WidgetData {
  return {
    babyId,
    babyName,
    activities: DEFAULT_WIDGET_ACTIVITY_DATA,
    activeTimer: null,
    activeTimers: [],
    updatedAt: new Date().toISOString(),
  };
}

export function updateFeedingWidgetData(
  current: WidgetActivityData,
  lastTime: string | null,
  todayCount: number,
  lastType: string | null,
  lastSide: BreastSide | null
): WidgetActivityData {
  return {
    ...current,
    feeding: {
      lastTime,
      todayCount,
      lastType,
      lastSide,
    },
  };
}

export function updateSleepWidgetData(
  current: WidgetActivityData,
  lastTime: string | null,
  todayMinutes: number,
  goalMinutes: number,
  lastDurationMinutes: number | null,
  isActive: boolean,
  sleepType: SleepType | null,
  wakeWindowMinutes: number | null = null,
  wakeWindowSlotLabel: string | null = null,
  lastSleepEndedAt: string | null = null,
  napCountToday: number = 0
): WidgetActivityData {
  return {
    ...current,
    sleep: {
      lastTime,
      todayMinutes,
      goalMinutes,
      lastDurationMinutes,
      isActive,
      sleepType,
      wakeWindowMinutes,
      wakeWindowSlotLabel,
      lastSleepEndedAt,
      napCountToday,
    },
  };
}

export function updateDiaperWidgetData(
  current: WidgetActivityData,
  lastTime: string | null,
  todayCounts: { wet: number; dirty: number; mixed: number; dry: number },
  lastType: DiaperType | null
): WidgetActivityData {
  return {
    ...current,
    diaper: {
      lastTime,
      todayCounts,
      lastType,
    },
  };
}

export function updatePumpingWidgetData(
  current: WidgetActivityData,
  lastTime: string | null,
  todayVolumeMl: number,
  sessionCount: number,
  lastSide: BreastSide | null
): WidgetActivityData {
  return {
    ...current,
    pumping: {
      lastTime,
      todayVolumeMl,
      sessionCount,
      lastSide,
    },
  };
}

export function updateGrowthWidgetData(
  current: WidgetActivityData,
  lastMeasurement: WidgetActivityData["growth"]["lastMeasurement"]
): WidgetActivityData {
  return {
    ...current,
    growth: {
      lastMeasurement,
    },
  };
}

export function updateTummyTimeWidgetData(
  current: WidgetActivityData,
  lastTime: string | null,
  todayMinutes: number,
  goalMinutes: number,
  lastDurationMinutes: number | null
): WidgetActivityData {
  return {
    ...current,
    tummyTime: {
      lastTime,
      todayMinutes,
      goalMinutes,
      lastDurationMinutes,
    },
  };
}

export async function reloadWidgets(): Promise<void> {
  if (Platform.OS !== "ios") return;

  try {
    const extensionStorage = await loadExtensionStorage();
    if (extensionStorage) {
      await extensionStorage.reloadWidget();
    }
  } catch (error) {
    console.error("[WidgetDataService] Failed to reload widgets:", error);
  }
}

export async function writeSupabaseConfigToAppGroup(
  supabaseUrl: string,
  supabaseAnonKey: string
): Promise<void> {
  if (Platform.OS !== "ios") return;
  try {
    const extensionStorage = await loadExtensionStorage();
    if (extensionStorage) {
      await extensionStorage.set("supabaseUrl", supabaseUrl, APP_GROUP);
      await extensionStorage.set("supabaseAnonKey", supabaseAnonKey, APP_GROUP);
    }
  } catch (error) {
    console.error("[WidgetDataService] Failed to write Supabase config to App Group:", error);
  }
}

export async function writeAuthToAppGroup(params: {
  supabaseUrl: string;
  supabaseAnonKey: string;
  accessToken: string;
  userId: string;
  selectedBabyId: string;
}): Promise<void> {
  if (Platform.OS !== "ios") return;

  try {
    const extensionStorage = await loadExtensionStorage();
    if (extensionStorage) {
      await extensionStorage.set("supabaseUrl", params.supabaseUrl, APP_GROUP);
      await extensionStorage.set("supabaseAnonKey", params.supabaseAnonKey, APP_GROUP);
      await extensionStorage.set("supabaseAccessToken", params.accessToken, APP_GROUP);
      await extensionStorage.set("userId", params.userId, APP_GROUP);
      await extensionStorage.set("selectedBabyId", params.selectedBabyId, APP_GROUP);
    }
  } catch (error) {
    console.error("[WidgetDataService] Failed to write auth to App Group:", error);
  }
}

export async function readWidgetPushToken(): Promise<string | null> {
  if (Platform.OS !== "ios") return null;

  try {
    const extensionStorage = await loadExtensionStorage();
    if (extensionStorage) {
      return await extensionStorage.get("widgetPushToken", APP_GROUP);
    }
  } catch (error) {
    console.error("[WidgetDataService] Failed to read widget push token:", error);
  }
  return null;
}

export async function readLiveActivityPushToken(): Promise<string | null> {
  if (Platform.OS !== "ios") return null;

  try {
    const extensionStorage = await loadExtensionStorage();
    if (extensionStorage) {
      return await extensionStorage.get("liveActivityPushToken", APP_GROUP);
    }
  } catch (error) {
    console.error("[WidgetDataService] Failed to read live activity push token:", error);
  }
  return null;
}

export async function readPushToStartToken(): Promise<string | null> {
  if (Platform.OS !== "ios") return null;

  try {
    const extensionStorage = await loadExtensionStorage();
    if (extensionStorage) {
      const token = await extensionStorage.get("pushToStartToken", APP_GROUP);
      console.log("[WidgetDataService] readPushToStartToken:", token ? `${token.substring(0, 12)}...` : "null");
      return token;
    }
  } catch (error) {
    console.error("[WidgetDataService] Failed to read push-to-start token:", error);
  }
  return null;
}

export interface PendingWidgetStop {
  activityType: string;
  stoppedAt: string;
  babyId?: string;
}

export async function readPendingWidgetStop(): Promise<PendingWidgetStop | null> {
  if (Platform.OS !== "ios") return null;
  try {
    const extensionStorage = await loadExtensionStorage();
    if (!extensionStorage) return null;
    const raw = await extensionStorage.get("pendingWidgetStop", APP_GROUP);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}


export async function readPendingWidgetPauseToggle(): Promise<{
  activityType: string;
  action: "pause" | "resume";
  pausedAt?: string;
  accumulatedSeconds?: number;
  resumedAt?: string;
  pauseDurationMs?: number;
} | null> {
  if (Platform.OS !== "ios") return null;
  try {
    const extensionStorage = await loadExtensionStorage();
    if (!extensionStorage) return null;
    const raw = await extensionStorage.get("pendingWidgetPauseToggle", APP_GROUP);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export async function clearPendingWidgetPauseToggle(): Promise<void> {
  if (Platform.OS !== "ios") return;
  try {
    const extensionStorage = await loadExtensionStorage();
    if (extensionStorage) {
      await extensionStorage.set("pendingWidgetPauseToggle", "", APP_GROUP);
    }
  } catch (_) { /* best-effort cleanup */ }
}

export async function clearPendingWidgetStop(expected?: PendingWidgetStop): Promise<void> {
  if (Platform.OS !== "ios") return;
  try {
    const extensionStorage = await loadExtensionStorage();
    if (!extensionStorage) return;

    if (expected) {
      const raw = await extensionStorage.get("pendingWidgetStop", APP_GROUP);
      if (!raw) return;
      const current = JSON.parse(raw) as PendingWidgetStop;
      if (
        current.activityType !== expected.activityType ||
        current.stoppedAt !== expected.stoppedAt ||
        current.babyId !== expected.babyId
      ) {
        return;
      }
    }

    await extensionStorage.set("pendingWidgetStop", "", APP_GROUP);
  } catch {
    // Best-effort cleanup. A failed clear leaves the idempotent command for the next pass.
  }
}

export async function clearWidgetData(): Promise<void> {
  try {
    await AsyncStorage.removeItem(WIDGET_DATA_KEY);

    if (Platform.OS === "ios") {
      const extensionStorage = await loadExtensionStorage();
      if (extensionStorage) {
        await extensionStorage.set("widgetData", "", APP_GROUP);
        await extensionStorage.reloadWidget();
      }
    }
  } catch (error) {
    console.error("[WidgetDataService] Failed to clear widget data:", error);
  }
}


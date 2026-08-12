import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";
import type { ActivityType, BreastSide, DiaperType, SleepType } from "@/constants/activities";
import { loadExtensionStorage } from "@/services/extension-storage";
import { loadSharedSupabaseSessionBridge } from "@/services/shared-supabase-session-native";
import {
  decodeWidgetActivitySnapshotJson,
  type ActiveTimerData,
  type WidgetActivityData,
  type WidgetData,
} from "@/services/widget-activity-snapshot";

export type {
  ActiveTimerData,
  WidgetActivityData,
  WidgetData,
} from "@/services/widget-activity-snapshot";

const APP_GROUP = "group.com.sofibaby.app";
const WIDGET_DATA_KEY = "@widget_data";
const WIDGET_CONFIG_KEY = "@widget_config";
const WIDGET_DATA_ORPHANED_KEY = "widgetDataOrphaned";
const LEGACY_APP_GROUP_ACCESS_TOKEN_KEY = "supabaseAccessToken";
const SHARED_SESSION_FIRST_LAUNCH_PURGE_MARKER_KEY =
  "sharedSessionFirstLaunchPurgeDone";

/**
 * Purge the legacy bearer access token that previous versions wrote to App
 * Group `UserDefaults`. This task moved the access token out of App Group
 * `UserDefaults` (the write was removed in this change), but existing installs
 * still carry the old token in the shared (and iTunes/Finder-backup-included)
 * plist until it is explicitly deleted. The previous version only cleaned the
 * key on sign-out, so every upgrade that never signs out kept a live JWT in
 * unencrypted shared storage readable by every target. This purge runs
 * unconditionally on each iOS app start (best-effort; `remove` on a missing
 * key is a no-op) and converges every install to the AC of "no bearer token
 * in App Group `UserDefaults`". Intentionally ordered AFTER the auth session
 * migration (`supabase.auth.getSession()`) so the widget's legacy-token
 * fallback (see TR-4) is only taken between app update and first app launch;
 * once the app has launched once the Keychain capsule is the source of truth
 * and the legacy token is gone.
 */
export async function purgeLegacyAppGroupAccessToken(): Promise<void> {
  if (Platform.OS !== "ios") return;
  try {
    const extensionStorage = await loadExtensionStorage();
    if (!extensionStorage) return;
    await extensionStorage.remove(LEGACY_APP_GROUP_ACCESS_TOKEN_KEY, APP_GROUP);
  } catch (error) {
    console.warn(
      "[WidgetDataService] legacy App Group access token purge failed:",
      error
    );
  }
}

/**
 * Delete a Keychain capsule left by a previous owner after an app uninstall.
 * iOS keeps `kSecClassGenericPassword` items across uninstall (only a full
 * device erase clears them), so a freshly reinstalled copy of the app would
 * otherwise read a capsule written by the prior owner and silently restore
 * their session — including a refresh_token that never expires by default.
 * This purge runs once, on the first launch after a fresh install that has no
 * AsyncStorage marker (the marker is destroyed with the app container on
 * uninstall, matching the lifecycle requirement). It removes the capsule via
 * the native bridge before the Supabase client loads the session, then writes
 * the marker so subsequent launches of the same install never purge a
 * legitimate session.
 */
export async function purgeStaleSharedSessionOnFirstLaunch(): Promise<void> {
  if (Platform.OS !== "ios") return;
  try {
    const marker = await AsyncStorage.getItem(
      SHARED_SESSION_FIRST_LAUNCH_PURGE_MARKER_KEY
    );
    if (marker === "1") return;
    const bridge = loadSharedSupabaseSessionBridge();
    if (bridge) {
      await bridge.removeSession();
    }
    await AsyncStorage.setItem(
      SHARED_SESSION_FIRST_LAUNCH_PURGE_MARKER_KEY,
      "1"
    );
  } catch (error) {
    console.warn(
      "[WidgetDataService] first-launch shared session purge failed:",
      error
    );
  }
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
  localAsOf?: string;
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
    morningConfirmationPending: false,
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

export interface WatchAuthContext {
  supabaseUrl: string;
  supabaseAnonKey: string;
  accessToken: string;
  userId: string;
  householdId?: string;
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
        await extensionStorage.set(`widgetSnapshot.${data.babyId}`, jsonData, APP_GROUP);
        const snapshotBabyIdsJson = await extensionStorage.get("widgetSnapshotBabyIds", APP_GROUP);
        let snapshotBabyIds: string[] = [];
        try {
          const parsed = snapshotBabyIdsJson ? JSON.parse(snapshotBabyIdsJson) : [];
          if (Array.isArray(parsed)) {
            snapshotBabyIds = parsed.filter((value): value is string => typeof value === "string");
          }
        } catch {
          snapshotBabyIds = [];
        }
        const registeredBabyIds = [...new Set([...snapshotBabyIds, data.babyId])].sort();
        await extensionStorage.set(
          "widgetSnapshotBabyIds",
          JSON.stringify(registeredBabyIds),
          APP_GROUP
        );
        // Fresh app-written data is live, so clear any sign-out lineage marker so
        // accountless running timers render on the widget instead of being stripped.
        await extensionStorage.remove(WIDGET_DATA_ORPHANED_KEY, APP_GROUP);
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
        localAsOf: data.localAsOf,
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
      return decodeWidgetActivitySnapshotJson(jsonData)?.data ?? null;
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
  napCountToday: number = 0,
  morningConfirmationPending: boolean = false
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
      morningConfirmationPending,
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
  timezone: string;
  newbornNapOptIn: boolean;
}): Promise<void> {
  if (Platform.OS !== "ios") return;

  try {
    const extensionStorage = await loadExtensionStorage();
    if (extensionStorage) {
      await extensionStorage.set("supabaseUrl", params.supabaseUrl, APP_GROUP);
      await extensionStorage.set("supabaseAnonKey", params.supabaseAnonKey, APP_GROUP);
      await extensionStorage.set("userId", params.userId, APP_GROUP);
      await extensionStorage.set("selectedBabyId", params.selectedBabyId, APP_GROUP);
      await extensionStorage.set("widgetTimezone", params.timezone, APP_GROUP);
      await extensionStorage.set(
        `widgetNewbornNapOptIn.${params.selectedBabyId}`,
        String(params.newbornNapOptIn),
        APP_GROUP
      );
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
  } catch { /* best-effort cleanup */ }
}

export async function clearWidgetData(
  options: { preserveLocalCache?: boolean } = {}
): Promise<void> {
  try {
    await AsyncStorage.removeItem(WIDGET_DATA_KEY);

    if (Platform.OS === "ios") {
      const extensionStorage = await loadExtensionStorage();
      if (extensionStorage) {
        const [selectedBabyId, snapshotBabyIdsJson] = await Promise.all([
          extensionStorage.get("selectedBabyId", APP_GROUP),
          extensionStorage.get("widgetSnapshotBabyIds", APP_GROUP),
        ]);
        let snapshotBabyIds: string[] = [];
        try {
          const parsed = snapshotBabyIdsJson ? JSON.parse(snapshotBabyIdsJson) : [];
          if (Array.isArray(parsed)) {
            snapshotBabyIds = parsed.filter((value): value is string => typeof value === "string");
          }
        } catch {
          snapshotBabyIds = [];
        }
        if (selectedBabyId) snapshotBabyIds.push(selectedBabyId);

        for (const babyId of new Set(snapshotBabyIds)) {
          await extensionStorage.remove(`widgetSnapshot.${babyId}`, APP_GROUP);
          await extensionStorage.remove(`widgetNewbornNapOptIn.${babyId}`, APP_GROUP);
        }
        await extensionStorage.remove("widgetSnapshotBabyIds", APP_GROUP);
        await extensionStorage.remove("supabaseAccessToken", APP_GROUP);
        await extensionStorage.remove("userId", APP_GROUP);
        await extensionStorage.remove("selectedBabyId", APP_GROUP);
        await extensionStorage.remove("widgetTimezone", APP_GROUP);
        const preserveLocalCache = options.preserveLocalCache !== false;
        if (preserveLocalCache) {
          // Mark the retained cache as left behind by a departed session so the
          // widget strips its forever-ticking timers instead of rendering them.
          await extensionStorage.set(WIDGET_DATA_ORPHANED_KEY, "true", APP_GROUP);
        } else {
          await extensionStorage.remove(WIDGET_DATA_ORPHANED_KEY, APP_GROUP);
          await extensionStorage.remove("widgetData", APP_GROUP);
        }
        await extensionStorage.reloadWidget();
      }
    }
  } catch (error) {
    console.error("[WidgetDataService] Failed to clear widget data:", error);
  }
}

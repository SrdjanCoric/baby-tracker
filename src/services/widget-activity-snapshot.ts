import type { BreastSide, DiaperType, SleepType } from "@/constants/activities";
import type { TimerLockReconciliationState } from "@/services/timer-lock-reconciliation";
import type { SleepWidgetPrediction } from "@/utils/sleep-prediction-presentation";

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
    wakeWindowRequiresNewbornOptIn?: boolean;
    lastSleepEndedAt: string | null;
    napCountToday: number;
    morningConfirmationPending: boolean;
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
  timerInstanceId?: string;
  context?: string;
  isRemote?: boolean;
  isPaused?: boolean;
  accumulatedSeconds?: number;
  /** Sync provenance for the widget timer-list merge: only "accountless" or
   * "offline" timers have no server row and must survive a server snapshot. */
  lockState?: TimerLockReconciliationState;
}

export interface WidgetData {
  schemaVersion?: 1;
  serverAsOf?: string;
  timezone?: string;
  localDay?: {
    startedAt: string;
    endsAt: string;
  };
  /** Freshness stamp for an app-written local snapshot, in the same clock
   * domain as `updatedAt`. Present (with `schemaVersion` absent) marks a
   * `.local` snapshot whose newer-than-`serverAsOf` timers survive a refresh. */
  localAsOf?: string;
  /** The caregiver's explicit app preference for clock labels rendered by extensions. */
  timeFormat?: "12h" | "24h";
  /** Latest app-calculated sleep prediction display state, stored only in the App Group cache. */
  sleepPrediction?: SleepWidgetPrediction;
  babyId: string;
  babyName: string;
  activities: WidgetActivityData;
  activeTimer: ActiveTimerData | null;
  activeTimers: ActiveTimerData[];
  updatedAt: string;
}

export interface DecodedWidgetActivitySnapshot {
  kind: "legacy" | "local" | "versioned";
  data: WidgetData;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isNullableNumber(value: unknown): value is number | null {
  return value === null || isFiniteNumber(value);
}

function isSleepWidgetPrediction(value: unknown): value is SleepWidgetPrediction {
  if (!isObject(value) || typeof value.state !== "string") return false;
  if (value.state === "blank") {
    return value.predictedAt === undefined && value.validUntil === undefined;
  }
  if (value.state === "nighttime") {
    return value.predictedAt === undefined && typeof value.validUntil === "string";
  }
  if (value.state === "nextNap" || value.state === "bedtime") {
    return typeof value.predictedAt === "string";
  }
  return false;
}

function decodeTimer(value: unknown): ActiveTimerData | null | undefined {
  if (value === null) return null;
  if (!isObject(value)) return undefined;
  if (!["feeding", "pumping", "sleep", "tummyTime"].includes(String(value.type))) {
    return undefined;
  }
  if (typeof value.startTime !== "string") return undefined;
  if (value.timerInstanceId !== undefined && typeof value.timerInstanceId !== "string") return undefined;
  if (value.context !== undefined && typeof value.context !== "string") return undefined;
  if (value.isRemote !== undefined && typeof value.isRemote !== "boolean") return undefined;
  if (value.isPaused !== undefined && typeof value.isPaused !== "boolean") return undefined;
  if (value.accumulatedSeconds !== undefined && !isFiniteNumber(value.accumulatedSeconds)) {
    return undefined;
  }
  if (value.lockState !== undefined) {
    const lockState = value.lockState;
    if (typeof lockState !== "string"
      || !["accountless", "offline", "reconciling", "owned", "conflicted"].includes(lockState)) {
      return undefined;
    }
  }
  return value as unknown as ActiveTimerData;
}

function hasValidActivities(
  value: unknown,
  allowLegacySleepDefaults = false
): value is WidgetActivityData {
  if (!isObject(value)) return false;
  const { feeding, sleep, diaper, pumping, growth, tummyTime } = value;
  if (!isObject(feeding) || !isObject(sleep) || !isObject(diaper)
    || !isObject(pumping) || !isObject(growth) || !isObject(tummyTime)) {
    return false;
  }
  if (!isNullableString(feeding.lastTime)
    || !isFiniteNumber(feeding.todayCount)
    || !isNullableString(feeding.lastType)
    || !isNullableString(feeding.lastSide)) {
    return false;
  }
  if (!isNullableString(sleep.lastTime)
    || !isFiniteNumber(sleep.todayMinutes)
    || !isFiniteNumber(sleep.goalMinutes)
    || !isNullableNumber(sleep.lastDurationMinutes)
    || typeof sleep.isActive !== "boolean"
    || !isNullableString(sleep.sleepType)
    || !isNullableNumber(sleep.wakeWindowMinutes)
    || !isNullableString(sleep.wakeWindowSlotLabel)
    || !(sleep.wakeWindowRequiresNewbornOptIn === undefined
      || typeof sleep.wakeWindowRequiresNewbornOptIn === "boolean")
    || !isNullableString(sleep.lastSleepEndedAt)
    || !(isFiniteNumber(sleep.napCountToday)
      || (allowLegacySleepDefaults && sleep.napCountToday === undefined))
    || !(typeof sleep.morningConfirmationPending === "boolean"
      || (allowLegacySleepDefaults && sleep.morningConfirmationPending === undefined))) {
    return false;
  }
  if (!isNullableString(diaper.lastTime)
    || !isNullableString(diaper.lastType)
    || !isObject(diaper.todayCounts)
    || ![diaper.todayCounts.wet, diaper.todayCounts.dirty, diaper.todayCounts.mixed, diaper.todayCounts.dry]
      .every(isFiniteNumber)) {
    return false;
  }
  if (!isNullableString(pumping.lastTime)
    || !isFiniteNumber(pumping.todayVolumeMl)
    || !isFiniteNumber(pumping.sessionCount)
    || !isNullableString(pumping.lastSide)) {
    return false;
  }
  if (growth.lastMeasurement !== null) {
    if (!isObject(growth.lastMeasurement) || typeof growth.lastMeasurement.date !== "string") return false;
    for (const key of ["weightKg", "heightCm", "headCircumferenceCm"] as const) {
      const measurement = growth.lastMeasurement[key];
      if (measurement !== undefined && !isFiniteNumber(measurement)) return false;
    }
  }
  return isNullableString(tummyTime.lastTime)
    && isFiniteNumber(tummyTime.todayMinutes)
    && isFiniteNumber(tummyTime.goalMinutes)
    && isNullableNumber(tummyTime.lastDurationMinutes);
}

function timersEqual(left: ActiveTimerData | null, right: ActiveTimerData | null): boolean {
  return JSON.stringify(left) === JSON.stringify(right);
}

export function decodeWidgetActivitySnapshotJson(
  rawJson: string
): DecodedWidgetActivitySnapshot | null {
  let value: unknown;
  try {
    value = JSON.parse(rawJson);
  } catch {
    return null;
  }
  if (!isObject(value)) return null;
  const hasSchemaVersion = value.schemaVersion !== undefined;
  const localAsOf = value.localAsOf;
  const isLocal = !hasSchemaVersion && typeof localAsOf === "string";
  const isLegacy = !hasSchemaVersion && !isLocal;
  if (typeof value.babyId !== "string"
    || typeof value.babyName !== "string"
    || typeof value.updatedAt !== "string"
    || !(value.timeFormat === undefined
      || value.timeFormat === "12h"
      || value.timeFormat === "24h")
    || !(value.sleepPrediction === undefined
      || isSleepWidgetPrediction(value.sleepPrediction))
    || !hasValidActivities(value.activities, isLegacy || isLocal)) {
    return null;
  }

  const activeTimer = decodeTimer(value.activeTimer);
  if (activeTimer === undefined) return null;

  let activeTimers: ActiveTimerData[];
  if (value.activeTimers === undefined) {
    activeTimers = activeTimer ? [activeTimer] : [];
  } else {
    if (!Array.isArray(value.activeTimers)) return null;
    activeTimers = [];
    for (const item of value.activeTimers) {
      const timer = decodeTimer(item);
      if (!timer) return null;
      activeTimers.push(timer);
    }
  }

  const canonicalTimer = activeTimers[0] ?? null;
  if (activeTimer !== null && !timersEqual(activeTimer, canonicalTimer)) return null;
  if (activeTimer === null && canonicalTimer !== null) return null;

  if (!hasSchemaVersion) {
    if (isLocal && typeof localAsOf !== "string") return null;
  } else {
    if (value.schemaVersion !== 1
      || typeof value.serverAsOf !== "string"
      || typeof value.timezone !== "string"
      || !isObject(value.localDay)
      || typeof value.localDay.startedAt !== "string"
      || typeof value.localDay.endsAt !== "string") {
      return null;
    }
  }

  const decodedData = value as unknown as WidgetData;
  const fillLegacySleep = isLegacy || isLocal;
  const data = fillLegacySleep
    ? {
        ...decodedData,
        activities: {
          ...decodedData.activities,
          sleep: {
            ...decodedData.activities.sleep,
            napCountToday: decodedData.activities.sleep.napCountToday ?? 0,
            morningConfirmationPending:
              decodedData.activities.sleep.morningConfirmationPending ?? false,
          },
        },
      }
    : decodedData;

  return {
    kind: hasSchemaVersion ? "versioned" : isLocal ? "local" : "legacy",
    data: {
      ...data,
      activeTimer: canonicalTimer,
      activeTimers,
    },
  };
}

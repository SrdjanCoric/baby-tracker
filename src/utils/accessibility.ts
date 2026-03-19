/**
 * Accessibility utilities - Pure functions
 * Helper functions for formatting accessibility labels and messages
 * These functions are pure and don't depend on React Native APIs
 */

import type { TFunction } from "i18next";
import type { TimerAccessibilityInfo } from "@/types/accessibility";

const ACTIVITY_LABEL_KEYS: Record<string, string> = {
  breastfeeding: "accessibility.breastfeeding",
  bottle: "accessibility.bottle",
  solids: "accessibility.solids",
  sleep: "accessibility.sleep",
  nap: "accessibility.nap",
  nightSleep: "accessibility.nightSleep",
  diaper: "accessibility.diaper",
  pumping: "accessibility.pumping",
  tummyTime: "accessibility.tummyTime",
  growth: "accessibility.growthMeasurement",
};

const MINOR_EVENTS = new Set(["timer_tick", "scroll", "hover", "focus_change"]);

export function formatTimerAccessibilityLabel(
  info: TimerAccessibilityInfo,
  t: TFunction
): string {
  const activityLabel = getActivityAccessibilityLabel(info.activityType, t);
  const status = info.isRunning ? t("accessibility.timerRunning") : t("accessibility.timerStopped");
  const duration = formatDurationForAccessibility(info.duration, t);

  return t("accessibility.timerStatus", { activity: activityLabel, status, duration });
}

export function formatDurationForAccessibility(seconds: number, t: TFunction): string {
  if (seconds === 0) {
    return t("accessibility.zeroSeconds");
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  const parts: string[] = [];

  if (hours > 0) {
    parts.push(t("accessibility.hour", { count: hours }));
  }

  if (minutes > 0) {
    parts.push(t("accessibility.minute", { count: minutes }));
  }

  if (remainingSeconds > 0 && hours === 0) {
    parts.push(t("accessibility.second", { count: remainingSeconds }));
  }

  if (parts.length === 0) {
    return t("accessibility.zeroSeconds");
  }

  return parts.join(" ");
}

export function formatTimeAgoForAccessibility(
  date: Date | null | undefined,
  t: TFunction
): string {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
    return t("accessibility.unknownTime");
  }

  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

  if (diffMinutes < 1) {
    return t("accessibility.justNow");
  }

  if (diffMinutes < 60) {
    return t("accessibility.minuteAgo", { count: diffMinutes });
  }

  return t("accessibility.hourAgo", { count: diffHours });
}

export function getActivityAccessibilityLabel(activityType: string, t: TFunction): string {
  const key = ACTIVITY_LABEL_KEYS[activityType];
  if (key) {
    return t(key, { defaultValue: key });
  }

  return activityType.charAt(0).toUpperCase() + activityType.slice(1);
}

export function combineAccessibilityLabels(...labels: string[]): string {
  return labels
    .filter((label) => label && typeof label === "string")
    .map((label) => label.trim())
    .filter((label) => label.length > 0)
    .join(", ");
}

export function createTimerAnnouncementMessage(
  activityType: string,
  action: "start" | "stop",
  t: TFunction,
  durationSeconds?: number
): string {
  const activityLabel = getActivityAccessibilityLabel(activityType, t);

  if (action === "start") {
    return t("accessibility.timerStarted", { activity: activityLabel });
  }

  if (durationSeconds !== undefined && durationSeconds > 0) {
    const duration = formatDurationForAccessibility(durationSeconds, t);
    return t("accessibility.timerStoppedDuration", { activity: activityLabel, duration });
  }

  return t("accessibility.timerStoppedNoDuration", { activity: activityLabel });
}

export function createSaveSuccessMessage(activityType: string, t: TFunction): string {
  const activityLabel = getActivityAccessibilityLabel(activityType, t);
  return t("accessibility.savedSuccessfully", { activity: activityLabel });
}

export function createErrorMessage(t: TFunction, errorContext?: string): string {
  if (errorContext) {
    return t("accessibility.errorWithContext", { context: errorContext, defaultValue: `Error ${errorContext}. Please try again.` });
  }
  return t("accessibility.errorGeneric");
}

export function shouldAnnounce(eventType: string): boolean {
  if (MINOR_EVENTS.has(eventType)) {
    return false;
  }

  return true;
}

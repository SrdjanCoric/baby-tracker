/**
 * Accessibility utilities - Pure functions
 * Helper functions for formatting accessibility labels and messages
 * These functions are pure and don't depend on React Native APIs
 */

import type { TimerAccessibilityInfo } from "@/types/accessibility";

const ACTIVITY_LABELS: Record<string, string> = {
  breastfeeding: "Breastfeeding",
  bottle: "Bottle feeding",
  solids: "Solid food",
  sleep: "Sleep",
  nap: "Nap",
  nightSleep: "Night sleep",
  diaper: "Diaper change",
  pumping: "Pumping",
  tummyTime: "Tummy time",
  growth: "Growth measurement",
};

const MINOR_EVENTS = new Set(["timer_tick", "scroll", "hover", "focus_change"]);

export function formatTimerAccessibilityLabel(
  info: TimerAccessibilityInfo
): string {
  const activityLabel = getActivityAccessibilityLabel(info.activityType);
  const status = info.isRunning ? "running" : "stopped";
  const duration = formatDurationForAccessibility(info.duration);

  return `${activityLabel} timer ${status}, ${duration}`;
}

export function formatDurationForAccessibility(seconds: number): string {
  if (seconds === 0) {
    return "0 seconds";
  }

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = seconds % 60;

  const parts: string[] = [];

  if (hours > 0) {
    parts.push(`${hours} ${hours === 1 ? "hour" : "hours"}`);
  }

  if (minutes > 0) {
    parts.push(`${minutes} ${minutes === 1 ? "minute" : "minutes"}`);
  }

  if (remainingSeconds > 0 && hours === 0) {
    parts.push(
      `${remainingSeconds} ${remainingSeconds === 1 ? "second" : "seconds"}`
    );
  }

  if (parts.length === 0) {
    return "0 seconds";
  }

  return parts.join(" ");
}

export function formatTimeAgoForAccessibility(
  date: Date | null | undefined
): string {
  if (!date || !(date instanceof Date) || isNaN(date.getTime())) {
    return "unknown time";
  }

  const now = Date.now();
  const diffMs = now - date.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

  if (diffMinutes < 1) {
    return "just now";
  }

  if (diffMinutes < 60) {
    return `${diffMinutes} ${diffMinutes === 1 ? "minute" : "minutes"} ago`;
  }

  return `${diffHours} ${diffHours === 1 ? "hour" : "hours"} ago`;
}

export function getActivityAccessibilityLabel(activityType: string): string {
  if (ACTIVITY_LABELS[activityType]) {
    return ACTIVITY_LABELS[activityType];
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
  durationSeconds?: number
): string {
  const activityLabel = getActivityAccessibilityLabel(activityType);

  if (action === "start") {
    return `${activityLabel} timer started`;
  }

  if (durationSeconds !== undefined && durationSeconds > 0) {
    const duration = formatDurationForAccessibility(durationSeconds);
    return `${activityLabel} timer stopped. Duration: ${duration}`;
  }

  return `${activityLabel} timer stopped`;
}

export function createSaveSuccessMessage(activityType: string): string {
  const activityLabel = getActivityAccessibilityLabel(activityType);
  return `${activityLabel} saved successfully`;
}

export function createErrorMessage(context?: string): string {
  if (context) {
    return `Error ${context}. Please try again.`;
  }
  return "An error occurred. Please try again.";
}

export function shouldAnnounce(eventType: string): boolean {
  if (MINOR_EVENTS.has(eventType)) {
    return false;
  }

  return true;
}

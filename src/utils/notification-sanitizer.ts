/**
 * Notification Sanitizer
 * Utilities for sanitizing notification content and payloads
 * to ensure privacy and security
 */

import type {
  NotificationContent,
  NotificationData,
  NotificationPrivacySettings,
} from "@/types/notifications";

/**
 * Characters and patterns to strip from notification content
 */
const UNSAFE_PATTERNS = [
  /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, // Script tags
  /<[^>]+>/g, // HTML tags
  /javascript:/gi, // JavaScript URLs
  /data:/gi, // Data URLs
  /on\w+\s*=/gi, // Event handlers
];

/**
 * Maximum lengths for notification content
 */
const MAX_TITLE_LENGTH = 100;
const MAX_BODY_LENGTH = 256;
const MAX_DATA_VALUE_LENGTH = 500;

/**
 * Strips potentially dangerous content from a string
 */
export function stripUnsafeContent(input: string): string {
  if (typeof input !== "string") {
    return "";
  }

  let sanitized = input;

  for (const pattern of UNSAFE_PATTERNS) {
    sanitized = sanitized.replace(pattern, "");
  }

  // Remove null bytes and other control characters (except newlines and tabs)
  sanitized = sanitized.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");

  return sanitized.trim();
}

/**
 * Truncates a string to a maximum length, adding ellipsis if needed
 */
export function truncateString(input: string, maxLength: number): string {
  if (typeof input !== "string") {
    return "";
  }

  if (input.length <= maxLength) {
    return input;
  }

  return input.substring(0, maxLength - 3) + "...";
}

/**
 * Sanitizes a notification title
 */
export function sanitizeTitle(title: string): string {
  const sanitized = stripUnsafeContent(title);
  return truncateString(sanitized, MAX_TITLE_LENGTH);
}

/**
 * Sanitizes a notification body
 */
export function sanitizeBody(body: string): string {
  const sanitized = stripUnsafeContent(body);
  return truncateString(sanitized, MAX_BODY_LENGTH);
}

/**
 * Sanitizes notification data payload
 * Only allows safe primitive types and removes potentially unsafe values
 */
export function sanitizeData(data: NotificationData | undefined): NotificationData | undefined {
  if (!data || typeof data !== "object") {
    return undefined;
  }

  const sanitized: NotificationData = {
    type: data.type,
  };

  // Only copy allowed fields with sanitization
  if (data.activityType && typeof data.activityType === "string") {
    sanitized.activityType = stripUnsafeContent(data.activityType).substring(0, 50);
  }

  if (data.babyId && typeof data.babyId === "string") {
    // Only allow UUID-like strings for babyId
    if (/^[a-f0-9-]{36}$/i.test(data.babyId)) {
      sanitized.babyId = data.babyId;
    }
  }

  if (data.route && typeof data.route === "string") {
    // Only allow alphanumeric routes with slashes
    const routePattern = /^[a-zA-Z0-9/_-]+$/;
    if (routePattern.test(data.route)) {
      sanitized.route = data.route.substring(0, 100);
    }
  }

  return sanitized;
}

/**
 * Sanitizes complete notification content
 */
export function sanitizeNotificationContent(content: NotificationContent): NotificationContent {
  return {
    title: sanitizeTitle(content.title),
    body: sanitizeBody(content.body),
    data: sanitizeData(content.data),
  };
}

/**
 * Applies privacy settings to notification content
 * Replaces baby name with generic text if privacy is enabled
 */
export function applyPrivacySettings(
  content: NotificationContent,
  privacySettings: NotificationPrivacySettings,
  babyName?: string
): NotificationContent {
  let { title, body } = content;

  // If baby name should be hidden and we have a baby name to replace
  if (!privacySettings.showBabyName && babyName) {
    const babyNamePattern = new RegExp(escapeRegExp(babyName), "gi");
    title = title.replace(babyNamePattern, "your baby");
    body = body.replace(babyNamePattern, "your baby");
  }

  // If activity details should be hidden, use generic messages
  if (!privacySettings.showActivityDetails) {
    // Keep the title but make body generic
    if (content.data?.type === "feeding_reminder") {
      body = "Tap for details";
    } else if (content.data?.type === "timer_alert") {
      body = "Tap to check timer";
    }
  }

  return {
    title,
    body,
    data: content.data,
  };
}

/**
 * Escapes special regex characters in a string
 */
function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Creates a privacy-safe and sanitized notification content
 * Combines sanitization and privacy settings application
 */
export function createSafeNotificationContent(
  content: NotificationContent,
  privacySettings: NotificationPrivacySettings,
  babyName?: string
): NotificationContent {
  // First sanitize, then apply privacy
  const sanitized = sanitizeNotificationContent(content);
  return applyPrivacySettings(sanitized, privacySettings, babyName);
}

/**
 * Generates generic notification content when permissions are denied
 * Used for in-app reminders
 */
export function generateInAppReminderContent(
  type: "feeding" | "timer",
  privacySettings: NotificationPrivacySettings,
  details?: {
    babyName?: string;
    activityType?: string;
    intervalHours?: number;
  }
): { title: string; body: string } {
  if (type === "feeding") {
    const title = "Feeding Reminder";
    let body = "Time to feed";

    if (privacySettings.showBabyName && details?.babyName) {
      body = `Time to feed ${details.babyName}`;
    }

    if (privacySettings.showActivityDetails && details?.intervalHours) {
      body += ` (${details.intervalHours}h since last feeding)`;
    }

    return { title, body };
  }

  // Timer reminder
  const title = "Timer Alert";
  let body = "Check your active timer";

  if (privacySettings.showActivityDetails && details?.activityType) {
    const activityLabels: Record<string, string> = {
      breastfeeding: "breastfeeding",
      pumping: "pumping",
      tummyTime: "tummy time",
      nap: "nap",
      nightSleep: "sleep",
    };
    const label = activityLabels[details.activityType] || details.activityType;
    body = `Still doing ${label}? Tap to check`;
  }

  return { title, body };
}

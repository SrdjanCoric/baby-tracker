/**
 * Time formatting utilities for baby tracker
 */

/**
 * Formats seconds into a human-readable duration string
 * @param seconds Total seconds to format
 * @param format 'short' returns "1h 30m", 'long' returns "1:30:00"
 */
export function formatDuration(seconds: number, format: "short" | "long" = "long"): string {
  if (seconds < 0) return format === "short" ? "0m" : "0:00";

  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  if (format === "short") {
    if (hours > 0) {
      return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
    }
    return `${minutes}m`;
  }

  // Long format: H:MM:SS or MM:SS
  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }
  return `${minutes}:${secs.toString().padStart(2, "0")}`;
}

/**
 * Formats a timestamp to display time (e.g., "2:30 PM")
 */
export function formatTime(date: Date): string {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const period = hours >= 12 ? "PM" : "AM";
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${minutes.toString().padStart(2, "0")} ${period}`;
}

/**
 * Calculates time elapsed since a given date
 * Returns a human-readable string like "2h 15m" or "45m"
 */
export function timeSince(date: Date, now: Date = new Date()): string {
  const diffMs = now.getTime() - date.getTime();
  if (diffMs < 0) return "0m";

  const diffSeconds = Math.floor(diffMs / 1000);
  return formatDuration(diffSeconds, "short");
}

/**
 * Calculates duration between two timestamps in seconds
 */
export function calculateDuration(startTime: Date, endTime: Date): number {
  const diffMs = endTime.getTime() - startTime.getTime();
  return Math.max(0, Math.floor(diffMs / 1000));
}

/**
 * Checks if a date is today
 */
export function isToday(date: Date, now: Date = new Date()): boolean {
  return (
    date.getDate() === now.getDate() &&
    date.getMonth() === now.getMonth() &&
    date.getFullYear() === now.getFullYear()
  );
}

/**
 * Checks if a date is yesterday
 */
export function isYesterday(date: Date, now: Date = new Date()): boolean {
  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  return (
    date.getDate() === yesterday.getDate() &&
    date.getMonth() === yesterday.getMonth() &&
    date.getFullYear() === yesterday.getFullYear()
  );
}

/**
 * Formats a date for display in day headers
 * Returns "Today", "Yesterday", or a formatted date
 */
export function formatDayHeader(date: Date, now: Date = new Date()): string {
  if (isToday(date, now)) return "Today";
  if (isYesterday(date, now)) return "Yesterday";

  const options: Intl.DateTimeFormatOptions = {
    weekday: "long",
    month: "short",
    day: "numeric"
  };
  return date.toLocaleDateString("en-US", options);
}

/**
 * Formats date for display (e.g., "Jan 15, 2024")
 */
export function formatDate(date: Date): string {
  const options: Intl.DateTimeFormatOptions = {
    month: "short",
    day: "numeric",
    year: "numeric"
  };
  return date.toLocaleDateString("en-US", options);
}

/**
 * Calculates hours elapsed since a given date
 */
export function hoursSince(date: Date, now: Date = new Date()): number {
  const diffMs = now.getTime() - date.getTime();
  return diffMs / (1000 * 60 * 60);
}

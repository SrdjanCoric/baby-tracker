import { useState, useEffect } from "react";

/**
 * Hook that triggers re-renders at a specified interval.
 * Useful for components displaying relative time (e.g., "5 minutes ago").
 *
 * @param intervalMs - Refresh interval in milliseconds (default: 60000 = 1 minute).
 *   Pass null to stop refreshing while there is nothing time-sensitive on screen.
 * @returns The current timestamp, refreshed at the configured interval
 */
export function useTimeRefresh(intervalMs: number | null = 60000): number {
  const [tick, setTick] = useState(() => Date.now());

  useEffect(() => {
    if (intervalMs === null) return;

    const interval = setInterval(() => {
      setTick(Date.now());
    }, intervalMs);

    return () => clearInterval(interval);
  }, [intervalMs]);

  return tick;
}

import { useState, useEffect } from "react";

/**
 * Hook that triggers re-renders at a specified interval.
 * Useful for components displaying relative time (e.g., "5 minutes ago").
 *
 * @param intervalMs - Refresh interval in milliseconds (default: 60000 = 1 minute)
 * @returns The current timestamp, refreshed at the configured interval
 */
export function useTimeRefresh(intervalMs: number = 60000): number {
  const [tick, setTick] = useState(() => Date.now());

  useEffect(() => {
    const interval = setInterval(() => {
      setTick(Date.now());
    }, intervalMs);

    return () => clearInterval(interval);
  }, [intervalMs]);

  return tick;
}

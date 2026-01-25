import { useState, useEffect } from "react";

/**
 * Hook that triggers re-renders at a specified interval.
 * Useful for components displaying relative time (e.g., "5 minutes ago").
 *
 * @param intervalMs - Refresh interval in milliseconds (default: 60000 = 1 minute)
 * @returns A tick value that changes every interval, can be used as a useMemo dependency
 */
export function useTimeRefresh(intervalMs: number = 60000): number {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setTick((prev) => prev + 1);
    }, intervalMs);

    return () => clearInterval(interval);
  }, [intervalMs]);

  return tick;
}

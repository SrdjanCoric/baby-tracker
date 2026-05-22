import { useEffect, useRef } from "react";
import { useFeeding } from "../contexts/feeding-context";
import { useSleep } from "../contexts/sleep-context";
import { useDiaper } from "../contexts/diaper-context";
import { usePumping } from "../contexts/pumping-context";
import { useGrowth } from "../contexts/growth-context";
import { useTummyTime } from "../contexts/tummyTime-context";
import { useHealth } from "../contexts/health-context";
import {
  recordFirstUse,
  shouldRequestReview,
  requestReview,
} from "../services/store-review-service";

export function useStoreReview(): void {
  const { feedings } = useFeeding();
  const { sleeps } = useSleep();
  const { diapers } = useDiaper();
  const { pumpings } = usePumping();
  const { measurements } = useGrowth();
  const { tummyTimes } = useTummyTime();
  const { healthEntries } = useHealth();

  const totalCount =
    feedings.length +
    sleeps.length +
    diapers.length +
    pumpings.length +
    measurements.length +
    tummyTimes.length +
    healthEntries.length;

  const prevCountRef = useRef(totalCount);
  const isCheckingRef = useRef(false);

  useEffect(() => {
    recordFirstUse();
  }, []);

  useEffect(() => {
    if (totalCount <= prevCountRef.current) {
      prevCountRef.current = totalCount;
      return;
    }

    prevCountRef.current = totalCount;

    if (isCheckingRef.current) return;
    isCheckingRef.current = true;

    const timer = setTimeout(async () => {
      try {
        const should = await shouldRequestReview(totalCount);
        if (should) {
          await requestReview();
        }
      } finally {
        isCheckingRef.current = false;
      }
    }, 2000);

    return () => {
      clearTimeout(timer);
      isCheckingRef.current = false;
    };
  }, [totalCount]);
}

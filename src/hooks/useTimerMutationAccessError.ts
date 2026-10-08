import { useCallback, useLayoutEffect, useMemo, useRef } from "react";
import { isTimerAccessUnavailable } from "@/services/timer-access-error";

export function useTimerMutationAccessError(
  babyId: string | undefined,
  userId: string | undefined,
  timerInstanceId: string | undefined,
  clearTimer: () => Promise<void>
) {
  const binding = useMemo(
    () => ({ babyId, userId, timerInstanceId }),
    [babyId, userId, timerInstanceId]
  );
  const committed = useRef({ binding, clearTimer });
  useLayoutEffect(() => {
    committed.current = { binding, clearTimer };
  });
  return useCallback(
    async (error: unknown) => {
      if (!isTimerAccessUnavailable(error)) return false;
      if (error.reason === "revoked" && committed.current.binding === binding) {
        await committed.current.clearTimer();
      }
      return true;
    },
    [binding]
  );
}

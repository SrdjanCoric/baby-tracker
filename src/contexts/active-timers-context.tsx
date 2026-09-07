import { refreshLiveActivityPushTokens } from "@/services/live-activity-push-token-service";
import React, {
  createContext,
  useContext,
  useReducer,
  useCallback,
  useEffect,
  useMemo,
  useRef,
} from "react";
import { useBaby } from "./baby-context";
import { useAuth } from "./auth-context";
import { useSync } from "./sync-context";
import {
  getActiveTimersForBaby,
  getActiveTimerSnapshotForBaby,
  transformActiveTimerFromRemote,
  retryPendingLockReleases,
  retryPendingTimerStartEdits,
  type ActiveTimerLock,
  type TimerActivityType,
} from "@/services/active-timer-service";
import { supabase } from "@/services/supabase";
import i18n from "@/i18n";
import type { RemoteChange } from "@/services/sync/real-time-sync";

interface ActiveTimersState {
  locks: ActiveTimerLock[];
  isLoading: boolean;
}

type ActiveTimersAction =
  | { type: "SET_LOCKS"; locks: ActiveTimerLock[] }
  | { type: "ADD_LOCK"; lock: ActiveTimerLock }
  | { type: "REMOVE_LOCK"; babyId: string; activityType: TimerActivityType }
  | { type: "REMOVE_LOCK_BY_ID"; id: string }
  | { type: "UPDATE_LOCK"; lock: ActiveTimerLock }
  | { type: "SET_LOADING"; isLoading: boolean };

interface ActiveTimersContextValue {
  locks: ActiveTimerLock[];
  isLoading: boolean;
  getLockForActivity: (
    babyId: string,
    activityType: TimerActivityType
  ) => ActiveTimerLock | null;
  removeLock: (babyId: string, activityType: TimerActivityType) => void;
  isLockedByOther: (
    babyId: string,
    activityType: TimerActivityType
  ) => boolean;
  getLockedByName: (
    babyId: string,
    activityType: TimerActivityType
  ) => string | null;
  refreshLocks: () => Promise<void>;
}

const MAX_TRACKED_LOCK_REMOVALS = 32;

const ActiveTimersContext = createContext<ActiveTimersContextValue | null>(
  null
);

function activeTimersReducer(
  state: ActiveTimersState,
  action: ActiveTimersAction
): ActiveTimersState {
  switch (action.type) {
    case "SET_LOCKS":
      return { ...state, locks: action.locks, isLoading: false };

    case "ADD_LOCK": {
      const exists = state.locks.some(
        (l) =>
          l.babyId === action.lock.babyId &&
          l.activityType === action.lock.activityType
      );
      if (exists) {
        return {
          ...state,
          locks: state.locks.map((l) =>
            l.babyId === action.lock.babyId &&
            l.activityType === action.lock.activityType
              ? action.lock
              : l
          ),
        };
      }
      return { ...state, locks: [...state.locks, action.lock] };
    }

    case "REMOVE_LOCK":
      return {
        ...state,
        locks: state.locks.filter(
          (l) =>
            !(
              l.babyId === action.babyId &&
              l.activityType === action.activityType
            )
        ),
      };

    case "REMOVE_LOCK_BY_ID":
      return {
        ...state,
        locks: state.locks.filter((l) => l.id !== action.id),
      };

    case "UPDATE_LOCK":
      return {
        ...state,
        locks: state.locks.map((l) =>
          l.babyId === action.lock.babyId &&
          l.activityType === action.lock.activityType
            ? action.lock
            : l
        ),
      };

    case "SET_LOADING":
      return { ...state, isLoading: action.isLoading };

    default:
      return state;
  }
}

export function ActiveTimersProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const { selectedBaby } = useBaby();
  const { user } = useAuth();
  const { subscribeToRemoteChanges, registerForegroundRefreshLoader } = useSync();

  const [state, dispatch] = useReducer(activeTimersReducer, {
    locks: [],
    isLoading: true,
  });

  // A lock read that was already in flight when the lock was removed resolves
  // with the pre-removal row. Without this bookkeeping its `SET_LOCKS` would
  // resurrect a timer the user has just stopped.
  const removalRevisionRef = useRef(0);
  const removedLocksRef = useRef(new Map<string, number>());

  const noteLockRemoval = useCallback((key: string) => {
    const removals = removedLocksRef.current;
    removals.delete(key);
    removals.set(key, ++removalRevisionRef.current);
    // Bounded ring of the most recent removals: a read in flight during a
    // removal always settles long before this many further removals happen.
    while (removals.size > MAX_TRACKED_LOCK_REMOVALS) {
      const oldest = removals.keys().next();
      if (oldest.done) break;
      removals.delete(oldest.value);
    }
  }, []);

  const dropStaleLocks = useCallback(
    (locks: ActiveTimerLock[], issuedAtRevision: number) => {
      return locks.filter(lock => {
        const byId = removedLocksRef.current.get(lock.id);
        const byActivity = removedLocksRef.current.get(
          `${lock.babyId}:${lock.activityType}`
        );
        return (
          (byId ?? 0) <= issuedAtRevision && (byActivity ?? 0) <= issuedAtRevision
        );
      });
    },
    []
  );

  const loadLocks = useCallback(async (
    throwOnError: boolean,
    requireFreshSnapshot = false
  ) => {
    if (!selectedBaby?.id) {
      dispatch({ type: "SET_LOCKS", locks: [] });
      return;
    }

    // Skip API call for guest users (no valid auth)
    if (!user?.id) {
      dispatch({ type: "SET_LOCKS", locks: [] });
      return;
    }

    try {
      dispatch({ type: "SET_LOADING", isLoading: true });
      const issuedAtRevision = removalRevisionRef.current;
      const locks = await (requireFreshSnapshot
        ? getActiveTimersForBaby(selectedBaby.id)
        : getActiveTimerSnapshotForBaby(selectedBaby.id));
      dispatch({
        type: "SET_LOCKS",
        locks: dropStaleLocks([...locks], issuedAtRevision),
      });
    } catch (error) {
      console.error("[ActiveTimersContext] Failed to load locks:", error);
      dispatch({ type: "SET_LOADING", isLoading: false });
      if (throwOnError) throw error;
    }
  }, [dropStaleLocks, selectedBaby?.id, user?.id]);

  const refreshLocks = useCallback(
    () => loadLocks(false),
    [loadLocks]
  );

  useEffect(() => {
    void refreshLocks().catch(() => undefined);
  }, [refreshLocks]);

  useEffect(() => {
    if (!registerForegroundRefreshLoader) return;
    return registerForegroundRefreshLoader("active_timers", async () => {
      await Promise.all([
        retryPendingLockReleases(),
        retryPendingTimerStartEdits(),
      ]);
      await loadLocks(true, true);
    });
  }, [loadLocks, registerForegroundRefreshLoader]);

  useEffect(() => {
    const handleChange = async (change: RemoteChange) => {
      const babyId = (change.new?.baby_id || change.old?.baby_id) as
        | string
        | undefined;

      if (change.eventType === "DELETE") refreshLiveActivityPushTokens();
      if (change.eventType === "DELETE" && change.old?.id) {
        const deletedBabyId = change.old.baby_id as string | undefined;
        const deletedId = change.old.id as string;
        if (deletedBabyId && deletedBabyId !== selectedBaby?.id) {
          return;
        }
        noteLockRemoval(deletedId);
        const deletedActivityType = change.old.activity_type as string | undefined;
        if (deletedBabyId && deletedActivityType) {
          noteLockRemoval(`${deletedBabyId}:${deletedActivityType}`);
        }
        dispatch({
          type: "REMOVE_LOCK_BY_ID",
          id: deletedId,
        });
        return;
      }

      if (!babyId || babyId !== selectedBaby?.id) {
        return;
      }

      if (change.eventType === "INSERT" && change.new) {
        const lockData = transformActiveTimerFromRemote(change.new);
        const { data: userData } = await supabase
          .from("users")
          .select("display_name")
          .eq("id", lockData.startedBy)
          .single();

        dispatch({
          type: "ADD_LOCK",
          lock: {
            ...lockData,
            startedByName: userData?.display_name || i18n.t("common.someone"),
          },
        });
      } else if (change.eventType === "UPDATE" && change.new) {
        const lockData = transformActiveTimerFromRemote(change.new);
        const { data: userData } = await supabase
          .from("users")
          .select("display_name")
          .eq("id", lockData.startedBy)
          .single();

        dispatch({
          type: "UPDATE_LOCK",
          lock: {
            ...lockData,
            startedByName: userData?.display_name || i18n.t("common.someone"),
          },
        });
      }
    };

    const unsubscribe = subscribeToRemoteChanges("active_timers", handleChange);
    return unsubscribe;
  }, [noteLockRemoval, subscribeToRemoteChanges, selectedBaby?.id]);

  const getLockForActivity = useCallback(
    (babyId: string, activityType: TimerActivityType) => {
      return (
        state.locks.find(
          (l) => l.babyId === babyId && l.activityType === activityType
        ) || null
      );
    },
    [state.locks]
  );

  const removeLock = useCallback(
    (babyId: string, activityType: TimerActivityType) => {
      noteLockRemoval(`${babyId}:${activityType}`);
      dispatch({ type: "REMOVE_LOCK", babyId, activityType });
    },
    [noteLockRemoval]
  );

  const isLockedByOther = useCallback(
    (babyId: string, activityType: TimerActivityType) => {
      if (!user?.id) return false;
      const lock = getLockForActivity(babyId, activityType);
      return lock !== null && lock.startedBy !== user.id;
    },
    [getLockForActivity, user?.id]
  );

  const getLockedByName = useCallback(
    (babyId: string, activityType: TimerActivityType) => {
      const lock = getLockForActivity(babyId, activityType);
      if (!lock || lock.startedBy === user?.id) return null;
      return lock.startedByName;
    },
    [getLockForActivity, user?.id]
  );

  const contextValue = useMemo(
    () => ({
      locks: state.locks,
      isLoading: state.isLoading,
      getLockForActivity,
      removeLock,
      isLockedByOther,
      getLockedByName,
      refreshLocks,
    }),
    [
      state.locks,
      state.isLoading,
      getLockForActivity,
      removeLock,
      isLockedByOther,
      getLockedByName,
      refreshLocks,
    ]
  );

  return (
    <ActiveTimersContext.Provider value={contextValue}>
      {children}
    </ActiveTimersContext.Provider>
  );
}

export function useActiveTimers(): ActiveTimersContextValue {
  const context = useContext(ActiveTimersContext);
  if (!context) {
    throw new Error(
      "useActiveTimers must be used within an ActiveTimersProvider"
    );
  }
  return context;
}

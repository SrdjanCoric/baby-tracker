import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityRangeLoader,
  type ActivityRangeLoadOptions,
  type ActivityRangeStatus,
  type UtcActivityRange,
} from "@/services/activity-range-loader";
import {
  fetchActivityRangeFromDatabase,
  type ActivityRangeEntryMap,
  type TimelineActivityTable,
} from "@/services/activity-sync-service";

interface UseActivityRangeLoaderOptions<T extends TimelineActivityTable> {
  table: T;
  babyId: string | null;
  authenticated: boolean;
  storageScope: string;
  acceptEntries: (entries: ActivityRangeEntryMap[T][]) => void;
}

interface ActivityRangeLoaderValue {
  loadRange: (
    range: UtcActivityRange,
    options?: ActivityRangeLoadOptions
  ) => Promise<void>;
  getRangeStatus: (range: UtcActivityRange) => ActivityRangeStatus;
}

export function useActivityRangeLoader<T extends TimelineActivityTable>({
  table,
  babyId,
  authenticated,
  storageScope,
  acceptEntries,
}: UseActivityRangeLoaderOptions<T>): ActivityRangeLoaderValue {
  const [revision, setRevision] = useState(0);
  const scopeRef = useRef(storageScope);
  const acceptRef = useRef(acceptEntries);
  const loadersRef = useRef(
    new Map<string, ActivityRangeLoader<ActivityRangeEntryMap[T]>>()
  );
  scopeRef.current = storageScope;
  acceptRef.current = acceptEntries;

  const loader = useMemo(() => {
    const existing = loadersRef.current.get(storageScope);
    if (existing) return existing;

    const capturedScope = storageScope;
    const created = new ActivityRangeLoader<ActivityRangeEntryMap[T]>(
      async (range) => {
        if (!babyId) return [];
        return fetchActivityRangeFromDatabase(table, babyId, range);
      },
      (entries) => {
        if (scopeRef.current === capturedScope) acceptRef.current(entries);
      }
    );
    loadersRef.current.set(storageScope, created);
    return created;
  }, [babyId, storageScope, table]);

  useEffect(() => {
    const unsubscribe = loader.subscribe(() => setRevision((revision) => revision + 1));
    return () => {
      unsubscribe();
      loader.deactivate();
    };
  }, [loader]);

  const loadRange = useCallback(async (
    range: UtcActivityRange,
    options?: ActivityRangeLoadOptions
  ) => {
    if (!babyId || !authenticated) {
      loader.markLoaded(range);
      return;
    }
    await loader.load(range, options);
  }, [authenticated, babyId, loader]);

  const getRangeStatus = useCallback(
    (range: UtcActivityRange) => {
      void revision;
      return loader.status(range);
    },
    [loader, revision]
  );

  return { loadRange, getRangeStatus };
}

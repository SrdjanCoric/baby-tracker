import React, { createContext, useContext, useReducer, useEffect, useCallback, useMemo, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { SyncEngine, SyncState as EngineSyncState, SyncStatus, RealTimeSync, RemoteChange, SyncableTable, isCrdtTable, reconcileRemoteChange } from '@/services/sync';
import { getCrdtSync } from '@/services/sync/crdt-sync-instance';
import { createForegroundRefreshCoordinator, type ForegroundRefreshLoader } from '@/services/foreground-refresh-coordinator';

export interface SyncState {
  status: SyncStatus;
  pendingCount: number;
  lastSyncedAt: string | null;
  error: string | null;
  isConnected: boolean;
}

export type SyncAction =
  | { type: 'SET_STATUS'; payload: SyncStatus }
  | { type: 'SET_PENDING_COUNT'; payload: number }
  | { type: 'INCREMENT_PENDING' }
  | { type: 'DECREMENT_PENDING' }
  | { type: 'SET_ONLINE'; payload: boolean }
  | { type: 'SYNC_COMPLETE'; payload: string }
  | { type: 'SYNC_ERROR'; payload: string }
  | { type: 'CLEAR_ERROR' };

export const initialSyncState: SyncState = {
  status: 'offline',
  pendingCount: 0,
  lastSyncedAt: null,
  error: null,
  isConnected: false,
};

export function syncReducer(state: SyncState, action: SyncAction): SyncState {
  switch (action.type) {
    case 'SET_STATUS':
      return { ...state, status: action.payload };

    case 'SET_PENDING_COUNT':
      return { ...state, pendingCount: action.payload };

    case 'INCREMENT_PENDING':
      return { ...state, pendingCount: state.pendingCount + 1 };

    case 'DECREMENT_PENDING':
      return { ...state, pendingCount: Math.max(0, state.pendingCount - 1) };

    case 'SET_ONLINE':
      return { ...state, isConnected: action.payload };

    case 'SYNC_COMPLETE':
      return {
        ...state,
        status: 'online',
        lastSyncedAt: action.payload,
        error: null,
      };

    case 'SYNC_ERROR':
      return { ...state, status: 'error', error: action.payload };

    case 'CLEAR_ERROR':
      return { ...state, error: null };

    default:
      return state;
  }
}

type RemoteChangeCallback = (change: RemoteChange) => void;

interface SyncContextValue extends SyncState {
  isInitialized: boolean;
  forceSync: () => Promise<void>;
  retryFailedSync: () => Promise<void>;
  clearAllData: () => Promise<void>;
  subscribeToRemoteChanges: (table: SyncableTable, callback: RemoteChangeCallback) => () => void;
  setAuthContext: (householdId: string, userId: string) => void;
  clearAuthContext: () => void;
  registerForegroundRefreshLoader: (id: string, loader: ForegroundRefreshLoader) => () => void;
  enqueueOperation: (operation: {
    type: 'CREATE' | 'UPDATE' | 'DELETE';
    table: SyncableTable;
    entityId: string;
    data: Record<string, unknown> | null;
  }) => Promise<void>;
}

const SyncContext = createContext<SyncContextValue | null>(null);

// Create instances immediately at module load to avoid timing issues
// with child components calling setAuthContext before parent effect runs
let syncEngineInstance: SyncEngine | null = new SyncEngine();
let realTimeSyncInstance: RealTimeSync | null = new RealTimeSync();
let instanceRefCount = 0;

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(syncReducer, initialSyncState);
  const [isInitialized, setIsInitialized] = useState(false);
  const remoteChangeListenersRef = useRef<Map<SyncableTable, Set<RemoteChangeCallback>>>(new Map());
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);
  const wasOfflineRef = useRef(false);
  const reconcileChainRef = useRef<Promise<void>>(Promise.resolve());
  const refreshCoordinatorRef = useRef(createForegroundRefreshCoordinator());

  useEffect(() => {
    const handleAppStateChange = async (nextState: AppStateStatus) => {
      if (appStateRef.current.match(/inactive|background/) && nextState === 'active') {
        refreshCoordinatorRef.current.startWakeCycle();
        if (syncEngineInstance && syncEngineInstance.getPendingCount() > 0) {
          try {
            await syncEngineInstance.sync();
          } catch {
            // Sync failed — still refresh to show best available data
          }
        }
        await refreshCoordinatorRef.current.trigger(
          syncEngineInstance?.getState().isConnected ?? false
        );
      }
      appStateRef.current = nextState;
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    instanceRefCount++;

    // Instances are created at module load, just get references
    const engine = syncEngineInstance!;
    const realTimeSync = realTimeSyncInstance!;

    const unsubscribe = engine.subscribe((engineState: EngineSyncState) => {
      dispatch({ type: 'SET_STATUS', payload: engineState.status });
      dispatch({ type: 'SET_PENDING_COUNT', payload: engineState.pendingCount });
      dispatch({ type: 'SET_ONLINE', payload: engineState.isConnected });

      if (!engineState.isConnected) {
        wasOfflineRef.current = true;
        refreshCoordinatorRef.current.noteOffline();
      }

      if (wasOfflineRef.current && engineState.isConnected && engineState.status === 'online') {
        wasOfflineRef.current = false;
        void refreshCoordinatorRef.current.trigger(true);
      }

      if (engineState.lastSyncedAt) {
        dispatch({ type: 'SYNC_COMPLETE', payload: engineState.lastSyncedAt });
      }

      if (engineState.error) {
        dispatch({ type: 'SYNC_ERROR', payload: engineState.error });
      }
    });

    const dispatchChange = (change: RemoteChange) => {
      const listeners = remoteChangeListenersRef.current.get(change.table as SyncableTable);
      if (listeners) {
        listeners.forEach(callback => callback(change));
      }
    };

    const unsubscribeRealTime = realTimeSync.onRemoteChange((change: RemoteChange) => {
      // In-scope rows are merged against local CRDT state before dispatch so a stale
      // remote write can't clobber a newer local field. Reconciliation reads and writes
      // the shared shadow, so serialize it to keep per-record ordering and avoid races.
      if (!isCrdtTable(change.table)) {
        dispatchChange(change);
        return;
      }
      reconcileChainRef.current = reconcileChainRef.current.then(async () => {
        try {
          const crdt = await getCrdtSync();
          const reconciled = (await reconcileRemoteChange(crdt, change)) as RemoteChange;
          dispatchChange(reconciled);
        } catch (error) {
          console.error('[SyncContext] CRDT reconcile failed; dispatching raw change:', error);
          dispatchChange(change);
        }
      });
    });

    let isMounted = true;
    engine.initialize()
      .then(() => {
        if (isMounted) {
          setIsInitialized(true);
        }
      })
      .catch((error) => {
        dispatch({ type: 'SYNC_ERROR', payload: error.message });
      });

    return () => {
      isMounted = false;
      unsubscribe();
      unsubscribeRealTime();
      instanceRefCount--;

      if (instanceRefCount === 0) {
        if (syncEngineInstance) {
          syncEngineInstance.destroy();
          // Recreate for potential future mounts
          syncEngineInstance = new SyncEngine();
        }
        if (realTimeSyncInstance) {
          realTimeSyncInstance.destroy();
          // Recreate for potential future mounts
          realTimeSyncInstance = new RealTimeSync();
        }
      }
    };
  }, []);

  const forceSync = useCallback(async () => {
    if (!syncEngineInstance) return;

    dispatch({ type: 'CLEAR_ERROR' });
    try {
      await syncEngineInstance.sync();
    } catch (error) {
      dispatch({
        type: 'SYNC_ERROR',
        payload: error instanceof Error ? error.message : 'Sync failed',
      });
    }
  }, []);

  const retryFailedSync = useCallback(async () => {
    dispatch({ type: 'CLEAR_ERROR' });
    await forceSync();
  }, [forceSync]);

  const clearAllData = useCallback(async () => {
    if (!syncEngineInstance) return;

    try {
      await syncEngineInstance.clearAllData();
      if (realTimeSyncInstance) {
        realTimeSyncInstance.unsubscribe();
      }
      dispatch({ type: 'SET_STATUS', payload: 'offline' });
      dispatch({ type: 'SET_PENDING_COUNT', payload: 0 });
      dispatch({ type: 'SET_ONLINE', payload: false });
    } catch (error) {
      dispatch({
        type: 'SYNC_ERROR',
        payload: error instanceof Error ? error.message : 'Failed to clear data',
      });
    }
  }, []);

  const subscribeToRemoteChanges = useCallback((table: SyncableTable, callback: RemoteChangeCallback): (() => void) => {
    if (!remoteChangeListenersRef.current.has(table)) {
      remoteChangeListenersRef.current.set(table, new Set());
    }
    remoteChangeListenersRef.current.get(table)!.add(callback);

    return () => {
      const listeners = remoteChangeListenersRef.current.get(table);
      if (listeners) {
        listeners.delete(callback);
      }
    };
  }, []);

  const setAuthContext = useCallback((householdId: string, userId: string) => {
    if (syncEngineInstance) {
      syncEngineInstance.setAuthContext({ householdId, userId });
    }
    if (realTimeSyncInstance) {
      realTimeSyncInstance.setAuthContext({ householdId, userId });
      realTimeSyncInstance.subscribeToHousehold(householdId).catch((error) => {
        console.error('[SyncContext] Failed to subscribe to household:', error);
        dispatch({ type: 'SYNC_ERROR', payload: error.message });
      });
    }
  }, []);

  const clearAuthContext = useCallback(() => {
    syncEngineInstance?.clearAuthContext();
    realTimeSyncInstance?.clearAuthContext();
  }, []);

  const registerForegroundRefreshLoader = useCallback(
    (id: string, loader: ForegroundRefreshLoader) =>
      refreshCoordinatorRef.current.register(id, loader),
    []
  );

  const enqueueOperation = useCallback(async (operation: {
    type: 'CREATE' | 'UPDATE' | 'DELETE';
    table: SyncableTable;
    entityId: string;
    data: Record<string, unknown> | null;
  }) => {
    if (!syncEngineInstance) return;

    // Skip sync if auth context is not set (local-only mode)
    if (!syncEngineInstance.getAuthContext()) {
      return;
    }

    await syncEngineInstance.enqueueOperation({
      id: '',
      type: operation.type,
      table: operation.table,
      entityId: operation.entityId,
      data: operation.data,
      timestamp: new Date().toISOString(),
      retryCount: 0,
    });
  }, []);

  const value: SyncContextValue = useMemo(() => ({
    ...state,
    isInitialized,
    forceSync,
    retryFailedSync,
    clearAllData,
    subscribeToRemoteChanges,
    setAuthContext,
    clearAuthContext,
    registerForegroundRefreshLoader,
    enqueueOperation,
  }), [state, isInitialized, forceSync, retryFailedSync, clearAllData, subscribeToRemoteChanges, setAuthContext, clearAuthContext, registerForegroundRefreshLoader, enqueueOperation]);

  return <SyncContext.Provider value={value}>{children}</SyncContext.Provider>;
}

export function useSync(): SyncContextValue {
  const context = useContext(SyncContext);
  if (!context) {
    throw new Error('useSync must be used within a SyncProvider');
  }
  return context;
}

export function getSyncEngine(): SyncEngine | null {
  return syncEngineInstance;
}

export async function clearSyncData(): Promise<void> {
  if (syncEngineInstance) {
    await syncEngineInstance.clearAllData();
  }
}

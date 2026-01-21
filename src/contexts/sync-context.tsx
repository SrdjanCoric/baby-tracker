import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import { SyncEngine, SyncState as EngineSyncState, SyncStatus } from '@/services/sync';

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

interface SyncContextValue extends SyncState {
  forceSync: () => Promise<void>;
  retryFailedSync: () => Promise<void>;
}

const SyncContext = createContext<SyncContextValue | null>(null);

let syncEngineInstance: SyncEngine | null = null;

export function SyncProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(syncReducer, initialSyncState);

  useEffect(() => {
    if (!syncEngineInstance) {
      syncEngineInstance = new SyncEngine();
    }

    const engine = syncEngineInstance;

    const unsubscribe = engine.subscribe((engineState: EngineSyncState) => {
      dispatch({ type: 'SET_STATUS', payload: engineState.status });
      dispatch({ type: 'SET_PENDING_COUNT', payload: engineState.pendingCount });
      dispatch({ type: 'SET_ONLINE', payload: engineState.isConnected });

      if (engineState.lastSyncedAt) {
        dispatch({ type: 'SYNC_COMPLETE', payload: engineState.lastSyncedAt });
      }

      if (engineState.error) {
        dispatch({ type: 'SYNC_ERROR', payload: engineState.error });
      }
    });

    engine.initialize().catch((error) => {
      dispatch({ type: 'SYNC_ERROR', payload: error.message });
    });

    return () => {
      unsubscribe();
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

  const value: SyncContextValue = {
    ...state,
    forceSync,
    retryFailedSync,
  };

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

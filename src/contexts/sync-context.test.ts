import { describe, it, expect } from 'vitest';

type SyncStatus = 'offline' | 'online' | 'syncing' | 'pending' | 'error';

interface SyncState {
  status: SyncStatus;
  pendingCount: number;
  lastSyncedAt: string | null;
  error: string | null;
  isConnected: boolean;
}

type SyncAction =
  | { type: 'SET_STATUS'; payload: SyncStatus }
  | { type: 'SET_PENDING_COUNT'; payload: number }
  | { type: 'INCREMENT_PENDING' }
  | { type: 'DECREMENT_PENDING' }
  | { type: 'SET_ONLINE'; payload: boolean }
  | { type: 'SYNC_COMPLETE'; payload: string }
  | { type: 'SYNC_ERROR'; payload: string }
  | { type: 'CLEAR_ERROR' };

const initialSyncState: SyncState = {
  status: 'offline',
  pendingCount: 0,
  lastSyncedAt: null,
  error: null,
  isConnected: false,
};

function syncReducer(state: SyncState, action: SyncAction): SyncState {
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

describe('SyncContext', () => {
  describe('syncReducer', () => {
    describe('SET_STATUS', () => {
      it('should handle SET_STATUS action', () => {
        const action: SyncAction = { type: 'SET_STATUS', payload: 'syncing' };

        const newState = syncReducer(initialSyncState, action);

        expect(newState.status).toBe('syncing');
      });
    });

    describe('SET_PENDING_COUNT', () => {
      it('should handle SET_PENDING_COUNT action', () => {
        const action: SyncAction = { type: 'SET_PENDING_COUNT', payload: 5 };

        const newState = syncReducer(initialSyncState, action);

        expect(newState.pendingCount).toBe(5);
      });
    });

    describe('INCREMENT_PENDING', () => {
      it('should handle INCREMENT_PENDING action', () => {
        const state: SyncState = { ...initialSyncState, pendingCount: 3 };
        const action: SyncAction = { type: 'INCREMENT_PENDING' };

        const newState = syncReducer(state, action);

        expect(newState.pendingCount).toBe(4);
      });
    });

    describe('DECREMENT_PENDING', () => {
      it('should handle DECREMENT_PENDING action', () => {
        const state: SyncState = { ...initialSyncState, pendingCount: 3 };
        const action: SyncAction = { type: 'DECREMENT_PENDING' };

        const newState = syncReducer(state, action);

        expect(newState.pendingCount).toBe(2);
      });

      it('should not go below zero', () => {
        const state: SyncState = { ...initialSyncState, pendingCount: 0 };
        const action: SyncAction = { type: 'DECREMENT_PENDING' };

        const newState = syncReducer(state, action);

        expect(newState.pendingCount).toBe(0);
      });
    });

    describe('SET_ONLINE', () => {
      it('should handle SET_ONLINE action with true', () => {
        const state: SyncState = { ...initialSyncState, isConnected: false };
        const action: SyncAction = { type: 'SET_ONLINE', payload: true };

        const newState = syncReducer(state, action);

        expect(newState.isConnected).toBe(true);
      });

      it('should handle SET_ONLINE action with false', () => {
        const state: SyncState = { ...initialSyncState, isConnected: true };
        const action: SyncAction = { type: 'SET_ONLINE', payload: false };

        const newState = syncReducer(state, action);

        expect(newState.isConnected).toBe(false);
      });
    });

    describe('SYNC_COMPLETE', () => {
      it('should handle SYNC_COMPLETE action', () => {
        const state: SyncState = { ...initialSyncState, status: 'syncing' };
        const timestamp = '2024-01-01T10:00:00.000Z';
        const action: SyncAction = { type: 'SYNC_COMPLETE', payload: timestamp };

        const newState = syncReducer(state, action);

        expect(newState.status).toBe('online');
        expect(newState.lastSyncedAt).toBe(timestamp);
        expect(newState.error).toBeNull();
      });
    });

    describe('SYNC_ERROR', () => {
      it('should handle SYNC_ERROR action', () => {
        const state: SyncState = { ...initialSyncState, status: 'syncing' };
        const action: SyncAction = { type: 'SYNC_ERROR', payload: 'Network failed' };

        const newState = syncReducer(state, action);

        expect(newState.status).toBe('error');
        expect(newState.error).toBe('Network failed');
      });
    });

    describe('CLEAR_ERROR', () => {
      it('should handle CLEAR_ERROR action', () => {
        const state: SyncState = { ...initialSyncState, error: 'Some error' };
        const action: SyncAction = { type: 'CLEAR_ERROR' };

        const newState = syncReducer(state, action);

        expect(newState.error).toBeNull();
      });
    });

    describe('default case', () => {
      it('should return current state for unknown action', () => {
        const action = { type: 'UNKNOWN' } as unknown as SyncAction;

        const newState = syncReducer(initialSyncState, action);

        expect(newState).toEqual(initialSyncState);
      });
    });
  });
});

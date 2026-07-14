import type { ClockedRecord } from './crdt';

export type SyncStatus = 'offline' | 'online' | 'syncing' | 'pending' | 'error';

export interface SyncState {
  status: SyncStatus;
  pendingCount: number;
  lastSyncedAt: string | null;
  error: string | null;
  isConnected: boolean;
}

export interface SyncableEntry {
  id: string;
  createdAt: string;
  updatedAt: string;
  loggedBy: string;
}

export type SyncableTable =
  | 'feedings'
  | 'sleep_sessions'
  | 'diapers'
  | 'pumping_sessions'
  | 'growth_measurements'
  | 'tummy_time_sessions'
  | 'babies'
  | 'users'
  | 'households'
  | 'active_timers'
  | 'wake_window_preferences'
  | 'activity_goals'
  | 'milestone_responses'
  | 'health_entries'
  | 'achievements';

export type OperationType = 'CREATE' | 'UPDATE' | 'DELETE';

export interface SyncOperationOwner {
  householdId: string;
  userId: string;
}

export interface LocalStorageMutation {
  key: string;
  previousValue: string | null;
  nextValue: string;
  state: 'prepared' | 'committed';
  previousShadow?: ClockedRecord | null;
}

export interface QueuedOperation {
  id: string;
  type: OperationType;
  table: SyncableTable;
  entityId: string;
  data: Record<string, unknown> | null;
  timestamp: string;
  retryCount: number;
  owner?: SyncOperationOwner;
  localMutation?: LocalStorageMutation;
}

export interface SyncQueuePersistence {
  operations: QueuedOperation[];
  version: number;
  generation?: number;
}

export interface SyncEngineConfig {
  batchSize: number;
  maxRetries: number;
  baseRetryDelayMs: number;
  maxRetryDelayMs: number;
  debounceMs: number;
  staleOperationWarningHours: number;
}

export const DEFAULT_SYNC_CONFIG: SyncEngineConfig = {
  batchSize: 50,
  maxRetries: 5,
  baseRetryDelayMs: 1000,
  maxRetryDelayMs: 30000,
  debounceMs: 300,
  staleOperationWarningHours: 24,
};

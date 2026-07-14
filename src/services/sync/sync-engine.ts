import NetInfo from '@react-native-community/netinfo';
import { SyncQueue } from './sync-queue';
import {
  SyncState,
  SyncStatus,
  QueuedOperation,
  DEFAULT_SYNC_CONFIG,
  SyncEngineConfig,
  SyncableTable,
} from './types';
import { supabase } from '../supabase';
import { isCrdtTable } from './crdt-sync';
import { getCrdtSync } from './crdt-sync-instance';
import type { FieldClocks } from './crdt';

type SyncStateListener = (state: SyncState) => void;

/** The subset of the CRDT coordinator the engine needs — kept minimal so tests can
 * inject an in-memory instance. */
interface CrdtCoordinator {
  stampWrite(table: SyncableTable, entityId: string, data: Record<string, unknown>): Promise<FieldClocks>;
  forget(table: SyncableTable, entityId: string): Promise<void>;
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
}

const VALID_OPERATION_TYPES = new Set(['CREATE', 'UPDATE', 'DELETE']);
const VALID_SYNCABLE_TABLES = new Set<SyncableTable>([
  'feedings',
  'sleep_sessions',
  'diapers',
  'pumping_sessions',
  'growth_measurements',
  'tummy_time_sessions',
  'babies',
  'users',
  'households',
  'active_timers',
  'wake_window_preferences',
  'activity_goals',
  'milestone_responses',
  'health_entries',
  'achievements',
]);

export interface SyncAuthContext {
  householdId: string;
  userId: string;
}

export class SyncEngine {
  private queue: SyncQueue;
  private config: SyncEngineConfig;
  private state: SyncState;
  private listeners: Set<SyncStateListener> = new Set();
  private networkUnsubscribe: (() => void) | null = null;
  private debounceTimer: ReturnType<typeof setTimeout> | null = null;
  private quarantined: QueuedOperation[] = [];
  private processedOperationIds: Set<string> = new Set();
  private authContext: SyncAuthContext | null = null;
  private isSyncing = false;
  private pendingSync = false;
  private activeSyncPromise: Promise<void> | null = null;
  private crdtSync: CrdtCoordinator | null = null;

  constructor(config: Partial<SyncEngineConfig> = {}) {
    this.queue = new SyncQueue();
    this.config = { ...DEFAULT_SYNC_CONFIG, ...config };
    this.state = {
      status: 'offline',
      pendingCount: 0,
      lastSyncedAt: null,
      error: null,
      isConnected: false,
    };
  }

  setAuthContext(context: SyncAuthContext): void {
    this.authContext = context;
    if (this.state.isConnected && this.queue.getCount() > 0) {
      void this.handleNetworkChange(true);
    }
  }

  clearAuthContext(): void {
    this.authContext = null;
  }

  /** Inject the CRDT coordinator (tests). In the app it is resolved lazily from the
   * process singleton the first time a stamped write is enqueued. */
  setCrdtSync(coordinator: CrdtCoordinator): void {
    this.crdtSync = coordinator;
  }

  private async getCrdtSync(): Promise<CrdtCoordinator> {
    if (!this.crdtSync) {
      this.crdtSync = await getCrdtSync();
    }
    return this.crdtSync;
  }

  getAuthContext(): SyncAuthContext | null {
    return this.authContext;
  }

  private ensureAuthContext(): SyncAuthContext {
    if (!this.authContext) {
      throw new Error('Sync auth context not set. Call setAuthContext first.');
    }
    return this.authContext;
  }

  async initialize(): Promise<void> {
    await this.queue.restore();
    this.updateState({ pendingCount: this.queue.getCount() });

    let isOnline = false;
    try {
      const netState = await NetInfo.fetch();
      isOnline = netState.isConnected === true && netState.isInternetReachable === true;
    } catch (error) {
      console.warn(
        '[SyncEngine] Network status unavailable during initialization; starting offline:',
        error instanceof Error ? error.message : 'Unknown error'
      );
    }

    this.updateState({
      isConnected: isOnline,
      status: isOnline ? 'online' : 'offline',
    });

    this.networkUnsubscribe = NetInfo.addEventListener((state) => {
      const online = state.isConnected === true && state.isInternetReachable === true;
      void this.handleNetworkChange(online);
    });

    if (isOnline && this.authContext && this.queue.getCount() > 0) {
      void this.handleNetworkChange(true);
    }
  }

  async handleNetworkChange(isOnline: boolean): Promise<void> {
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
    }

    this.updateState({
      isConnected: isOnline,
      status: isOnline && !this.isSyncing ? 'online' : (isOnline ? 'syncing' : 'offline'),
    });

    this.debounceTimer = setTimeout(async () => {
      if (isOnline && this.queue.getCount() > 0) {
        try {
          await this.sync();
        } catch {
          // Sync state already records the failure; keep the operation queued for a later retry.
        }
      }
    }, this.config.debounceMs);
  }

  async sync(): Promise<void> {
    if (!this.state.isConnected || !this.authContext) {
      return;
    }

    if (this.isSyncing) {
      this.pendingSync = true;
      if (this.activeSyncPromise) {
        await this.activeSyncPromise;
      }
      return;
    }

    this.isSyncing = true;
    this.updateState({ status: 'syncing', error: null });

    let retryCount = 0;
    const maxRetries = this.config.maxRetries;

    this.activeSyncPromise = (async () => {
      try {
        while (retryCount < maxRetries) {
          try {
            await this.pullChanges();
            await this.pushChanges();

            this.updateState({
              status: 'online',
              lastSyncedAt: new Date().toISOString(),
              pendingCount: this.queue.getCount(),
            });

            this.isSyncing = false;
            this.activeSyncPromise = null;

            if (this.pendingSync) {
              this.pendingSync = false;
              await this.sync();
            }
            return;
          } catch (error) {
            retryCount++;
            if (retryCount >= maxRetries) {
              this.updateState({
                status: 'error',
                error: error instanceof Error ? error.message : 'Sync failed',
                pendingCount: this.queue.getCount(),
              });
              console.error(
                `[SyncEngine] Sync failed after ${retryCount} attempts; ${this.queue.getCount()} operations remain queued:`,
                error instanceof Error ? error.message : 'Unknown error'
              );
              throw error;
            }
            await this.delay(this.queue.calculateBackoff(retryCount));
          }
        }
      } finally {
        this.isSyncing = false;
        this.activeSyncPromise = null;
      }
    })();

    await this.activeSyncPromise;
  }

  async enqueueOperation(operation: QueuedOperation): Promise<void> {
    const authContext = this.ensureAuthContext();

    if (!operation.id) {
      operation.id = this.generateOperationId();
    }

    if (this.processedOperationIds.has(operation.id)) {
      return;
    }

    const validation = this.validateOperation(operation);
    if (!validation.valid) {
      throw new Error(`Invalid operation: ${validation.errors.join(', ')}`);
    }

    if (operation.data?.householdId && operation.data.householdId !== authContext.householdId) {
      throw new Error('Cannot enqueue operation for a different household');
    }

    await this.stampOperation(operation);

    await this.queue.enqueue(operation);
    try {
      await this.persistQueueWithRetry();
    } catch (error) {
      this.updateState({
        status: 'error',
        error: 'Failed to persist sync queue',
        pendingCount: this.queue.getCount(),
      });
      throw error;
    }
    this.processedOperationIds.add(operation.id);
    this.updateState({ pendingCount: this.queue.getCount() });

    if (this.state.isConnected) {
      this.handleNetworkChange(true);
    }
  }

  /**
   * Stamp an in-scope create/update with per-field HLC clocks before it is queued, so
   * the clocks are persisted with the operation and survive a restart. A delete becomes a
   * tombstone: a `deleted: true` field write stamped and merged through the same path as any
   * edit. Out-of-scope tables are untouched.
   */
  private async stampOperation(operation: QueuedOperation): Promise<void> {
    if (!isCrdtTable(operation.table)) return;
    const crdt = await this.getCrdtSync();

    if (operation.type === 'DELETE') {
      const clocks = await crdt.stampWrite(operation.table, operation.entityId, { deleted: true });
      operation.data = { deleted: true, field_clocks: clocks };
      return;
    }
    if (!operation.data) return;

    const clocks = await crdt.stampWrite(operation.table, operation.entityId, operation.data);
    operation.data = { ...operation.data, field_clocks: clocks };
  }

  private async persistQueueWithRetry(): Promise<void> {
    const maxAttempts = Math.max(1, Math.min(this.config.maxRetries, 3));
    let attempt = 0;

    while (attempt < maxAttempts) {
      try {
        await this.queue.persist();
        return;
      } catch (error) {
        attempt++;
        if (attempt >= maxAttempts) {
          throw error;
        }
        await this.delay(Math.min(this.queue.calculateBackoff(attempt), 250));
      }
    }
  }

  private generateOperationId(): string {
    return `op-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }

  validateOperation(operation: QueuedOperation): ValidationResult {
    const errors: string[] = [];

    if (typeof operation.id !== 'string' || operation.id.length === 0) {
      errors.push('Operation ID is required');
    }

    if (typeof operation.entityId !== 'string' || operation.entityId.length === 0) {
      errors.push('Entity ID is required');
    }

    if (!VALID_SYNCABLE_TABLES.has(operation.table)) {
      errors.push('Table name is invalid');
    }

    if (!VALID_OPERATION_TYPES.has(operation.type)) {
      errors.push('Operation type is invalid');
    }

    const hasRecordData = operation.data !== null
      && typeof operation.data === 'object'
      && !Array.isArray(operation.data);

    if ((operation.type === 'CREATE' || operation.type === 'UPDATE') && !hasRecordData) {
      errors.push(`${operation.type} operations require data`);
    }

    if (operation.type === 'CREATE' && hasRecordData && !operation.data?.id) {
      errors.push('CREATE data must include id');
    }

    if (operation.data !== null && !hasRecordData) {
      errors.push('Operation data must be an object or null');
    }

    if (typeof operation.timestamp !== 'string' || !Number.isFinite(Date.parse(operation.timestamp))) {
      errors.push('Operation timestamp is invalid');
    }

    if (!Number.isInteger(operation.retryCount) || operation.retryCount < 0) {
      errors.push('Operation retry count is invalid');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  async quarantineOperation(operation: QueuedOperation): Promise<void> {
    this.quarantined.push(operation);
    this.queue.remove(operation.id);
    await this.persistQueueWithRetry();
  }

  getQuarantinedOperations(): QueuedOperation[] {
    return [...this.quarantined];
  }

  private async pullChanges(): Promise<unknown[]> {
    return [];
  }

  private async pushChanges(): Promise<void> {
    const batches = this.queue.getBatches(this.config.batchSize);

    for (const batch of batches) {
      for (const operation of batch) {
        const validation = this.validateOperation(operation);
        if (!validation.valid) {
          await this.quarantineOperation(operation);
          continue;
        }

        try {
          await this.executeOperation(operation);
          this.queue.remove(operation.id);
        } catch (error) {
          this.queue.markRetry(operation.id);
          await this.persistQueueWithRetry();
          this.updateState({ pendingCount: this.queue.getCount() });
          throw error;
        }
      }
    }

    await this.persistQueueWithRetry();
    this.updateState({ pendingCount: this.queue.getCount() });
  }

  private async executeOperation(operation: QueuedOperation): Promise<void> {
    const { table, type, entityId, data } = operation;

    // In-scope writes go through the server-side merge RPC (per-field LWW), never a raw
    // insert/update/delete. A DELETE arrives here already stamped as a `deleted: true`
    // tombstone write by stampOperation, so it merges like any other field write. A DELETE
    // with no data can only be a legacy op queued by a pre-tombstone binary; it falls
    // through to the hard-delete path below (today's behavior — never worse).
    if (isCrdtTable(table) && (type === 'CREATE' || type === 'UPDATE' || (type === 'DELETE' && data))) {
      if (!data) throw new Error(`${type} operation requires data`);
      const { field_clocks, ...record } = data;
      const { error } = await supabase.rpc('merge_record', {
        p_table: table,
        p_record: { id: entityId, ...record },
        p_field_clocks: (field_clocks as FieldClocks | undefined) ?? {},
      });
      if (error) {
        throw new Error(`Failed to merge ${table}: ${error.message}`);
      }
      return;
    }

    switch (type) {
      case 'CREATE': {
        if (!data) throw new Error('CREATE operation requires data');
        const { error } = await supabase.from(table).insert(data);
        if (error) {
          if (error.code === '23505') {
            return; // Record already exists, treat as success
          }
          throw new Error(`Failed to create ${table}: ${error.message}`);
        }
        break;
      }
      case 'UPDATE': {
        if (!data) throw new Error('UPDATE operation requires data');
        const { error } = await supabase
          .from(table)
          .update(data)
          .eq('id', entityId);
        if (error) {
          throw new Error(`Failed to update ${table}: ${error.message}`);
        }
        break;
      }
      case 'DELETE': {
        const { error } = await supabase
          .from(table)
          .delete()
          .eq('id', entityId);
        if (error) {
          throw new Error(`Failed to delete from ${table}: ${error.message}`);
        }
        break;
      }
    }
  }

  delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  setOnlineForTesting(isOnline: boolean): void {
    this.updateState({ isConnected: isOnline, status: isOnline ? 'online' : 'offline' });
  }

  subscribe(listener: SyncStateListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private updateState(partial: Partial<SyncState>): void {
    this.state = { ...this.state, ...partial };
    this.notifyListeners();
  }

  private notifyListeners(): void {
    this.listeners.forEach((listener) => listener(this.state));
  }

  setStatus(status: SyncStatus): void {
    this.updateState({ status });
  }

  getState(): SyncState {
    return { ...this.state };
  }

  getStatus(): SyncStatus {
    return this.state.status;
  }

  isOnline(): boolean {
    return this.state.isConnected;
  }

  getPendingCount(): number {
    return this.queue.getCount();
  }

  getPendingEntityOperations(table: SyncableTable): Map<string, QueuedOperation['type']> {
    const operations = new Map<string, QueuedOperation['type']>();
    for (const operation of this.queue.getAll()) {
      if (operation.table === table && this.validateOperation(operation).valid) {
        operations.set(operation.entityId, operation.type);
      }
    }
    return operations;
  }

  getLastSyncedAt(): string | null {
    return this.state.lastSyncedAt;
  }

  async clearAllData(): Promise<void> {
    await this.queue.clear();
    this.quarantined = [];
    this.processedOperationIds.clear();
    this.isSyncing = false;
    this.pendingSync = false;
    this.authContext = null;
    this.updateState({
      status: 'offline',
      pendingCount: 0,
      lastSyncedAt: null,
      error: null,
      isConnected: false,
    });
  }

  destroy(): void {
    if (this.networkUnsubscribe) {
      this.networkUnsubscribe();
      this.networkUnsubscribe = null;
    }
    if (this.debounceTimer) {
      clearTimeout(this.debounceTimer);
      this.debounceTimer = null;
    }
    this.isSyncing = false;
    this.pendingSync = false;
    this.listeners.clear();
  }
}

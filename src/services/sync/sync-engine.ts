import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SyncQueue } from './sync-queue';
import {
  SyncState,
  SyncStatus,
  QueuedOperation,
  DEFAULT_SYNC_CONFIG,
  SyncEngineConfig,
  SyncableTable,
  SyncOperationOwner,
  LocalStorageMutation,
} from './types';
import { supabase } from '../supabase';
import { isCrdtTable } from './crdt-sync';
import { getCrdtSync } from './crdt-sync-instance';
import { compareClocks, type ClockedRecord, type FieldClocks } from './crdt';

type SyncStateListener = (state: SyncState) => void;

/** The subset of the CRDT coordinator the engine needs — kept minimal so tests can
 * inject an in-memory instance. */
interface CrdtCoordinator {
  stampWrite(table: SyncableTable, entityId: string, data: Record<string, unknown>): Promise<FieldClocks>;
  forget(table: SyncableTable, entityId: string): Promise<void>;
  getShadow(table: SyncableTable, entityId: string): Promise<ClockedRecord | null>;
  restoreShadow(table: SyncableTable, entityId: string, shadow: ClockedRecord | null): Promise<void>;
}

interface ValidationResult {
  valid: boolean;
  errors: string[];
}

interface AuthRun {
  context: SyncAuthContext;
  epoch: number;
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

export type SyncAuthContext = SyncOperationOwner;

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
  private authEpoch = 0;
  private isSyncing = false;
  private pendingSync = false;
  private activeSyncPromise: Promise<void> | null = null;
  private crdtSync: CrdtCoordinator | null = null;
  private enqueueChain: Promise<void> = Promise.resolve();
  private queuePersistenceChain: Promise<void> = Promise.resolve();
  private ownerBindingsInProgress = new Set<string>();
  private legacyOwnerMigrationError: Error | null = null;
  private pullReadiness: Promise<void> = Promise.resolve();

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
    if (!this.authContext || !this.sameAuthContext(this.authContext, context)) {
      this.authEpoch += 1;
    }
    this.authContext = context;
    this.scheduleLegacyOwnerMigration();
    if (this.state.isConnected && this.queue.getCount() > 0) {
      void this.handleNetworkChange(true);
    }
  }

  clearAuthContext(): void {
    if (this.authContext) {
      this.authEpoch += 1;
    }
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
    await this.resolvePreparedLocalMutations();
    if (this.authContext) {
      await this.migrateLegacyOperationOwners(this.captureAuthRun());
    }
    for (const operation of this.queue.getAll()) {
      if (!operation.localMutation || operation.localMutation.state === 'committed') {
        this.processedOperationIds.add(operation.id);
      }
    }
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
    await this.enqueueChain;
    if (this.legacyOwnerMigrationError) {
      throw this.legacyOwnerMigrationError;
    }
    if (!this.state.isConnected || !this.authContext) {
      return;
    }

    const authRun = this.captureAuthRun();

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
            this.assertAuthRun(authRun);
            await this.pullChanges();
            this.assertAuthRun(authRun);
            await this.pushChanges(authRun);

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
    const authRun = this.captureAuthRun();
    this.bindOperationOwner(operation, authRun.context);
    const enqueue = this.enqueueChain.then(() => this.enqueueOperationLocked(operation, authRun));
    this.enqueueChain = enqueue.catch(() => {});
    return enqueue;
  }

  async enqueueOperationWithLocalMutation(
    operation: QueuedOperation,
    mutation: Omit<LocalStorageMutation, 'state' | 'previousShadow'>
  ): Promise<void> {
    const authRun = this.captureAuthRun();
    this.bindOperationOwner(operation, authRun.context);
    const enqueue = this.enqueueChain.then(() => this.enqueueOperationLocked(
      operation,
      authRun,
      mutation
    ));
    this.enqueueChain = enqueue.catch(() => {});
    return enqueue;
  }

  private async enqueueOperationLocked(
    operation: QueuedOperation,
    authRun: AuthRun,
    localMutation?: Omit<LocalStorageMutation, 'state' | 'previousShadow'>
  ): Promise<void> {
    this.assertAuthRun(authRun);
    const authContext = authRun.context;

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

    const previousShadow = await this.getPreviousShadow(operation);
    try {
      await this.stampOperation(operation);
      this.assertAuthRun(authRun);
      if (localMutation) {
        operation.localMutation = {
          ...localMutation,
          state: 'prepared',
          previousShadow,
        };
      }
      await this.queue.enqueue(operation);
      await this.persistQueueSerialized();
    } catch (error) {
      this.queue.remove(operation.id);
      await this.restorePreviousShadow(operation, previousShadow);
      this.updateState({
        status: 'error',
        error: 'Failed to persist sync queue',
        pendingCount: this.queue.getCount(),
      });
      throw error;
    }

    if (operation.localMutation) {
      try {
        this.assertAuthRun(authRun);
        await AsyncStorage.setItem(
          operation.localMutation.key,
          operation.localMutation.nextValue
        );
      } catch (error) {
        this.queue.remove(operation.id);
        try {
          await this.persistQueueSerialized();
        } catch (cleanupError) {
          console.error(
            '[SyncEngine] Failed to remove an unapplied prepared operation from durable storage:',
            cleanupError instanceof Error ? cleanupError.message : 'Unknown error'
          );
        }
        await this.restorePreviousShadow(operation, previousShadow);
        this.updateState({ pendingCount: this.queue.getCount() });
        throw error;
      }

      operation.localMutation.state = 'committed';
      try {
        await this.persistQueueSerialized();
      } catch (error) {
        console.warn(
          '[SyncEngine] Local mutation committed with a durable prepared queue record; restart will finalize it:',
          error instanceof Error ? error.message : 'Unknown error'
        );
      }
    }

    this.processedOperationIds.add(operation.id);
    this.updateState({ pendingCount: this.queue.getCount() });

    if (this.state.isConnected) {
      this.handleNetworkChange(true);
    }
  }

  private bindOperationOwner(operation: QueuedOperation, authContext: SyncAuthContext): void {
    if (operation.owner && !this.isOwnedByAuthContext(operation, authContext)) {
      throw new Error('Cannot enqueue an operation owned by a different authenticated user');
    }
    operation.owner = { ...authContext };
  }

  private captureAuthRun(): AuthRun {
    return {
      context: { ...this.ensureAuthContext() },
      epoch: this.authEpoch,
    };
  }

  private assertAuthRun(authRun: AuthRun): void {
    if (
      this.authEpoch !== authRun.epoch
      || !this.authContext
      || !this.sameAuthContext(this.authContext, authRun.context)
    ) {
      throw new Error('Sync authentication context changed during operation');
    }
  }

  private sameAuthContext(left: SyncAuthContext, right: SyncAuthContext): boolean {
    return left.householdId === right.householdId && left.userId === right.userId;
  }

  private scheduleLegacyOwnerMigration(): void {
    if (!this.authContext || this.queue.getCount() === 0) return;
    const authRun = this.captureAuthRun();
    const migration = this.enqueueChain.then(() => this.migrateLegacyOperationOwners(authRun));
    this.enqueueChain = migration.catch(() => {});
    this.pullReadiness = migration;
    void migration.catch((error) => {
      this.legacyOwnerMigrationError = error instanceof Error
        ? error
        : new Error('Failed to migrate legacy sync operation ownership');
      this.updateState({
        status: 'error',
        error: this.legacyOwnerMigrationError.message,
      });
    });
  }

  private async migrateLegacyOperationOwners(authRun: AuthRun): Promise<void> {
    this.assertAuthRun(authRun);
    const operationsToBind: QueuedOperation[] = [];
    for (const operation of this.queue.getAll()) {
      if (operation.owner) continue;
      const attributedUserId = await this.inferLegacyOperationUserId(operation);
      this.assertAuthRun(authRun);
      if (attributedUserId === authRun.context.userId) {
        operationsToBind.push(operation);
      }
    }
    if (operationsToBind.length === 0) {
      this.legacyOwnerMigrationError = null;
      return;
    }

    for (const operation of operationsToBind) {
      this.ownerBindingsInProgress.add(operation.id);
      operation.owner = { ...authRun.context };
    }
    try {
      await this.persistQueueSerialized();
      this.legacyOwnerMigrationError = null;
    } catch (error) {
      for (const operation of operationsToBind) {
        operation.owner = undefined;
      }
      throw error;
    } finally {
      for (const operation of operationsToBind) {
        this.ownerBindingsInProgress.delete(operation.id);
      }
    }
  }

  private async inferLegacyOperationUserId(operation: QueuedOperation): Promise<string | null> {
    const directUserId = this.readAttributedUserId(operation.data);
    if (directUserId) return directUserId;
    if (!isCrdtTable(operation.table)) return null;

    const shadow = await (await this.getCrdtSync()).getShadow(
      operation.table,
      operation.entityId
    );
    return this.readAttributedUserId(shadow);
  }

  private readAttributedUserId(data: Record<string, unknown> | null): string | null {
    if (!data) return null;
    for (const field of ['logged_by', 'responded_by', 'detected_by']) {
      const value = data[field];
      if (typeof value === 'string' && value.length > 0) {
        return value;
      }
    }
    return null;
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

  private async getPreviousShadow(
    operation: QueuedOperation
  ): Promise<ClockedRecord | null | undefined> {
    if (!isCrdtTable(operation.table)) return undefined;
    const crdt = await this.getCrdtSync();
    return crdt.getShadow(operation.table, operation.entityId);
  }

  private async restorePreviousShadow(
    operation: QueuedOperation,
    previousShadow: ClockedRecord | null | undefined
  ): Promise<void> {
    if (previousShadow === undefined || !isCrdtTable(operation.table)) return;
    const crdt = await this.getCrdtSync();
    await crdt.restoreShadow(operation.table, operation.entityId, previousShadow);
  }

  private async resolvePreparedLocalMutations(): Promise<void> {
    let changed = false;
    for (const operation of this.queue.getAll()) {
      const mutation = operation.localMutation;
      if (!mutation || mutation.state === 'committed') continue;

      const currentValue = await AsyncStorage.getItem(mutation.key);
      if (currentValue === mutation.nextValue) {
        mutation.state = 'committed';
        changed = true;
        continue;
      }
      if (currentValue === mutation.previousValue) {
        this.queue.remove(operation.id);
        await this.restorePreviousShadow(operation, mutation.previousShadow);
        changed = true;
        continue;
      }
      throw new Error('Cannot resolve prepared local mutation from storage state');
    }

    if (changed) {
      try {
        await this.persistQueueSerialized();
      } catch (error) {
        console.warn(
          '[SyncEngine] Prepared local mutation was resolved in memory but could not be checkpointed:',
          error instanceof Error ? error.message : 'Unknown error'
        );
      }
    }
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

  private async persistQueueSerialized(): Promise<void> {
    const persistence = this.queuePersistenceChain.then(() => this.persistQueueWithRetry());
    this.queuePersistenceChain = persistence.catch(() => {});
    return persistence;
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
    await this.persistQueueSerialized();
  }

  getQuarantinedOperations(): QueuedOperation[] {
    return [...this.quarantined];
  }

  private async pullChanges(): Promise<unknown[]> {
    return [];
  }

  async waitUntilReadyForPull(): Promise<void> {
    await this.pullReadiness;
    if (this.legacyOwnerMigrationError) {
      throw this.legacyOwnerMigrationError;
    }
  }

  private async pushChanges(authRun: AuthRun): Promise<void> {
    const batches = this.queue.getBatches(this.config.batchSize);

    for (const batch of batches) {
      for (const operation of batch) {
        if (!this.isOperationCommitted(operation)) {
          continue;
        }
        if (!this.isOwnedByAuthContext(operation, authRun.context)) {
          continue;
        }
        const validation = this.validateOperation(operation);
        if (!validation.valid) {
          await this.quarantineOperation(operation);
          continue;
        }

        try {
          this.assertAuthRun(authRun);
          await this.executeOperation(operation, authRun);
          this.assertAuthRun(authRun);
          this.queue.remove(operation.id);
        } catch (error) {
          this.queue.markRetry(operation.id);
          await this.persistQueueSerialized();
          this.updateState({ pendingCount: this.queue.getCount() });
          throw error;
        }
      }
    }

    await this.persistQueueSerialized();
    this.updateState({ pendingCount: this.queue.getCount() });
  }

  private async executeOperation(operation: QueuedOperation, authRun: AuthRun): Promise<void> {
    const { table, type, entityId, data } = operation;
    this.assertAuthRun(authRun);

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
        p_operation_id: operation.id,
        p_expected_user_id: authRun.context.userId,
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
      if (
        operation.table === table
        && this.validateOperation(operation).valid
        && this.isOperationCommitted(operation)
        && this.isOwnedByCurrentAuth(operation)
      ) {
        operations.set(operation.entityId, operation.type);
      }
    }
    return operations;
  }

  getPendingEntityFieldClocks(table: SyncableTable, entityId: string): FieldClocks {
    const clocks: FieldClocks = {};
    for (const operation of this.queue.getAll()) {
      if (
        operation.table !== table
        || operation.entityId !== entityId
        || !this.validateOperation(operation).valid
        || !this.isOperationCommitted(operation)
        || !this.isOwnedByCurrentAuth(operation)
      ) {
        continue;
      }
      const operationClocks = operation.data?.field_clocks;
      if (!operationClocks || typeof operationClocks !== 'object') continue;
      for (const [field, clock] of Object.entries(operationClocks as FieldClocks)) {
        const existing = clocks[field];
        if (existing === undefined || compareClocks(clock, existing) > 0) {
          clocks[field] = clock;
        }
      }
    }
    return clocks;
  }

  private isOwnedByCurrentAuth(operation: QueuedOperation): boolean {
    return this.authContext !== null
      && !this.ownerBindingsInProgress.has(operation.id)
      && this.isOwnedByAuthContext(operation, this.authContext);
  }

  private isOwnedByAuthContext(
    operation: QueuedOperation,
    authContext: SyncAuthContext
  ): boolean {
    return operation.owner?.householdId === authContext.householdId
      && operation.owner.userId === authContext.userId;
  }

  private isOperationCommitted(operation: QueuedOperation): boolean {
    return operation.localMutation?.state === 'committed'
      || (!operation.localMutation && this.processedOperationIds.has(operation.id));
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

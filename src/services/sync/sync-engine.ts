import NetInfo from '@react-native-community/netinfo';
import { SyncQueue } from './sync-queue';
import { ConflictResolver } from './conflict-resolver';
import {
  SyncState,
  SyncStatus,
  QueuedOperation,
  DEFAULT_SYNC_CONFIG,
  SyncEngineConfig,
} from './types';

type SyncStateListener = (state: SyncState) => void;

interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export interface SyncAuthContext {
  householdId: string;
  userId: string;
}

export class SyncEngine {
  private queue: SyncQueue;
  private conflictResolver: ConflictResolver;
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

  constructor(config: Partial<SyncEngineConfig> = {}) {
    this.queue = new SyncQueue();
    this.conflictResolver = new ConflictResolver();
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

    const netState = await NetInfo.fetch();
    const isOnline = netState.isConnected === true && netState.isInternetReachable === true;

    this.updateState({
      isConnected: isOnline,
      status: isOnline ? 'online' : 'offline',
    });

    this.networkUnsubscribe = NetInfo.addEventListener((state) => {
      const online = state.isConnected === true && state.isInternetReachable === true;
      this.handleNetworkChange(online);
    });
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
        await this.sync();
      }
    }, this.config.debounceMs);
  }

  async sync(): Promise<void> {
    if (!this.state.isConnected) {
      return;
    }

    if (this.isSyncing) {
      this.pendingSync = true;
      return;
    }

    this.isSyncing = true;
    this.updateState({ status: 'syncing', error: null });

    let retryCount = 0;
    const maxRetries = this.config.maxRetries;

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
            });
            throw error;
          }
          await this.delay(this.queue.calculateBackoff(retryCount));
        }
      }
    } finally {
      this.isSyncing = false;
    }
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

    this.processedOperationIds.add(operation.id);
    await this.queue.enqueue(operation);
    await this.queue.persist();
    this.updateState({ pendingCount: this.queue.getCount() });

    if (this.state.isConnected) {
      this.handleNetworkChange(true);
    }
  }

  private generateOperationId(): string {
    return `op-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }

  validateOperation(operation: QueuedOperation): ValidationResult {
    const errors: string[] = [];

    if (!operation.id) {
      errors.push('Operation ID is required');
    }

    if (!operation.entityId) {
      errors.push('Entity ID is required');
    }

    if (!operation.table) {
      errors.push('Table name is required');
    }

    if (!operation.type) {
      errors.push('Operation type is required');
    }

    if (operation.type === 'CREATE' && !operation.data) {
      errors.push('CREATE operations require data');
    }

    if (operation.type === 'CREATE' && operation.data && !operation.data.id) {
      errors.push('CREATE data must include id');
    }

    if (operation.type === 'UPDATE' && !operation.data) {
      errors.push('UPDATE operations require data');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  async quarantineOperation(operation: QueuedOperation): Promise<void> {
    this.quarantined.push(operation);
    this.queue.remove(operation.id);
    await this.queue.persist();
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

        this.queue.remove(operation.id);
      }
    }

    await this.queue.persist();
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

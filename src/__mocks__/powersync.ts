import { vi } from 'vitest';

type SyncStatusListener = (status: MockSyncStatus) => void;
type ChangeListener = (change: MockChange) => void;

interface MockSyncStatus {
  connected: boolean;
  lastSyncedAt: Date | null;
  dataFlowStatus: {
    uploading: boolean;
    downloading: boolean;
  };
}

interface MockChange {
  table: string;
  opType: 'INSERT' | 'UPDATE' | 'DELETE';
  row: Record<string, unknown>;
  rowId: string;
}

interface MockQueryResult {
  rows: {
    _array: Record<string, unknown>[];
    length: number;
    item: (index: number) => Record<string, unknown>;
  };
}

class MockPowerSyncDatabase {
  private data: Map<string, Map<string, Record<string, unknown>>> = new Map();
  private statusListeners: Set<SyncStatusListener> = new Set();
  private changeListeners: Map<string, Set<ChangeListener>> = new Map();
  private connected = false;
  private lastSyncedAt: Date | null = null;

  async execute(_sql: string, _params?: unknown[]): Promise<MockQueryResult> {
    return {
      rows: {
        _array: [],
        length: 0,
        item: () => ({}),
      },
    };
  }

  async getAll<T>(_sql: string, _params?: unknown[]): Promise<T[]> {
    return [];
  }

  async get<T>(_sql: string, _params?: unknown[]): Promise<T | null> {
    return null;
  }

  async connect(): Promise<void> {
    this.connected = true;
    this.__emitStatusChange({
      connected: true,
      lastSyncedAt: this.lastSyncedAt,
      dataFlowStatus: { uploading: false, downloading: false },
    });
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.__emitStatusChange({
      connected: false,
      lastSyncedAt: this.lastSyncedAt,
      dataFlowStatus: { uploading: false, downloading: false },
    });
  }

  registerListener(listener: {
    statusChanged?: SyncStatusListener;
  }): () => void {
    if (listener.statusChanged) {
      this.statusListeners.add(listener.statusChanged);
    }
    return () => {
      if (listener.statusChanged) {
        this.statusListeners.delete(listener.statusChanged);
      }
    };
  }

  watch(
    _sql: string,
    _params: unknown[],
    _options: { onResult: (result: { rows: { _array: unknown[] } }) => void }
  ): { dispose: () => void } {
    return { dispose: vi.fn() };
  }

  __emitStatusChange(status: MockSyncStatus): void {
    this.statusListeners.forEach((listener) => listener(status));
  }

  __simulateSync(): void {
    this.lastSyncedAt = new Date();
    this.__emitStatusChange({
      connected: true,
      lastSyncedAt: this.lastSyncedAt,
      dataFlowStatus: { uploading: false, downloading: false },
    });
  }

  __simulateConflict(
    table: string,
    localData: Record<string, unknown>,
    remoteData: Record<string, unknown>
  ): { local: Record<string, unknown>; remote: Record<string, unknown> } {
    return { local: localData, remote: remoteData };
  }

  __setData(table: string, id: string, data: Record<string, unknown>): void {
    if (!this.data.has(table)) {
      this.data.set(table, new Map());
    }
    this.data.get(table)!.set(id, data);
  }

  __getData(table: string, id: string): Record<string, unknown> | undefined {
    return this.data.get(table)?.get(id);
  }

  __clearData(): void {
    this.data.clear();
  }

  __isConnected(): boolean {
    return this.connected;
  }
}

export const createMockPowerSyncDatabase = (): MockPowerSyncDatabase => {
  return new MockPowerSyncDatabase();
};

export const mockPowerSyncDatabase = createMockPowerSyncDatabase();

export const PowerSyncDatabase = vi.fn(() => mockPowerSyncDatabase);

export const Schema = vi.fn();
export const Table = vi.fn();
export const Column = vi.fn();

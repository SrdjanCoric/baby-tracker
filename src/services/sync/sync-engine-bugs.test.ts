import { describe, it, expect, beforeEach, vi } from 'vitest';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SyncEngine } from './sync-engine';
import { QueuedOperation } from './types';

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
}));

vi.mock('@react-native-community/netinfo', () => ({
  default: {
    fetch: vi.fn().mockResolvedValue({ isConnected: true, isInternetReachable: true }),
    addEventListener: vi.fn().mockReturnValue(() => {}),
  },
}));

vi.mock('../supabase', () => ({
  supabase: {
    from: vi.fn().mockReturnValue({
      insert: vi.fn().mockResolvedValue({ error: null }),
      update: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
      delete: vi.fn().mockReturnValue({
        eq: vi.fn().mockResolvedValue({ error: null }),
      }),
    }),
  },
}));

function createOperation(
  type: 'CREATE' | 'UPDATE' | 'DELETE',
  table: 'feedings' | 'sleep_sessions',
  entityId: string
): QueuedOperation {
  return {
    id: `op-${entityId}`,
    type,
    table,
    entityId,
    data: type === 'DELETE' ? null : { id: entityId, baby_id: 'baby-1' },
    timestamp: new Date().toISOString(),
    retryCount: 0,
  };
}

describe('Bug 2 fix: sync() waits for in-flight sync to complete', () => {
  let syncEngine: SyncEngine;

  beforeEach(() => {
    vi.clearAllMocks();
    syncEngine = new SyncEngine();
    syncEngine.setAuthContext({ householdId: 'h1', userId: 'u1' });
    syncEngine.setOnlineForTesting(true);
  });

  it('second sync() should wait for the first sync to finish', async () => {
    let pushResolve: () => void;
    const pushPromise = new Promise<void>(r => { pushResolve = r; });

    vi.spyOn(syncEngine as any, 'pullChanges').mockResolvedValue([]);
    vi.spyOn(syncEngine as any, 'pushChanges').mockImplementation(() => pushPromise);

    const op = createOperation('CREATE', 'sleep_sessions', 's1');
    await syncEngine.enqueueOperation(op);

    const firstSync = syncEngine.sync();

    let secondResolved = false;
    const secondSync = syncEngine.sync().then(() => { secondResolved = true; });

    await Promise.resolve();
    await Promise.resolve();
    expect(secondResolved).toBe(false);

    pushResolve!();
    await firstSync;
    await secondSync;
    expect(secondResolved).toBe(true);
  });

  it('foreground handler pattern: await sync() blocks until push completes', async () => {
    let pushResolve: () => void;
    const pushPromise = new Promise<void>(r => { pushResolve = r; });
    let pushCompleted = false;

    vi.spyOn(syncEngine as any, 'pullChanges').mockResolvedValue([]);
    vi.spyOn(syncEngine as any, 'pushChanges').mockImplementation(async () => {
      await pushPromise;
      pushCompleted = true;
    });

    const op = createOperation('CREATE', 'sleep_sessions', 's1');
    await syncEngine.enqueueOperation(op);

    syncEngine.sync();

    let refreshFired = false;
    const foregroundAwait = syncEngine.sync().then(() => {
      refreshFired = true;
    });

    await Promise.resolve();
    await Promise.resolve();
    expect(refreshFired).toBe(false);
    expect(pushCompleted).toBe(false);

    pushResolve!();
    await foregroundAwait;

    expect(pushCompleted).toBe(true);
    expect(refreshFired).toBe(true);
  });
});

describe('Bug 3: AsyncStorage read-modify-write race condition', () => {
  it('without lock: concurrent calls lose data (proves the bug exists)', async () => {
    const store: Record<string, string> = {};

    vi.mocked(AsyncStorage.getItem).mockImplementation(async (key: string) => {
      return store[key] ?? null;
    });
    vi.mocked(AsyncStorage.setItem).mockImplementation(async (key: string, value: string) => {
      store[key] = value;
    });

    const key = '@sleeps:baby-1';
    store[key] = JSON.stringify([{ id: 'existing-1' }]);

    async function updateLocalWithoutLock(
      updater: (entries: { id: string }[]) => { id: string }[]
    ): Promise<void> {
      const data = await AsyncStorage.getItem(key);
      const entries = data ? JSON.parse(data) : [];
      await AsyncStorage.setItem(key, JSON.stringify(updater(entries)));
    }

    const addPromise = updateLocalWithoutLock(entries => [...entries, { id: 'new-entry' }]);
    const deletePromise = updateLocalWithoutLock(entries => entries.filter(e => e.id !== 'existing-1'));

    await Promise.all([addPromise, deletePromise]);

    const finalData = JSON.parse(store[key]);
    const hasNewEntry = finalData.some((e: { id: string }) => e.id === 'new-entry');
    const hasExisting = finalData.some((e: { id: string }) => e.id === 'existing-1');

    const dataLost = !hasNewEntry || hasExisting;
    expect(dataLost).toBe(true);
  });

  it('with lock: concurrent calls preserve all data', async () => {
    const store: Record<string, string> = {};

    vi.mocked(AsyncStorage.getItem).mockImplementation(async (key: string) => {
      return store[key] ?? null;
    });
    vi.mocked(AsyncStorage.setItem).mockImplementation(async (key: string, value: string) => {
      store[key] = value;
    });

    const key = '@sleeps:baby-1';
    store[key] = JSON.stringify([{ id: 'existing-1' }]);

    const locks = new Map<string, Promise<void>>();

    function withLock<T>(lockKey: string, fn: () => Promise<T>): Promise<T> {
      const prev = locks.get(lockKey) ?? Promise.resolve();
      const next = prev.then(fn, fn);
      locks.set(lockKey, next.then(() => {}, () => {}));
      return next;
    }

    async function updateLocalWithLock(
      updater: (entries: { id: string }[]) => { id: string }[]
    ): Promise<void> {
      await withLock(key, async () => {
        const data = await AsyncStorage.getItem(key);
        const entries = data ? JSON.parse(data) : [];
        await AsyncStorage.setItem(key, JSON.stringify(updater(entries)));
      });
    }

    const addPromise = updateLocalWithLock(entries => [...entries, { id: 'new-entry' }]);
    const deletePromise = updateLocalWithLock(entries => entries.filter(e => e.id !== 'existing-1'));

    await Promise.all([addPromise, deletePromise]);

    const finalData = JSON.parse(store[key]);
    const hasNewEntry = finalData.some((e: { id: string }) => e.id === 'new-entry');
    const hasExisting = finalData.some((e: { id: string }) => e.id === 'existing-1');

    expect(hasNewEntry).toBe(true);
    expect(hasExisting).toBe(false);
  });
});

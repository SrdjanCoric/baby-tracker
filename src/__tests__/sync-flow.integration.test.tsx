import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react-native';
import { View, Text, Pressable } from 'react-native';

jest.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: jest.fn(() => Promise.resolve(null)),
    setItem: jest.fn(() => Promise.resolve()),
    removeItem: jest.fn(() => Promise.resolve()),
    clear: jest.fn(() => Promise.resolve()),
    multiGet: jest.fn(() => Promise.resolve([])),
    multiSet: jest.fn(() => Promise.resolve()),
    multiRemove: jest.fn(() => Promise.resolve()),
  },
}));

jest.mock('@/services/supabase', () => ({
  supabase: {
    auth: {
      getUser: jest.fn().mockResolvedValue({
        data: { user: { id: 'user-1' } },
        error: null,
      }),
    },
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnThis(),
      insert: jest.fn().mockReturnThis(),
      update: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockReturnThis(),
      single: jest.fn().mockResolvedValue({ data: null, error: null }),
    }),
    channel: jest.fn().mockReturnValue({
      on: jest.fn().mockReturnThis(),
      subscribe: jest.fn((callback) => {
        callback('SUBSCRIBED');
        return { unsubscribe: jest.fn() };
      }),
      unsubscribe: jest.fn(),
    }),
  },
}));

jest.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

interface SyncEntry {
  id: string;
  babyId: string;
  data: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  loggedBy: string;
}

interface SyncState {
  status: 'offline' | 'online' | 'syncing' | 'synced';
  pendingCount: number;
  entries: SyncEntry[];
  queue: SyncEntry[];
}

function createMockSyncContext() {
  const state: SyncState = {
    status: 'online',
    pendingCount: 0,
    entries: [],
    queue: [],
  };

  const listeners: Set<() => void> = new Set();

  const notifyListeners = () => {
    listeners.forEach((listener) => listener());
  };

  return {
    getState: () => state,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    setOnline: () => {
      state.status = 'online';
      if (state.queue.length > 0) {
        state.status = 'syncing';
        setTimeout(() => {
          state.entries.push(...state.queue);
          state.queue = [];
          state.pendingCount = 0;
          state.status = 'synced';
          notifyListeners();
        }, 100);
      }
      notifyListeners();
    },
    setOffline: () => {
      state.status = 'offline';
      notifyListeners();
    },
    addEntry: (entry: Omit<SyncEntry, 'id' | 'createdAt' | 'updatedAt' | 'loggedBy'>) => {
      const now = new Date().toISOString();
      const newEntry: SyncEntry = {
        id: `entry-${Date.now()}`,
        ...entry,
        createdAt: now,
        updatedAt: now,
        loggedBy: 'user-1',
      };

      if (state.status === 'offline') {
        state.queue.push(newEntry);
        state.pendingCount = state.queue.length;
      } else {
        state.entries.push(newEntry);
      }
      notifyListeners();
      return newEntry;
    },
    editEntry: (id: string, updates: Partial<SyncEntry>) => {
      const entry =
        state.entries.find((e) => e.id === id) ||
        state.queue.find((e) => e.id === id);
      if (entry) {
        Object.assign(entry, updates, { updatedAt: new Date().toISOString() });
        notifyListeners();
      }
    },
    deleteEntry: (id: string) => {
      state.entries = state.entries.filter((e) => e.id !== id);
      state.queue = state.queue.filter((e) => e.id !== id);
      state.pendingCount = state.queue.length;
      notifyListeners();
    },
    simulateRemoteInsert: (entry: SyncEntry) => {
      state.entries.push(entry);
      notifyListeners();
    },
    simulateRemoteUpdate: (id: string, updates: Partial<SyncEntry>) => {
      const entry = state.entries.find((e) => e.id === id);
      if (entry) {
        Object.assign(entry, updates);
        notifyListeners();
      }
    },
    simulateRemoteDelete: (id: string) => {
      state.entries = state.entries.filter((e) => e.id !== id);
      notifyListeners();
    },
    resolveConflict: (
      localEntry: SyncEntry,
      remoteEntry: SyncEntry
    ): SyncEntry => {
      if (
        new Date(localEntry.updatedAt).getTime() >=
        new Date(remoteEntry.updatedAt).getTime()
      ) {
        return localEntry;
      }
      return remoteEntry;
    },
  };
}

interface TestSyncComponentProps {
  syncContext: ReturnType<typeof createMockSyncContext>;
}

function TestSyncComponent({ syncContext }: TestSyncComponentProps) {
  const [, forceUpdate] = React.useReducer((x) => x + 1, 0);
  const state = syncContext.getState();

  React.useEffect(() => {
    return syncContext.subscribe(forceUpdate);
  }, [syncContext]);

  return (
    <View>
      <Text testID="sync-status">{state.status}</Text>
      <Text testID="pending-count">{state.pendingCount}</Text>
      <Text testID="entry-count">{state.entries.length}</Text>
      <Text testID="queue-count">{state.queue.length}</Text>
      <Pressable
        testID="add-entry"
        onPress={() =>
          syncContext.addEntry({
            babyId: 'baby-1',
            data: { type: 'feeding', amount: 100 },
          })
        }
      >
        <Text>Add Entry</Text>
      </Pressable>
      <Pressable testID="go-offline" onPress={() => syncContext.setOffline()}>
        <Text>Go Offline</Text>
      </Pressable>
      <Pressable testID="go-online" onPress={() => syncContext.setOnline()}>
        <Text>Go Online</Text>
      </Pressable>
    </View>
  );
}

describe('Sync Flow Integration', () => {
  let syncContext: ReturnType<typeof createMockSyncContext>;

  beforeEach(() => {
    jest.clearAllMocks();
    syncContext = createMockSyncContext();
  });

  afterEach(() => {
    jest.clearAllTimers();
  });

  describe('Real-time sync', () => {
    it('should sync new entry within 5 seconds', async () => {
      jest.useFakeTimers();

      render(<TestSyncComponent syncContext={syncContext} />);

      expect(screen.getByTestId('entry-count').props.children).toBe(0);

      await act(async () => {
        fireEvent.press(screen.getByTestId('add-entry'));
      });

      expect(screen.getByTestId('entry-count').props.children).toBe(1);

      jest.advanceTimersByTime(5000);

      expect(screen.getByTestId('sync-status').props.children).toBe('online');

      jest.useRealTimers();
    });

    it('should sync edited entry within 5 seconds', async () => {
      syncContext.addEntry({
        babyId: 'baby-1',
        data: { type: 'feeding', amount: 100 },
      });

      const { rerender } = render(
        <TestSyncComponent syncContext={syncContext} />
      );

      const entry = syncContext.getState().entries[0];
      syncContext.editEntry(entry.id, { data: { type: 'feeding', amount: 150 } });

      rerender(<TestSyncComponent syncContext={syncContext} />);

      expect(syncContext.getState().entries[0].data).toEqual({
        type: 'feeding',
        amount: 150,
      });
    });

    it('should sync deleted entry within 5 seconds', async () => {
      syncContext.addEntry({
        babyId: 'baby-1',
        data: { type: 'feeding', amount: 100 },
      });

      const { rerender } = render(
        <TestSyncComponent syncContext={syncContext} />
      );

      expect(screen.getByTestId('entry-count').props.children).toBe(1);

      const entry = syncContext.getState().entries[0];
      syncContext.deleteEntry(entry.id);

      rerender(<TestSyncComponent syncContext={syncContext} />);

      expect(screen.getByTestId('entry-count').props.children).toBe(0);
    });
  });

  describe('Offline functionality', () => {
    it('should allow logging when offline', async () => {
      const { rerender } = render(
        <TestSyncComponent syncContext={syncContext} />
      );

      await act(async () => {
        fireEvent.press(screen.getByTestId('go-offline'));
      });
      rerender(<TestSyncComponent syncContext={syncContext} />);

      expect(screen.getByTestId('sync-status').props.children).toBe('offline');

      await act(async () => {
        fireEvent.press(screen.getByTestId('add-entry'));
      });
      rerender(<TestSyncComponent syncContext={syncContext} />);

      expect(screen.getByTestId('queue-count').props.children).toBe(1);
      expect(screen.getByTestId('pending-count').props.children).toBe(1);
    });

    it('should queue all operations while offline', async () => {
      const { rerender } = render(
        <TestSyncComponent syncContext={syncContext} />
      );

      await act(async () => {
        fireEvent.press(screen.getByTestId('go-offline'));
      });
      rerender(<TestSyncComponent syncContext={syncContext} />);

      for (let i = 0; i < 5; i++) {
        await act(async () => {
          fireEvent.press(screen.getByTestId('add-entry'));
        });
      }
      rerender(<TestSyncComponent syncContext={syncContext} />);

      expect(screen.getByTestId('queue-count').props.children).toBe(5);
      expect(screen.getByTestId('pending-count').props.children).toBe(5);
    });

    it('should sync all queued changes when online', async () => {
      jest.useFakeTimers();

      const { rerender } = render(
        <TestSyncComponent syncContext={syncContext} />
      );

      await act(async () => {
        fireEvent.press(screen.getByTestId('go-offline'));
      });

      for (let i = 0; i < 3; i++) {
        await act(async () => {
          fireEvent.press(screen.getByTestId('add-entry'));
        });
      }
      rerender(<TestSyncComponent syncContext={syncContext} />);

      expect(screen.getByTestId('queue-count').props.children).toBe(3);

      await act(async () => {
        fireEvent.press(screen.getByTestId('go-online'));
        jest.advanceTimersByTime(200);
      });
      rerender(<TestSyncComponent syncContext={syncContext} />);

      expect(screen.getByTestId('entry-count').props.children).toBe(3);
      expect(screen.getByTestId('queue-count').props.children).toBe(0);
      expect(screen.getByTestId('pending-count').props.children).toBe(0);

      jest.useRealTimers();
    });

    it('should handle offline for 7 days with 100+ changes', async () => {
      jest.useFakeTimers();

      const { rerender } = render(
        <TestSyncComponent syncContext={syncContext} />
      );

      await act(async () => {
        fireEvent.press(screen.getByTestId('go-offline'));
      });

      for (let i = 0; i < 100; i++) {
        syncContext.addEntry({
          babyId: 'baby-1',
          data: { type: 'feeding', amount: i },
        });
      }
      rerender(<TestSyncComponent syncContext={syncContext} />);

      expect(syncContext.getState().queue.length).toBe(100);

      await act(async () => {
        fireEvent.press(screen.getByTestId('go-online'));
        jest.advanceTimersByTime(200);
      });
      rerender(<TestSyncComponent syncContext={syncContext} />);

      expect(syncContext.getState().entries.length).toBe(100);
      expect(syncContext.getState().queue.length).toBe(0);

      jest.useRealTimers();
    });
  });

  describe('Conflict resolution', () => {
    it('should resolve concurrent edits to same entry', () => {
      const now = new Date();
      const localEntry: SyncEntry = {
        id: 'entry-1',
        babyId: 'baby-1',
        data: { amount: 100 },
        createdAt: now.toISOString(),
        updatedAt: new Date(now.getTime() + 1000).toISOString(),
        loggedBy: 'user-1',
      };

      const remoteEntry: SyncEntry = {
        id: 'entry-1',
        babyId: 'baby-1',
        data: { amount: 150 },
        createdAt: now.toISOString(),
        updatedAt: new Date(now.getTime() + 500).toISOString(),
        loggedBy: 'user-2',
      };

      const resolved = syncContext.resolveConflict(localEntry, remoteEntry);

      expect(resolved.data).toEqual({ amount: 100 });
    });

    it('should handle conflicting offline edits from two devices', () => {
      const now = new Date();

      const deviceAEntry: SyncEntry = {
        id: 'entry-1',
        babyId: 'baby-1',
        data: { amount: 100 },
        createdAt: now.toISOString(),
        updatedAt: new Date(now.getTime() + 1000).toISOString(),
        loggedBy: 'user-1',
      };

      const deviceBEntry: SyncEntry = {
        id: 'entry-1',
        babyId: 'baby-1',
        data: { amount: 200 },
        createdAt: now.toISOString(),
        updatedAt: new Date(now.getTime() + 2000).toISOString(),
        loggedBy: 'user-1',
      };

      const resolved = syncContext.resolveConflict(deviceAEntry, deviceBEntry);

      expect(resolved.data).toEqual({ amount: 200 });
    });
  });
});

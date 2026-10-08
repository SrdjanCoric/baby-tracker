import React from 'react';
import TestRenderer, { act } from 'react-test-renderer';

jest.unmock('./sync-context');
jest.unmock('@/services/foreground-refresh-coordinator');
const mockAuth = { householdId: 'household-1', userId: 'caregiver-1' };
const mockEngine = {
  subscribe: jest.fn(() => jest.fn()), initialize: jest.fn().mockResolvedValue(undefined),
  getAuthContext: jest.fn(() => mockAuth as typeof mockAuth | null),
  getPendingCount: jest.fn(() => 0), getState: jest.fn(() => ({ isConnected: true })),
  sync: jest.fn().mockResolvedValue(undefined), destroy: jest.fn(),
  setAuthContext: jest.fn((auth) => { mockEngine.getAuthContext.mockReturnValue(auth); }),
};
const mockRealtime = {
  onRemoteChange: jest.fn(() => jest.fn()), onError: jest.fn(() => jest.fn()),
  onConnectionChange: jest.fn(() => jest.fn()), onSubscriptionReplaced: jest.fn(() => jest.fn()),
  setAuthContext: jest.fn(), subscribeToHousehold: jest.fn().mockResolvedValue(undefined), destroy: jest.fn(),
};
jest.mock('@/services/sync', () => ({
  SyncEngine: jest.fn(() => mockEngine), RealTimeSync: jest.fn(() => mockRealtime),
  isCrdtTable: jest.fn(() => false), reconcileRemoteChange: jest.fn(),
}));
jest.mock('@/services/sync/crdt-sync-instance', () => ({ getCrdtSync: jest.fn() }));

it('flushes pending saves before catching up replacements and coalesces five replacements during a blocked pull', async () => {
  const { SyncProvider, useSync } = require('./sync-context') as typeof import('./sync-context');
  let releaseFlush!: () => void;
  let releasePull!: () => void;
  const seen: number[] = [];
  let serverVersion = 1;
  const load = jest.fn(async () => {
    if (load.mock.calls.length === 1) await new Promise<void>(resolve => { releasePull = resolve; });
    seen.push(serverVersion);
  });
  mockEngine.getPendingCount.mockReturnValue(1);
  mockEngine.sync.mockImplementationOnce(() => new Promise<void>(resolve => { releaseFlush = resolve; }));
  function Listener() {
    const { registerForegroundRefreshLoader } = useSync();
    React.useEffect(() => registerForegroundRefreshLoader('feedings', load), [registerForegroundRefreshLoader]);
    return null;
  }
  let root!: TestRenderer.ReactTestRenderer;
  await act(async () => { root = TestRenderer.create(<SyncProvider><Listener /></SyncProvider>); });
  const ready = (mockRealtime.onConnectionChange.mock.calls as unknown as [((connected: boolean) => void)][])[0][0];
  const replaced = (mockRealtime.onSubscriptionReplaced.mock.calls as unknown as [(() => void)][])[0][0];
  await act(async () => { ready(true); ready(false); ready(true); });
  expect(load).not.toHaveBeenCalled();
  expect(mockEngine.sync).not.toHaveBeenCalled();
  await act(async () => { replaced(); });
  expect(mockEngine.sync).toHaveBeenCalledTimes(1);
  expect(load).not.toHaveBeenCalled();
  await act(async () => { releaseFlush(); });
  expect(load).toHaveBeenCalledTimes(1);
  serverVersion = 2;
  await act(async () => { for (let i = 0; i < 5; i++) replaced(); });
  expect(load).toHaveBeenCalledTimes(1);
  await act(async () => { releasePull(); });
  expect(load).toHaveBeenCalledTimes(2);
  expect(seen).toEqual([2, 2]);
  mockEngine.getAuthContext.mockReturnValue(null);
  await act(async () => { replaced(); });
  expect(load).toHaveBeenCalledTimes(2);
  await act(async () => { root.unmount(); });
});

it('waits for the matching roster before the first join and on household switches', async () => {
  jest.clearAllMocks();
  mockEngine.getAuthContext.mockReturnValue(null);
  const { SyncProvider, useSync } = require('./sync-context') as typeof import('./sync-context');
  let sync!: ReturnType<typeof useSync>;
  function Listener() { sync = useSync(); return null; }
  let root!: TestRenderer.ReactTestRenderer;
  await act(async () => { root = TestRenderer.create(<SyncProvider><Listener /></SyncProvider>); });
  await act(async () => { sync.setAuthContext('household-1', 'caregiver-1'); });
  expect(mockRealtime.subscribeToHousehold).not.toHaveBeenCalled();
  await act(async () => { sync.setRealtimeBabyIds('household-1', ['baby-1']); });
  expect(mockRealtime.subscribeToHousehold).toHaveBeenCalledTimes(1);
  expect(mockRealtime.subscribeToHousehold).toHaveBeenLastCalledWith('household-1', ['baby-1']);
  await act(async () => { sync.setAuthContext('household-2', 'caregiver-1'); });
  expect(mockRealtime.subscribeToHousehold).toHaveBeenCalledTimes(1);
  await act(async () => { sync.setRealtimeBabyIds('household-2', []); });
  expect(mockRealtime.subscribeToHousehold).toHaveBeenCalledTimes(2);
  expect(mockRealtime.subscribeToHousehold).toHaveBeenLastCalledWith('household-2', []);
  await act(async () => { root.unmount(); });
});

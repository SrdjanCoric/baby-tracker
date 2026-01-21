import { vi } from 'vitest';

type NetInfoStateListener = (state: MockNetInfoState) => void;

interface MockNetInfoState {
  type: 'wifi' | 'cellular' | 'none' | 'unknown';
  isConnected: boolean | null;
  isInternetReachable: boolean | null;
  details: {
    isConnectionExpensive: boolean;
  } | null;
}

let currentState: MockNetInfoState = {
  type: 'wifi',
  isConnected: true,
  isInternetReachable: true,
  details: {
    isConnectionExpensive: false,
  },
};

const listeners: Set<NetInfoStateListener> = new Set();

const fetch = vi.fn(async (): Promise<MockNetInfoState> => {
  return currentState;
});

const addEventListener = vi.fn((listener: NetInfoStateListener): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
});

const refresh = vi.fn(async (): Promise<MockNetInfoState> => {
  return currentState;
});

const __setOnline = (): void => {
  currentState = {
    type: 'wifi',
    isConnected: true,
    isInternetReachable: true,
    details: {
      isConnectionExpensive: false,
    },
  };
  listeners.forEach((listener) => listener(currentState));
};

const __setOffline = (): void => {
  currentState = {
    type: 'none',
    isConnected: false,
    isInternetReachable: false,
    details: null,
  };
  listeners.forEach((listener) => listener(currentState));
};

const __setCellular = (): void => {
  currentState = {
    type: 'cellular',
    isConnected: true,
    isInternetReachable: true,
    details: {
      isConnectionExpensive: true,
    },
  };
  listeners.forEach((listener) => listener(currentState));
};

const __getState = (): MockNetInfoState => currentState;

const __clearListeners = (): void => {
  listeners.clear();
};

const __reset = (): void => {
  __clearListeners();
  __setOnline();
  fetch.mockClear();
  addEventListener.mockClear();
  refresh.mockClear();
};

export default {
  fetch,
  addEventListener,
  refresh,
  __setOnline,
  __setOffline,
  __setCellular,
  __getState,
  __clearListeners,
  __reset,
};

export {
  fetch,
  addEventListener,
  refresh,
  __setOnline,
  __setOffline,
  __setCellular,
  __getState,
  __clearListeners,
  __reset,
};

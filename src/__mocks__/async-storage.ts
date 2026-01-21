import { vi } from 'vitest';

const mockStorage: Map<string, string> = new Map();

const getItem = vi.fn(async (key: string): Promise<string | null> => {
  return mockStorage.get(key) ?? null;
});

const setItem = vi.fn(async (key: string, value: string): Promise<void> => {
  mockStorage.set(key, value);
});

const removeItem = vi.fn(async (key: string): Promise<void> => {
  mockStorage.delete(key);
});

const clear = vi.fn(async (): Promise<void> => {
  mockStorage.clear();
});

const getAllKeys = vi.fn(async (): Promise<string[]> => {
  return Array.from(mockStorage.keys());
});

const multiGet = vi.fn(
  async (keys: string[]): Promise<readonly [string, string | null][]> => {
    return keys.map((key) => [key, mockStorage.get(key) ?? null] as const);
  }
);

const multiSet = vi.fn(async (keyValuePairs: [string, string][]): Promise<void> => {
  keyValuePairs.forEach(([key, value]) => {
    mockStorage.set(key, value);
  });
});

const multiRemove = vi.fn(async (keys: string[]): Promise<void> => {
  keys.forEach((key) => {
    mockStorage.delete(key);
  });
});

const multiMerge = vi.fn(
  async (keyValuePairs: [string, string][]): Promise<void> => {
    keyValuePairs.forEach(([key, value]) => {
      const existing = mockStorage.get(key);
      if (existing) {
        const merged = { ...JSON.parse(existing), ...JSON.parse(value) };
        mockStorage.set(key, JSON.stringify(merged));
      } else {
        mockStorage.set(key, value);
      }
    });
  }
);

const __getMockStorage = (): Map<string, string> => {
  return new Map(mockStorage);
};

const __clearMockStorage = (): void => {
  mockStorage.clear();
  getItem.mockClear();
  setItem.mockClear();
  removeItem.mockClear();
  clear.mockClear();
  getAllKeys.mockClear();
  multiGet.mockClear();
  multiSet.mockClear();
  multiRemove.mockClear();
  multiMerge.mockClear();
};

const __setMockData = (data: Record<string, string>): void => {
  Object.entries(data).forEach(([key, value]) => {
    mockStorage.set(key, value);
  });
};

export default {
  getItem,
  setItem,
  removeItem,
  clear,
  getAllKeys,
  multiGet,
  multiSet,
  multiRemove,
  multiMerge,
  __getMockStorage,
  __clearMockStorage,
  __setMockData,
};

export {
  getItem,
  setItem,
  removeItem,
  clear,
  getAllKeys,
  multiGet,
  multiSet,
  multiRemove,
  multiMerge,
  __getMockStorage,
  __clearMockStorage,
  __setMockData,
};

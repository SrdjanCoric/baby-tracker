const storageLocks = new Map<string, Promise<void>>();

export async function withStorageLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const previous = storageLocks.get(key) ?? Promise.resolve();
  let resolve: () => void;
  const current = new Promise<void>((r) => { resolve = r; });
  storageLocks.set(key, current);
  try {
    await previous;
    return await fn();
  } finally {
    resolve!();
    if (storageLocks.get(key) === current) {
      storageLocks.delete(key);
    }
  }
}

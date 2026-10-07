const storageLocks = new Map<string, Promise<void>>();

export function withStorageLock<T>(
  key: string,
  fn: () => Promise<T>
): Promise<T> {
  const previous = storageLocks.get(key) ?? Promise.resolve();
  const next = previous.then(fn, fn);
  storageLocks.set(
    key,
    next.then(
      () => {},
      () => {}
    )
  );
  return next;
}

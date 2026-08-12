export type ForegroundRefreshLoader = () => Promise<void>;

export interface ForegroundRefreshCoordinator {
  register(id: string, loader: ForegroundRefreshLoader): () => void;
  startWakeCycle(): void;
  noteOffline(): void;
  trigger(isOnline: boolean): Promise<void>;
}

export function createForegroundRefreshCoordinator(): ForegroundRefreshCoordinator {
  const loaders = new Map<string, ForegroundRefreshLoader>();
  let onlineSatisfied = false;
  let inFlight: { online: boolean; promise: Promise<void> } | null = null;

  const runPass = (online: boolean): Promise<void> => {
    const pass = Promise.allSettled(
      [...loaders.values()].map(loader => Promise.resolve().then(loader))
    ).then(results => {
      if (online && results.every(result => result.status === "fulfilled")) {
        onlineSatisfied = true;
      }
    });
    const flight = { online, promise: pass };
    inFlight = flight;
    void pass.finally(() => {
      if (inFlight === flight) inFlight = null;
    });
    return pass;
  };

  const trigger = (isOnline: boolean): Promise<void> => {
    if (isOnline && onlineSatisfied) return Promise.resolve();
    if (inFlight) {
      const joined = inFlight;
      return joined.promise.then(() => {
        if (isOnline && !onlineSatisfied && !joined.online) {
          return trigger(true);
        }
      });
    }
    return runPass(isOnline);
  };

  return {
    register(id, loader) {
      loaders.set(id, loader);
      return () => {
        if (loaders.get(id) === loader) loaders.delete(id);
      };
    },
    startWakeCycle() {
      onlineSatisfied = false;
    },
    noteOffline() {
      onlineSatisfied = false;
    },
    trigger,
  };
}

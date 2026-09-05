export interface LiveActivityPushRecord {
  activityId: string;
  babyId: string;
  timerInstanceId: string;
  userId: string;
  token?: string;
  ended: boolean;
}

export interface LiveActivityStartToken { deviceId: string; token: string }

interface TokenSyncDependencies {
  now?(): number;
  readStart?(): Promise<LiveActivityStartToken | null>;
  registerStart?(record: LiveActivityStartToken): Promise<void>;
  isActive?(record: LiveActivityPushRecord): Promise<boolean>;
  read(): Promise<LiveActivityPushRecord[]>;
  register(record: LiveActivityPushRecord): Promise<boolean>;
  remove(record: LiveActivityPushRecord): Promise<void>;
  acknowledge(activityId: string): Promise<void>;
  end(activityId: string): Promise<unknown>;
}

export function createLiveActivityTokenSynchronizer(
  userId: string,
  deps: TokenSyncDependencies
) {
  let disposed = false;
  let requested = false;
  let inFlight: Promise<void> | null = null;
  let syncedStart: string | undefined;
  let startSyncedAt = 0;
  const now = deps.now ?? Date.now;
  const synced = new Map<string, string>();

  async function drain() {
    while (requested && !disposed) {
      requested = false;
      for (const record of await deps.read()) {
        if (disposed) return;
        if (record.userId !== userId) {
          if (record.ended) await deps.acknowledge(record.activityId);
          continue;
        }
        const active = !record.ended && deps.isActive ? await deps.isActive(record) : true;
        if (disposed) return;
        if (record.ended) {
          await deps.remove(record);
          if (disposed) return;
          await deps.acknowledge(record.activityId);
          synced.delete(record.activityId);
        } else if (!active) {
          if (disposed) return;
          await deps.end(record.activityId);
          requested = true;
        } else if (
          record.token &&
          synced.get(record.activityId) !== record.token
        ) {
          const registered = await deps.register(record);
          if (disposed) return;
          if (registered) {
            synced.set(record.activityId, record.token);
          } else {
            // Registration serialized after a remote stop. Do not leave a newly
            // created activity ticking just because it missed the DELETE push.
            await deps.end(record.activityId);
            requested = true;
          }
        }
      }
      if (disposed) return;
      const start = await deps.readStart?.();
      if (disposed) return;
      if (start && deps.registerStart && (syncedStart !== `${start.deviceId}:${start.token}` || now() - startSyncedAt >= 60 * 60 * 1000)) {
        await deps.registerStart(start);
        if (disposed) return;
        syncedStart = `${start.deviceId}:${start.token}`;
        startSyncedAt = now();
      }
    }
  }

  const synchronizer = {
    sync(): Promise<void> {
      if (disposed) return Promise.resolve();
      requested = true;
      if (!inFlight)
        inFlight = drain().finally(() => {
          inFlight = null;
          if (requested && !disposed) return synchronizer.sync();
        });
      return inFlight;
    },
    dispose() {
      disposed = true;
      return inFlight ?? Promise.resolve();
    },
  };
  return synchronizer;
}

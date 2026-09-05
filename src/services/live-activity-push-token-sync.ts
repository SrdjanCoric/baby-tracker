export interface LiveActivityPushRecord {
  activityId: string;
  babyId: string;
  timerInstanceId: string;
  userId: string;
  token?: string;
  ended: boolean;
}

interface TokenSyncDependencies {
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
  const synced = new Map<string, string>();

  async function drain() {
    while (requested && !disposed) {
      requested = false;
      for (const record of await deps.read()) {
        if (disposed) return;
        if (record.userId !== userId) continue;
        if (record.ended) {
          await deps.remove(record);
          if (disposed) return;
          await deps.acknowledge(record.activityId);
          synced.delete(record.activityId);
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
    }
  }

  return {
    sync(): Promise<void> {
      if (disposed) return Promise.resolve();
      requested = true;
      if (!inFlight)
        inFlight = drain().finally(() => {
          inFlight = null;
        });
      return inFlight;
    },
    dispose() {
      disposed = true;
    },
  };
}

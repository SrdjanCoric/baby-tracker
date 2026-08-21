export interface WearSessionBridge {
  publishState(envelopeJson: string): Promise<void>;
}

export interface WearSessionRevisionStore {
  read(): Promise<number>;
  write(revision: number): Promise<void>;
}

export interface WearSessionActiveInput {
  account: {
    id: string;
    label: string;
  };
  baby: {
    id: string;
    name: string;
    timezone: string;
  };
  supabase: {
    url: string;
    anonKey: string;
  };
  accessToken: string;
  expiresAt: number;
}

interface WearActiveSessionEnvelopeV1 extends WearSessionActiveInput {
  version: 1;
  phoneEpoch: string;
  revision: number;
  disposition: "active";
}

export type WearSessionInvalidationReason =
  | "signed-out"
  | "account-switched"
  | "session-expired";

interface WearInvalidatedSessionEnvelopeV1 {
  version: 1;
  phoneEpoch: string;
  revision: number;
  disposition: "invalidated";
  reason: WearSessionInvalidationReason;
}

export interface WearSessionPublisher {
  publishActive(input: WearSessionActiveInput): Promise<void>;
  publishInvalidated(reason: WearSessionInvalidationReason): Promise<void>;
}

export function createWearSessionRefreshHandler(
  refreshSession: () => Promise<void>,
  handledRequestStore?: WearSessionRevisionStore
): (requestRevision: number) => Promise<void> {
  let lastHandledRevision = -1;
  let refreshTail: Promise<void> = Promise.resolve();

  return (requestRevision) => {
    const result = refreshTail.then(async () => {
      if (handledRequestStore) {
        lastHandledRevision = Math.max(
          lastHandledRevision,
          await handledRequestStore.read()
        );
      }
      if (
        !Number.isSafeInteger(requestRevision) ||
        requestRevision <= lastHandledRevision
      ) {
        return;
      }
      await refreshSession();
      lastHandledRevision = requestRevision;
      await handledRequestStore?.write(requestRevision);
    });
    refreshTail = result.catch(() => undefined);
    return result;
  };
}

export function createWearSessionPublisher(options: {
  bridge: WearSessionBridge;
  revisionStore: WearSessionRevisionStore;
  epochProvider: () => Promise<string>;
}): WearSessionPublisher {
  let publicationTail: Promise<void> = Promise.resolve();

  const enqueue = (operation: () => Promise<void>): Promise<void> => {
    const result = publicationTail.then(operation);
    publicationTail = result.catch(() => undefined);
    return result;
  };

  const nextRevision = async (): Promise<number> => {
    const revision = (await options.revisionStore.read()) + 1;
    await options.revisionStore.write(revision);
    return revision;
  };

  return {
    publishActive(input) {
      return enqueue(async () => {
        const envelope: WearActiveSessionEnvelopeV1 = {
          version: 1,
          phoneEpoch: await options.epochProvider(),
          revision: await nextRevision(),
          disposition: "active",
          ...input,
        };
        await options.bridge.publishState(JSON.stringify(envelope));
      });
    },
    publishInvalidated(reason) {
      return enqueue(async () => {
        const envelope: WearInvalidatedSessionEnvelopeV1 = {
          version: 1,
          phoneEpoch: await options.epochProvider(),
          revision: await nextRevision(),
          disposition: "invalidated",
          reason,
        };
        await options.bridge.publishState(JSON.stringify(envelope));
      });
    },
  };
}

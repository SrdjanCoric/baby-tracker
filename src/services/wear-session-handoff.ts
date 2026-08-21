export interface WearSessionBridge {
  publishState(envelopeJson: string): Promise<void>;
}

export interface WearSessionRevisionStore {
  read(): Promise<number>;
  write(revision: number): Promise<void>;
}

export interface WearSessionPendingPublicationStore {
  read(): Promise<string | null>;
  write(envelopeJson: string): Promise<void>;
  clear(): Promise<void>;
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
  pendingPublicationStore: WearSessionPendingPublicationStore;
}): WearSessionPublisher {
  let publicationTail: Promise<void> = Promise.resolve();

  const enqueue = (operation: () => Promise<void>): Promise<void> => {
    const result = publicationTail.then(operation);
    publicationTail = result.catch(() => undefined);
    return result;
  };

  const publishDurably = async (
    envelope: WearActiveSessionEnvelopeV1 | WearInvalidatedSessionEnvelopeV1
  ): Promise<void> => {
    const envelopeJson = JSON.stringify(envelope);
    await options.pendingPublicationStore.write(envelopeJson);
    await options.bridge.publishState(envelopeJson);
    await options.revisionStore.write(envelope.revision);
    await options.pendingPublicationStore.clear();
  };

  const replayPending = async (): Promise<void> => {
    const envelopeJson = await options.pendingPublicationStore.read();
    if (envelopeJson === null) return;
    const envelope = JSON.parse(envelopeJson) as { revision?: unknown };
    if (!Number.isSafeInteger(envelope.revision) || Number(envelope.revision) < 0) {
      throw new Error("Invalid pending Wear session publication");
    }
    const revision = Number(envelope.revision);
    await options.bridge.publishState(envelopeJson);
    const committedRevision = await options.revisionStore.read();
    await options.revisionStore.write(Math.max(committedRevision, revision));
    await options.pendingPublicationStore.clear();
  };

  return {
    publishActive(input) {
      return enqueue(async () => {
        await replayPending();
        const envelope: WearActiveSessionEnvelopeV1 = {
          version: 1,
          phoneEpoch: await options.epochProvider(),
          revision: (await options.revisionStore.read()) + 1,
          disposition: "active",
          ...input,
        };
        await publishDurably(envelope);
      });
    },
    publishInvalidated(reason) {
      return enqueue(async () => {
        await replayPending();
        const envelope: WearInvalidatedSessionEnvelopeV1 = {
          version: 1,
          phoneEpoch: await options.epochProvider(),
          revision: (await options.revisionStore.read()) + 1,
          disposition: "invalidated",
          reason,
        };
        await publishDurably(envelope);
      });
    },
  };
}

import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  createWearSessionPublisher,
  type WearSessionPendingPublicationStore,
  type WearSessionPublisher,
  type WearSessionRevisionStore,
} from "./wear-session-handoff";
import {
  loadWearSessionNativeAdapter,
  type WearSessionNativeAdapter,
} from "./wear-session-handoff-native";

const PUBLICATION_REVISION_KEY = "@wear_session_publication_revision";
const PENDING_PUBLICATION_KEY = "@wear_session_pending_publication";
export const HANDLED_REFRESH_REVISION_KEY =
  "@wear_session_handled_refresh_revision";

export function wearSessionRevisionStore(key: string): WearSessionRevisionStore {
  return {
    async read() {
      const raw = await AsyncStorage.getItem(key);
      const revision = raw === null ? -1 : Number(raw);
      return Number.isSafeInteger(revision) ? revision : -1;
    },
    async write(revision) {
      await AsyncStorage.setItem(key, String(revision));
    },
  };
}

export function wearSessionPendingPublicationStore(
  key: string
): WearSessionPendingPublicationStore {
  return {
    read: () => AsyncStorage.getItem(key),
    write: (envelopeJson) => AsyncStorage.setItem(key, envelopeJson),
    clear: () => AsyncStorage.removeItem(key),
  };
}

interface WearSessionPhoneRuntime {
  adapter: WearSessionNativeAdapter;
  publisher: WearSessionPublisher;
}

let runtime: WearSessionPhoneRuntime | null | undefined;

export function loadWearSessionPhoneRuntime(): WearSessionPhoneRuntime | null {
  if (runtime !== undefined) return runtime;
  const adapter = loadWearSessionNativeAdapter();
  runtime = adapter
    ? {
        adapter,
        publisher: createWearSessionPublisher({
          bridge: adapter,
          revisionStore: wearSessionRevisionStore(PUBLICATION_REVISION_KEY),
          epochProvider: adapter.getInstallEpoch,
          pendingPublicationStore: wearSessionPendingPublicationStore(
            PENDING_PUBLICATION_KEY
          ),
        }),
      }
    : null;
  return runtime;
}

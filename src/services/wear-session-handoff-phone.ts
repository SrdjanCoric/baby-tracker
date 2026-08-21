import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  createWearSessionPublisher,
  type WearSessionPublisher,
  type WearSessionRevisionStore,
} from "./wear-session-handoff";
import {
  loadWearSessionNativeAdapter,
  type WearSessionNativeAdapter,
} from "./wear-session-handoff-native";

const PUBLICATION_REVISION_KEY = "@wear_session_publication_revision";
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
        }),
      }
    : null;
  return runtime;
}

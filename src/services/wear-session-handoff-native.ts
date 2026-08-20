import { NativeEventEmitter, NativeModules, Platform } from "react-native";

import type { WearSessionBridge } from "./wear-session-handoff";

const REFRESH_REQUESTED_EVENT = "WearSessionRefreshRequested";

export interface WearSessionNativeModule {
  publishState(envelopeJson: string): Promise<void>;
  getPendingRefreshRequest(): Promise<number | null>;
  addListener(eventName: string): void;
  removeListeners(count: number): void;
}

interface WearSessionEventSubscription {
  remove(): void;
}

export interface WearSessionEventSource {
  addListener(
    eventName: string,
    listener: (revision: number) => void
  ): WearSessionEventSubscription;
}

export interface WearSessionNativeAdapter extends WearSessionBridge {
  getPendingRefreshRequest(): Promise<number | null>;
  subscribeRefreshRequests(listener: (revision: number) => void): () => void;
}

export function createWearSessionNativeAdapter(
  module: WearSessionNativeModule,
  events: WearSessionEventSource
): WearSessionNativeAdapter {
  return {
    publishState: (envelopeJson) => module.publishState(envelopeJson),
    getPendingRefreshRequest: () => module.getPendingRefreshRequest(),
    subscribeRefreshRequests(listener) {
      const subscription = events.addListener(REFRESH_REQUESTED_EVENT, listener);
      return () => subscription.remove();
    },
  };
}

export function loadWearSessionNativeAdapter(): WearSessionNativeAdapter | null {
  if (Platform.OS !== "android") return null;
  const module = NativeModules.WearSessionBridge as
    | WearSessionNativeModule
    | undefined;
  if (!module) return null;
  return createWearSessionNativeAdapter(
    module,
    new NativeEventEmitter(module) as WearSessionEventSource
  );
}

import { describe, expect, it, vi } from "vitest";

vi.mock("react-native", () => ({
  NativeEventEmitter: class {},
  NativeModules: {},
  Platform: { OS: "ios" },
}));

import { createWearSessionNativeAdapter } from "./wear-session-handoff-native";

describe("Wear session native adapter", () => {
  it("publishes state and exposes durable refresh requests", async () => {
    const publishState = vi.fn(async () => undefined);
    const getInstallEpoch = vi.fn(async () => "phone-install-1");
    const getPendingRefreshRequest = vi.fn(async () => 12);
    let nativeListener: ((revision: number) => void) | null = null;
    const remove = vi.fn();
    const adapter = createWearSessionNativeAdapter(
      {
        publishState,
        getInstallEpoch,
        getPendingRefreshRequest,
        addListener: vi.fn(),
        removeListeners: vi.fn(),
      },
      {
        addListener: (_event, listener) => {
          nativeListener = listener;
          return { remove };
        },
      }
    );
    const received: number[] = [];
    const unsubscribe = adapter.subscribeRefreshRequests((revision) => {
      received.push(revision);
    });

    await adapter.publishState('{"disposition":"active"}');
    expect(await adapter.getInstallEpoch()).toBe("phone-install-1");
    expect(await adapter.getPendingRefreshRequest()).toBe(12);
    nativeListener?.(13);
    unsubscribe();

    expect(publishState).toHaveBeenCalledWith('{"disposition":"active"}');
    expect(received).toEqual([13]);
    expect(remove).toHaveBeenCalledOnce();
  });
});

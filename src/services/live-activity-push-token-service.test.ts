import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  read: vi.fn(), acknowledge: vi.fn(), end: vi.fn(), rpc: vi.fn(), from: vi.fn(),
  listener: vi.fn(), removeListener: vi.fn(), network: vi.fn(), removeNetwork: vi.fn(),
  appState: vi.fn(), removeAppState: vi.fn(),
}));
vi.mock("react-native", () => ({
  Platform: { OS: "ios" },
  NativeModules: { LiveActivityController: { getLiveActivityPushRecords: mocks.read, acknowledgeLiveActivityEnd: mocks.acknowledge, endTimerActivity: mocks.end } },
  NativeEventEmitter: class { addListener = mocks.listener; },
  AppState: { addEventListener: mocks.appState },
}));
vi.mock("@react-native-community/netinfo", () => ({ default: { addEventListener: mocks.network } }));
vi.mock("@/services/supabase", () => ({ supabase: { rpc: mocks.rpc, from: mocks.from } }));
import { removeLiveActivityPushTokens, startLiveActivityPushTokenSync } from "./live-activity-push-token-service";

describe("native Live Activity token transport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listener.mockReturnValue({ remove: mocks.removeListener });
    mocks.appState.mockReturnValue({ remove: mocks.removeAppState });
    mocks.network.mockReturnValue(mocks.removeNetwork);
    mocks.rpc.mockResolvedValue({ data: true, error: null });
    mocks.acknowledge.mockResolvedValue(undefined);
  });

  it("removes the signing-out user's rows while the session is still available", async () => {
    const eq = vi.fn().mockResolvedValue({ error: null });
    mocks.from.mockReturnValue({ delete: () => ({ eq }) });
    await removeLiveActivityPushTokens("owner");
    expect(mocks.from).toHaveBeenCalledWith("live_activity_push_tokens");
    expect(eq).toHaveBeenCalledWith("user_id", "owner");
  });

  it("sends the native token with its timer and account, then removes only that activity on end", async () => {
    const record = { activityId: "native", babyId: "baby", timerInstanceId: "run", userId: "owner", token: "abc", ended: false };
    mocks.read.mockResolvedValue([record]);
    const eq = vi.fn();
    eq.mockReturnValue({ eq, then: (resolve: any) => Promise.resolve({ error: null }).then(resolve) });
    mocks.from.mockReturnValue({ delete: () => ({ eq }) });
    const stop = startLiveActivityPushTokenSync("owner");
    await vi.waitFor(() => expect(mocks.rpc).toHaveBeenCalledWith("register_live_activity_push_token", {
      p_baby_id: "baby", p_timer_instance_id: "run", p_activity_id: "native", p_device_token: "abc", p_is_sandbox: true, p_user_id: "owner",
    }));
    mocks.read.mockResolvedValue([{ ...record, ended: true }]);
    mocks.listener.mock.calls[0][1]();
    await vi.waitFor(() => expect(mocks.acknowledge).toHaveBeenCalledWith("native"));
    expect(eq.mock.calls).toEqual([["user_id", "owner"], ["activity_id", "native"]]);
    stop();
    expect(mocks.removeListener).toHaveBeenCalledOnce();
    expect(mocks.removeNetwork).toHaveBeenCalledOnce();
    expect(mocks.removeAppState).toHaveBeenCalledOnce();
  });
});

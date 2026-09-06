import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  start: vi.fn(), read: vi.fn(), acknowledge: vi.fn(), end: vi.fn(), rpc: vi.fn(), from: vi.fn(),
  listener: vi.fn(), removeListener: vi.fn(), network: vi.fn(), removeNetwork: vi.fn(),
  appState: vi.fn(), removeAppState: vi.fn(),
}));
vi.mock("react-native", () => ({
  Platform: { OS: "ios" },
  NativeModules: { LiveActivityController: { getLiveActivityStartToken: mocks.start, getLiveActivityPushRecords: mocks.read, acknowledgeLiveActivityEnd: mocks.acknowledge, endTimerActivity: mocks.end } },
  NativeEventEmitter: class { addListener = mocks.listener; },
  AppState: { addEventListener: mocks.appState },
}));
vi.mock("@react-native-community/netinfo", () => ({ default: { addEventListener: mocks.network } }));
vi.mock("@/services/supabase", () => ({ supabase: { rpc: mocks.rpc, from: mocks.from } }));
import { refreshLiveActivityPushTokens, removeLiveActivityPushTokens, startLiveActivityPushTokenSync } from "./live-activity-push-token-service";

describe("native Live Activity token transport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.listener.mockReturnValue({ remove: mocks.removeListener });
    mocks.appState.mockReturnValue({ remove: mocks.removeAppState });
    mocks.network.mockReturnValue(mocks.removeNetwork);
    mocks.rpc.mockResolvedValue({ data: true, error: null });
    mocks.acknowledge.mockResolvedValue(undefined);
    mocks.start.mockResolvedValue(null);
  });

  it("reconciles a registered mirror after a realtime refresh even without token rotation", async () => {
    const record = { activityId: "mirror", babyId: "baby", timerInstanceId: "run", userId: "member", token: "token", ended: false };
    let active = true;
    mocks.read.mockResolvedValue([record]);
    const query: any = { select: () => query, eq: () => query, limit: async () => ({ data: active ? [{ id: "run" }] : [], error: null }) };
    mocks.from.mockReturnValue(query);
    mocks.end.mockImplementation(async () => { mocks.read.mockResolvedValue([]); });
    const stop = startLiveActivityPushTokenSync("member");
    try {
      await vi.waitFor(() => expect(mocks.rpc).toHaveBeenCalledWith("register_live_activity_push_token", expect.anything()));
      active = false;
      refreshLiveActivityPushTokens();
      await vi.waitFor(() => expect(mocks.end).toHaveBeenCalledWith("mirror"));
    } finally { stop(); }
  });

  it("registers a native push-to-start token for the current account and device", async () => {
    mocks.read.mockResolvedValue([]);
    mocks.start.mockResolvedValue({ deviceId: "phone", token: "start-token" });
    const stop = startLiveActivityPushTokenSync("member");
    try {
      await vi.waitFor(() => expect(mocks.rpc).toHaveBeenCalledWith("register_live_activity_start_token", {
        p_device_id: "phone", p_device_token: "start-token", p_is_sandbox: true, p_user_id: "member",
      }));
    } finally { stop(); }
  });

  it("attempts start-token cleanup even when activity-token cleanup fails", async () => {
    const failure = new Error("offline");
    mocks.start.mockResolvedValue({ deviceId: "phone", token: "start-token" });
    const startDelete = vi.fn();
    startDelete.mockReturnValue({ eq: startDelete, then: (resolve: any) => Promise.resolve({ error: null }).then(resolve) });
    mocks.from.mockImplementation(table => ({ delete: () => ({
      eq: table === "live_activity_push_tokens"
        ? vi.fn().mockRejectedValue(failure) : startDelete,
    }) }));
    await expect(removeLiveActivityPushTokens("owner")).rejects.toThrow("offline");
    expect(startDelete).toHaveBeenCalledWith("user_id", "owner");
  });

  it("removes only the signing-out installation's start token", async () => {
    mocks.start.mockResolvedValue({ deviceId: "phone", token: "start-token" });
    const startRows = [{ user_id: "owner", device_id: "phone" }, { user_id: "owner", device_id: "tablet" }];
    mocks.from.mockImplementation(table => {
      const filters: Record<string, string> = {};
      const query: any = {
        delete: () => query,
        eq: (key: string, value: string) => { filters[key] = value; return query; },
        then: (resolve: any) => {
          if (table === "live_activity_start_tokens") {
            for (let i = startRows.length - 1; i >= 0; i--)
              if (Object.entries(filters).every(([key, value]) => startRows[i][key as "user_id" | "device_id"] === value))
                startRows.splice(i, 1);
          }
          return Promise.resolve({ error: null }).then(resolve);
        },
      };
      return query;
    });
    await removeLiveActivityPushTokens("owner");
    expect(startRows).toEqual([{ user_id: "owner", device_id: "tablet" }]);
  });

  it("sends the native token with its timer and account, then removes only that activity on end", async () => {
    const record = { activityId: "native", babyId: "baby", timerInstanceId: "run", userId: "owner", token: "abc", ended: false };
    mocks.read.mockResolvedValue([record]);
    const eq = vi.fn();
    eq.mockReturnValue({ eq, then: (resolve: any) => Promise.resolve({ error: null }).then(resolve) });
    mocks.from.mockReturnValue({ delete: () => ({ eq }), select: () => ({ eq: () => ({ eq: () => ({ limit: async () => ({ data: [{ id: "run" }], error: null }) }) }) }) });
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

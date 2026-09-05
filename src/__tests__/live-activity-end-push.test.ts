import { describe, expect, it, vi } from "vitest";
import { endTimerLiveActivities } from "../../supabase/functions/send-widget-push/live-activity";

describe("timer DELETE Live Activity pushes", () => {
  it("does nothing when a timer has no registered token or is from a legacy client", async () => {
    const deps = {
      findTokens: vi.fn().mockResolvedValue([]),
      removeTokens: vi.fn(),
      getJwt: vi.fn(),
      fetch: vi.fn(),
      now: Date.now,
    };
    await endTimerLiveActivities(
      { baby_id: "baby", started_at: "2026-09-05T12:00:00Z" },
      deps
    );
    expect(deps.findTokens).not.toHaveBeenCalled();
    await endTimerLiveActivities(
      {
        baby_id: "baby",
        started_at: "2026-09-05T12:00:00Z",
        timer_data: { timerInstanceId: "run" },
      },
      deps
    );
    expect(deps.getJwt).not.toHaveBeenCalled();
    expect(deps.fetch).not.toHaveBeenCalled();
    expect(deps.removeTokens).not.toHaveBeenCalled();
  });

  it("cleans up a stopped timer even when APNS fails, and continues other devices", async () => {
    const removeTokens = vi.fn();
    const send = vi
      .fn()
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce(new Response(null, { status: 410 }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));
    const result = await endTimerLiveActivities(
      {
        baby_id: "baby",
        started_at: "2026-09-05T12:00:00Z",
        timer_data: { timerInstanceId: "run" },
      },
      {
        findTokens: async () =>
          ["a", "b", "c"].map((id) => ({
            id,
            device_token: id,
            is_sandbox: false,
          })),
        removeTokens,
        getJwt: async () => "jwt",
        fetch: send,
        now: () => Date.parse("2026-09-05T12:10:00Z"),
      }
    );
    expect(result).toEqual({ sent: 1, total: 3 });
    expect(removeTokens).toHaveBeenCalledWith(["a", "b", "c"]);
    expect(
      JSON.parse(send.mock.calls[2][1].body).aps["content-state"].elapsedSeconds
    ).toBe(600);
  });
  it("ends the exact timer's activity on every registered device, including the starter", async () => {
    const findTokens = vi.fn().mockResolvedValue([
      { id: "starter-activity", device_token: "token-a", is_sandbox: false },
      { id: "mirrored-activity", device_token: "token-b", is_sandbox: true },
    ]);
    const removeTokens = vi.fn().mockResolvedValue(undefined);
    const send = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    const result = await endTimerLiveActivities(
      {
        baby_id: "baby",
        started_at: "2026-09-05T12:00:00Z",
        timer_data: {
          timerInstanceId: "instance",
          isPaused: true,
          pausedAt: "2026-09-05T12:10:00Z",
          sleepType: "nap",
        },
      },
      {
        findTokens,
        removeTokens,
        getJwt: async () => "jwt",
        fetch: send,
        now: () => Date.parse("2026-09-05T12:20:00Z"),
      }
    );

    expect(findTokens).toHaveBeenCalledWith("baby", "instance");
    expect(send.mock.calls.map(([url]) => url)).toEqual([
      "https://api.push.apple.com/3/device/token-a",
      "https://api.sandbox.push.apple.com/3/device/token-b",
    ]);
    expect(send.mock.calls[0][1].headers).toMatchObject({
      "apns-push-type": "liveactivity",
      "apns-topic": "com.sofibaby.app.push-type.liveactivity",
      "apns-priority": "10",
    });
    expect(JSON.parse(send.mock.calls[0][1].body)).toEqual({
      aps: {
        timestamp: 1788610800,
        event: "end",
        "dismissal-date": 1788610799,
        "content-state": {
          elapsedSeconds: 600,
          context: "nap",
          isPaused: true,
          effectiveStartTimeISO: null,
        },
      },
    });
    expect(removeTokens).toHaveBeenCalledWith([
      "starter-activity",
      "mirrored-activity",
    ]);
    expect(result).toEqual({ sent: 2, total: 2 });
  });
});

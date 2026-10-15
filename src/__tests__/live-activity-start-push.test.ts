import { describe, expect, it, vi } from "vitest";
import { startTimerLiveActivities } from "../../supabase/functions/send-widget-push/live-activity";

describe("household timer INSERT Live Activities", () => {
  it("consumes and logs every rejected APNs response", async () => {
    const log = vi.spyOn(console, "error").mockImplementation(() => {});
    const responses = [new Response('{"reason":"TopicDisallowed"}', { status: 400 }),
      new Response('{"reason":"Unregistered"}', { status: 410 }),
      new Response('{"reason":"InternalServerError"}', { status: 500 })];
    let next = 0;
    try {
      await startTimerLiveActivities({
        baby_id: "baby", activity_type: "sleep", started_by: "starter",
        started_at: "2026-09-05T12:00:00Z", timer_data: { timerInstanceId: "run" },
      }, { babyName: "Baby", starterName: "Alice", memberIds: ["member"],
        findTokens: async () => ["a", "b", "c"].map(id => ({ id, user_id: "member", device_token: id, is_sandbox: false })),
        removeTokens: vi.fn(), getJwt: async () => "jwt",
        fetch: vi.fn(async () => responses[next++]), now: Date.now });
      expect(responses.every(response => response.bodyUsed)).toBe(true);
      expect(log.mock.calls.flat().join(" ")).toContain("TopicDisallowed");
      expect(log.mock.calls.flat().join(" ")).toContain("Unregistered");
      expect(log.mock.calls.flat().join(" ")).toContain("InternalServerError");
    } finally { log.mockRestore(); }
  });

  it("removes BadDeviceToken responses but retains other rejected tokens", async () => {
    const removeTokens = vi.fn();
    const send = vi.fn()
      .mockResolvedValueOnce(new Response('{"reason":"BadDeviceToken"}', { status: 400 }))
      .mockResolvedValueOnce(new Response('{"reason":"TopicDisallowed"}', { status: 400 }));
    await startTimerLiveActivities({
      baby_id: "baby", activity_type: "sleep", started_by: "starter",
      started_at: "2026-09-05T12:00:00Z", timer_data: { timerInstanceId: "run" },
    }, { babyName: "Baby", starterName: "Alice", memberIds: ["member"],
      findTokens: async () => ["bad", "topic"].map(id => ({ id, user_id: "member", device_token: id, is_sandbox: false })),
      removeTokens, getJwt: async () => "jwt", fetch: send, now: Date.now });
    expect(removeTokens).toHaveBeenCalledWith(["bad"]);
  });

  it("continues after one device fails and only removes expired start tokens", async () => {
    const send = vi.fn().mockRejectedValueOnce(new Error("offline"))
      .mockResolvedValueOnce(new Response(null, { status: 410 }))
      .mockResolvedValueOnce(new Response(null, { status: 200 }));
    const removeTokens = vi.fn();
    const result = await startTimerLiveActivities({
      baby_id: "baby", activity_type: "sleep", started_by: "starter", started_at: "2026-09-05T12:00:00Z",
      timer_data: { timerInstanceId: "run" },
    }, { babyName: "Baby", starterName: "Alice", memberIds: ["member"],
      findTokens: async () => ["a", "b", "c"].map(id => ({ id, user_id: "member", device_token: id, is_sandbox: false })),
      removeTokens, getJwt: async () => "jwt", fetch: send, now: Date.now });
    expect(result).toEqual({ sent: 1, total: 3 });
    expect(removeTokens).toHaveBeenCalledWith(["b"]);
  });

  it("silently skips legacy timers without a stable instance", async () => {
    const findTokens = vi.fn();
    const result = await startTimerLiveActivities({
      baby_id: "baby", activity_type: "sleep", started_by: "starter", started_at: "2026-09-05T12:00:00Z",
    }, { babyName: "Baby", starterName: "Alice", memberIds: ["member"],
      findTokens, removeTokens: vi.fn(), getJwt: vi.fn(), fetch: vi.fn(), now: Date.now });
    expect(result).toEqual({ sent: 0, total: 0 });
    expect(findTokens).not.toHaveBeenCalled();
  });

  it.each([
    ["feeding", false, 1200],
    ["pumping", false, 1200],
    ["tummy_time", false, 1200],
    ["tummy_time", true, 900],
    // Sleep keeps the shift listed as a known bug in docs/usage/timers.md.
    ["sleep", false, 1200],
  ])("shows other members a %s timer (paused=%s) without its resumed pauses", async (activityType, isPaused, expected) => {
    const send = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    await startTimerLiveActivities({
      baby_id: "baby", activity_type: activityType, started_by: "starter",
      started_at: "2026-09-05T12:00:00Z",
      timer_data: { timerInstanceId: "run", totalPausedMs: 600_000, isPaused,
        pausedAt: isPaused ? "2026-09-05T12:25:00Z" : undefined },
    }, { babyName: "Sofi", starterName: "Alice", memberIds: ["starter", "member"],
      findTokens: async () => [{ id: "b", user_id: "member", device_token: "b", is_sandbox: false }],
      removeTokens: vi.fn(), getJwt: async () => "jwt", fetch: send,
      now: () => Date.parse("2026-09-05T12:30:00Z") });

    expect(JSON.parse(send.mock.calls[0][1].body).aps["content-state"]).toMatchObject({
      elapsedSeconds: expected,
      isPaused,
      effectiveStartTimeISO: "2026-09-05T12:10:00.000Z",
    });
  });

  it("addresses only other household members, with recipient identity and Swift timer attributes", async () => {
    const send = vi.fn().mockResolvedValue(new Response(null, { status: 200 }));
    const findTokens = vi.fn().mockResolvedValue([
      { id: "a", user_id: "starter", device_token: "a", is_sandbox: false },
      { id: "b", user_id: "member", device_token: "b", is_sandbox: true },
      { id: "c", user_id: "outsider", device_token: "c", is_sandbox: false },
      { id: "d", user_id: "member", device_token: "d", is_sandbox: false },
    ]);
    const result = await startTimerLiveActivities({
      baby_id: "baby", activity_type: "tummy_time", started_by: "starter",
      started_at: "2026-09-05T12:00:00Z", timer_data: { timerInstanceId: "run" },
    }, { babyName: "Sofi", starterName: "Alice", memberIds: ["starter", "member"],
      findTokens, removeTokens: vi.fn(), getJwt: async () => "jwt", fetch: send,
      now: () => Date.parse("2026-09-05T12:00:10Z") });
    expect(findTokens).toHaveBeenCalledWith(["member"]);
    expect(result).toEqual({ sent: 2, total: 2 });
    expect(send.mock.calls.map(call => call[0])).toEqual([
      "https://api.sandbox.push.apple.com/3/device/b", "https://api.push.apple.com/3/device/d",
    ]);
    expect(send.mock.calls[0][1].headers).toMatchObject({
      "apns-push-type": "liveactivity", "apns-topic": "com.sofibaby.app.push-type.liveactivity",
      "apns-priority": "10",
    });
    expect(JSON.parse(send.mock.calls[0][1].body)).toEqual({ aps: {
      timestamp: 1788609610, event: "start", "attributes-type": "TimerActivityAttributes",
      attributes: { activityType: "tummyTime", babyName: "Sofi", startTime: 810302400,
        babyId: "baby", timerInstanceId: "run", userId: "member", starterName: "Alice" },
      "content-state": { elapsedSeconds: 10, context: null, isPaused: false, effectiveStartTimeISO: null },
      alert: { title: "Sofi", body: "Alice" },
    } });
  });
});

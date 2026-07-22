import { describe, expect, it, vi } from "vitest";
import {
  ToggleTimerMutationError,
  createToggleTimerPauseHandler,
} from "../../../supabase/functions/toggle-timer-pause/handler";

describe("toggle timer pause Edge Function authorization", () => {
  it("rejects a missing bearer token before mutation or notification work", async () => {
    const authenticate = vi.fn();
    const mutateTimer = vi.fn();
    const sendNotifications = vi.fn();
    const handler = createToggleTimerPauseHandler({
      authenticate,
      mutateTimer,
      sendNotifications,
    });

    const response = await handler(new Request("http://localhost/toggle-timer-pause", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        babyId: "7a000000-0000-0000-0000-000000000001",
        activityType: "sleep",
        action: "pause",
        timerData: {
          isPaused: true,
          pausedAt: "2026-07-21T12:00:00.000Z",
        },
      }),
    }));

    expect(response.status).toBe(401);
    expect(authenticate).not.toHaveBeenCalled();
    expect(mutateTimer).not.toHaveBeenCalled();
    expect(sendNotifications).not.toHaveBeenCalled();
  });

  it("rejects an invalid bearer token before mutation or notification work", async () => {
    const authenticate = vi.fn().mockResolvedValue(null);
    const mutateTimer = vi.fn();
    const sendNotifications = vi.fn();
    const handler = createToggleTimerPauseHandler({
      authenticate,
      mutateTimer,
      sendNotifications,
    });

    const response = await handler(new Request("http://localhost/toggle-timer-pause", {
      method: "POST",
      headers: {
        authorization: "Bearer expired-token",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        babyId: "7a000000-0000-0000-0000-000000000001",
        activityType: "sleep",
        action: "pause",
        timerData: {
          isPaused: true,
          pausedAt: "2026-07-21T12:00:00.000Z",
        },
      }),
    }));

    expect(response.status).toBe(401);
    expect(authenticate).toHaveBeenCalledWith("expired-token");
    expect(mutateTimer).not.toHaveBeenCalled();
    expect(sendNotifications).not.toHaveBeenCalled();
  });

  it("rejects a payload user that differs from the authenticated caller", async () => {
    const authenticate = vi.fn().mockResolvedValue({ id: "caller-user" });
    const mutateTimer = vi.fn();
    const sendNotifications = vi.fn();
    const handler = createToggleTimerPauseHandler({
      authenticate,
      mutateTimer,
      sendNotifications,
    });

    const response = await handler(new Request("http://localhost/toggle-timer-pause", {
      method: "POST",
      headers: {
        authorization: "Bearer valid-token",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        babyId: "7a000000-0000-0000-0000-000000000001",
        activityType: "sleep",
        userId: "different-user",
        action: "pause",
        timerData: {
          isPaused: true,
          pausedAt: "2026-07-21T12:00:00.000Z",
        },
      }),
    }));

    expect(response.status).toBe(403);
    expect(mutateTimer).not.toHaveBeenCalled();
    expect(sendNotifications).not.toHaveBeenCalled();
  });

  it("rejects an unsupported timer action before mutation", async () => {
    const authenticate = vi.fn().mockResolvedValue({ id: "caller-user" });
    const mutateTimer = vi.fn();
    const sendNotifications = vi.fn();
    const handler = createToggleTimerPauseHandler({
      authenticate,
      mutateTimer,
      sendNotifications,
    });

    const response = await handler(new Request("http://localhost/toggle-timer-pause", {
      method: "POST",
      headers: {
        authorization: "Bearer valid-token",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        babyId: "7a000000-0000-0000-0000-000000000001",
        activityType: "sleep",
        action: "stop",
        timerData: { isPaused: false },
      }),
    }));

    expect(response.status).toBe(400);
    expect(mutateTimer).not.toHaveBeenCalled();
    expect(sendNotifications).not.toHaveBeenCalled();
  });

  it("mutates an authorized timer before sending notifications", async () => {
    const authenticate = vi.fn().mockResolvedValue({ id: "caller-user" });
    const mutateTimer = vi.fn().mockResolvedValue(undefined);
    const sendNotifications = vi.fn().mockResolvedValue({
      widgetPushCount: 2,
      liveActivityUpdated: true,
    });
    const handler = createToggleTimerPauseHandler({
      authenticate,
      mutateTimer,
      sendNotifications,
    });
    const payload = {
      babyId: "7a000000-0000-0000-0000-000000000001",
      activityType: "sleep",
      userId: "caller-user",
      action: "pause",
      timerData: {
        isPaused: true,
        pausedAt: "2026-07-21T12:00:00.000Z",
        accumulatedSeconds: 42,
      },
      elapsedSeconds: 42,
      liveActivityPushToken: "ab".repeat(32),
    };

    const response = await handler(new Request("http://localhost/toggle-timer-pause", {
      method: "POST",
      headers: {
        authorization: "Bearer valid-token",
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
    }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({
      success: true,
      widgetPushCount: 2,
      liveActivityUpdated: true,
    });
    expect(mutateTimer).toHaveBeenCalledWith(
      "valid-token",
      { id: "caller-user" },
      payload
    );
    expect(sendNotifications).toHaveBeenCalledWith(payload);
    expect(mutateTimer.mock.invocationCallOrder[0]).toBeLessThan(
      sendNotifications.mock.invocationCallOrder[0]
    );
  });

  it("returns forbidden without notifications when the database denies timer ownership", async () => {
    const authenticate = vi.fn().mockResolvedValue({ id: "caller-user" });
    const mutateTimer = vi.fn().mockRejectedValue(
      new ToggleTimerMutationError(403, "Timer control denied")
    );
    const sendNotifications = vi.fn();
    const handler = createToggleTimerPauseHandler({
      authenticate,
      mutateTimer,
      sendNotifications,
    });

    const response = await handler(new Request("http://localhost/toggle-timer-pause", {
      method: "POST",
      headers: {
        authorization: "Bearer valid-token",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        babyId: "7a000000-0000-0000-0000-000000000001",
        activityType: "sleep",
        action: "pause",
        timerData: {
          isPaused: true,
          pausedAt: "2026-07-21T12:00:00.000Z",
        },
      }),
    }));

    expect(response.status).toBe(403);
    expect(sendNotifications).not.toHaveBeenCalled();
  });

  it.each([
    ["non-UUID baby", { babyId: "not-a-uuid" }],
    ["unsupported activity", { activityType: "diaper" }],
    ["contradictory pause state", { timerData: { isPaused: false } }],
    ["invalid pause timestamp", {
      timerData: { isPaused: true, pausedAt: "not-a-date" },
    }],
    ["negative elapsed time", { elapsedSeconds: -1 }],
    ["malformed Live Activity token", { liveActivityPushToken: "../not-a-token" }],
  ])("rejects %s before mutation", async (_name, override) => {
    const authenticate = vi.fn().mockResolvedValue({ id: "caller-user" });
    const mutateTimer = vi.fn();
    const sendNotifications = vi.fn();
    const handler = createToggleTimerPauseHandler({
      authenticate,
      mutateTimer,
      sendNotifications,
    });
    const payload = {
      babyId: "7a000000-0000-0000-0000-000000000001",
      activityType: "sleep",
      action: "pause",
      timerData: {
        isPaused: true,
        pausedAt: "2026-07-21T12:00:00.000Z",
      },
      ...override,
    };

    const response = await handler(new Request("http://localhost/toggle-timer-pause", {
      method: "POST",
      headers: {
        authorization: "Bearer valid-token",
        "content-type": "application/json",
      },
      body: JSON.stringify(payload),
    }));

    expect(response.status).toBe(400);
    expect(mutateTimer).not.toHaveBeenCalled();
    expect(sendNotifications).not.toHaveBeenCalled();
  });

  it("sanitizes notification failures after an authorized mutation", async () => {
    const authenticate = vi.fn().mockResolvedValue({ id: "caller-user" });
    const mutateTimer = vi.fn().mockResolvedValue(undefined);
    const sendNotifications = vi.fn().mockRejectedValue(
      new Error("provider secret and private payload")
    );
    const handler = createToggleTimerPauseHandler({
      authenticate,
      mutateTimer,
      sendNotifications,
    });

    const response = await handler(new Request("http://localhost/toggle-timer-pause", {
      method: "POST",
      headers: {
        authorization: "Bearer valid-token",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        babyId: "7a000000-0000-0000-0000-000000000001",
        activityType: "sleep",
        action: "pause",
        timerData: {
          isPaused: true,
          pausedAt: "2026-07-21T12:00:00.000Z",
        },
      }),
    }));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "Timer updated but notifications failed",
    });
  });
});

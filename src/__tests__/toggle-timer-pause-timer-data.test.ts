import { describe, expect, it } from "vitest";
import { storedTimerData } from "../../supabase/functions/toggle-timer-pause/handler";

describe("toggle-timer-pause stored timer data", () => {
  it("keeps the real start when a resume also carries a Live Activity anchor", () => {
    expect(
      storedTimerData({
        babyId: "baby-1",
        activityType: "tummy_time",
        action: "resume",
        timerData: { isPaused: false, effectiveStartTime: "2026-08-06T10:00:00.000Z" },
        effectiveStartTimeISO: "2026-08-06T10:03:00.000Z",
      })
    ).toEqual({ isPaused: false, effectiveStartTime: "2026-08-06T10:00:00.000Z" });
  });

  it("stores the request's start when the timer data has none", () => {
    expect(
      storedTimerData({
        babyId: "baby-1",
        activityType: "sleep",
        action: "resume",
        timerData: { isPaused: false },
        effectiveStartTimeISO: "2026-08-06T10:00:00.000Z",
      })
    ).toEqual({ isPaused: false, effectiveStartTime: "2026-08-06T10:00:00.000Z" });
  });
});

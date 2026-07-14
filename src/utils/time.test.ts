import { describe, it, expect } from "vitest";
import {
  formatDuration,
  formatTime,
  formatHourValue,
  timeSince,
  calculateDuration,
  isToday,
  isYesterday,
  formatDayHeader,
  formatDate
} from "./time";

describe("formatDuration", () => {
  describe("long format", () => {
    it("formats zero seconds", () => {
      expect(formatDuration(0)).toBe("0:00");
    });

    it("formats seconds only", () => {
      expect(formatDuration(45)).toBe("0:45");
    });

    it("formats minutes and seconds", () => {
      expect(formatDuration(125)).toBe("2:05");
    });

    it("formats hours, minutes, and seconds", () => {
      expect(formatDuration(3661)).toBe("1:01:01");
    });

    it("formats multiple hours", () => {
      expect(formatDuration(7325)).toBe("2:02:05");
    });

    it("pads minutes and seconds with zeros", () => {
      expect(formatDuration(3605)).toBe("1:00:05");
    });

    it("handles negative values", () => {
      expect(formatDuration(-100)).toBe("0:00");
    });
  });

  describe("short format", () => {
    it("formats zero seconds", () => {
      expect(formatDuration(0, "short")).toBe("0m");
    });

    it("formats minutes only", () => {
      expect(formatDuration(300, "short")).toBe("5m");
    });

    it("formats hours and minutes", () => {
      expect(formatDuration(5400, "short")).toBe("1h 30m");
    });

    it("formats hours only when no minutes", () => {
      expect(formatDuration(7200, "short")).toBe("2h");
    });

    it("handles negative values", () => {
      expect(formatDuration(-100, "short")).toBe("0m");
    });
  });
});

describe("formatTime", () => {
  it("formats morning time", () => {
    const date = new Date(2024, 0, 15, 9, 30);
    expect(formatTime(date)).toBe("9:30 AM");
  });

  it("formats afternoon time", () => {
    const date = new Date(2024, 0, 15, 14, 45);
    expect(formatTime(date)).toBe("2:45 PM");
  });

  it("formats midnight as 12:00 AM", () => {
    const date = new Date(2024, 0, 15, 0, 0);
    expect(formatTime(date)).toBe("12:00 AM");
  });

  it("formats noon as 12:00 PM", () => {
    const date = new Date(2024, 0, 15, 12, 0);
    expect(formatTime(date)).toBe("12:00 PM");
  });

  it("pads minutes with zero", () => {
    const date = new Date(2024, 0, 15, 8, 5);
    expect(formatTime(date)).toBe("8:05 AM");
  });

  describe("24h format", () => {
    it("formats morning time", () => {
      const date = new Date(2024, 0, 15, 9, 30);
      expect(formatTime(date, "24h")).toBe("9:30");
    });

    it("formats afternoon time", () => {
      const date = new Date(2024, 0, 15, 14, 45);
      expect(formatTime(date, "24h")).toBe("14:45");
    });

    it("formats midnight as 0:00", () => {
      const date = new Date(2024, 0, 15, 0, 0);
      expect(formatTime(date, "24h")).toBe("0:00");
    });

    it("formats noon as 12:00", () => {
      const date = new Date(2024, 0, 15, 12, 0);
      expect(formatTime(date, "24h")).toBe("12:00");
    });

    it("pads minutes with zero", () => {
      const date = new Date(2024, 0, 15, 8, 5);
      expect(formatTime(date, "24h")).toBe("8:05");
    });
  });
});

describe("formatHourValue", () => {
  describe("12h format", () => {
    it("formats morning hour", () => {
      expect(formatHourValue(6)).toBe("6 AM");
    });

    it("formats afternoon hour", () => {
      expect(formatHourValue(19)).toBe("7 PM");
    });

    it("formats noon", () => {
      expect(formatHourValue(12)).toBe("12 PM");
    });

    it("formats midnight", () => {
      expect(formatHourValue(0)).toBe("12 AM");
    });
  });

  describe("24h format", () => {
    it("formats morning hour", () => {
      expect(formatHourValue(6, "24h")).toBe("6:00");
    });

    it("formats afternoon hour", () => {
      expect(formatHourValue(19, "24h")).toBe("19:00");
    });

    it("formats midnight", () => {
      expect(formatHourValue(0, "24h")).toBe("0:00");
    });

    it("formats noon", () => {
      expect(formatHourValue(12, "24h")).toBe("12:00");
    });
  });
});

describe("timeSince", () => {
  it("returns 0m for same time", () => {
    const now = new Date(2024, 0, 15, 12, 0);
    expect(timeSince(now, now)).toBe("0m");
  });

  it("returns minutes for short durations", () => {
    const start = new Date(2024, 0, 15, 11, 30);
    const now = new Date(2024, 0, 15, 12, 0);
    expect(timeSince(start, now)).toBe("30m");
  });

  it("returns hours and minutes for longer durations", () => {
    const start = new Date(2024, 0, 15, 9, 45);
    const now = new Date(2024, 0, 15, 12, 0);
    expect(timeSince(start, now)).toBe("2h 15m");
  });

  it("handles future dates by returning 0m", () => {
    const future = new Date(2024, 0, 15, 14, 0);
    const now = new Date(2024, 0, 15, 12, 0);
    expect(timeSince(future, now)).toBe("0m");
  });

  it("returns days fallback when >= 24h without t function", () => {
    const start = new Date(2024, 0, 14, 10, 45);
    const now = new Date(2024, 0, 15, 12, 0);
    expect(timeSince(start, now)).toBe("1d");
  });

  it("returns multi-day fallback without t function", () => {
    const start = new Date(2024, 0, 13, 11, 0);
    const now = new Date(2024, 0, 15, 12, 0);
    expect(timeSince(start, now)).toBe("2d");
  });

  it("calls t function with dayCount key when >= 24h", () => {
    const start = new Date(2024, 0, 14, 10, 45);
    const now = new Date(2024, 0, 15, 12, 0);
    const mockT = ((key: string, opts?: Record<string, unknown>) =>
      `${key}:${JSON.stringify(opts)}`) as never;
    const result = timeSince(start, now, mockT);
    expect(result).toBe('time.dayCount:{"count":1}');
  });

  it("still returns hours format for 23h", () => {
    const start = new Date(2024, 0, 15, 1, 0);
    const now = new Date(2024, 0, 16, 0, 0);
    expect(timeSince(start, now)).toBe("23h");
  });
});

describe("calculateDuration", () => {
  it("calculates correct duration in seconds", () => {
    const start = new Date(2024, 0, 15, 10, 0, 0);
    const end = new Date(2024, 0, 15, 10, 5, 30);
    expect(calculateDuration(start, end)).toBe(330);
  });

  it("returns 0 for same time", () => {
    const time = new Date(2024, 0, 15, 10, 0);
    expect(calculateDuration(time, time)).toBe(0);
  });

  it("returns 0 for negative duration", () => {
    const start = new Date(2024, 0, 15, 12, 0);
    const end = new Date(2024, 0, 15, 10, 0);
    expect(calculateDuration(start, end)).toBe(0);
  });
});

describe("isToday", () => {
  it("returns true for same day", () => {
    const now = new Date(2024, 0, 15, 12, 0);
    const sameDay = new Date(2024, 0, 15, 8, 30);
    expect(isToday(sameDay, now)).toBe(true);
  });

  it("returns false for yesterday", () => {
    const now = new Date(2024, 0, 15, 12, 0);
    const yesterday = new Date(2024, 0, 14, 12, 0);
    expect(isToday(yesterday, now)).toBe(false);
  });

  it("returns false for tomorrow", () => {
    const now = new Date(2024, 0, 15, 12, 0);
    const tomorrow = new Date(2024, 0, 16, 12, 0);
    expect(isToday(tomorrow, now)).toBe(false);
  });

  it("returns false for same day different month", () => {
    const now = new Date(2024, 0, 15, 12, 0);
    const differentMonth = new Date(2024, 1, 15, 12, 0);
    expect(isToday(differentMonth, now)).toBe(false);
  });
});

describe("isYesterday", () => {
  it("returns true for previous day", () => {
    const now = new Date(2024, 0, 15, 12, 0);
    const yesterday = new Date(2024, 0, 14, 20, 0);
    expect(isYesterday(yesterday, now)).toBe(true);
  });

  it("returns false for today", () => {
    const now = new Date(2024, 0, 15, 12, 0);
    expect(isYesterday(now, now)).toBe(false);
  });

  it("returns false for two days ago", () => {
    const now = new Date(2024, 0, 15, 12, 0);
    const twoDaysAgo = new Date(2024, 0, 13, 12, 0);
    expect(isYesterday(twoDaysAgo, now)).toBe(false);
  });

  it("handles month boundaries", () => {
    const now = new Date(2024, 1, 1, 12, 0);
    const lastDayPrevMonth = new Date(2024, 0, 31, 12, 0);
    expect(isYesterday(lastDayPrevMonth, now)).toBe(true);
  });
});

describe("formatDayHeader", () => {
  it("returns 'Today' for current day", () => {
    const now = new Date(2024, 0, 15, 12, 0);
    const today = new Date(2024, 0, 15, 8, 0);
    expect(formatDayHeader(today, now)).toBe("Today");
  });

  it("returns 'Yesterday' for previous day", () => {
    const now = new Date(2024, 0, 15, 12, 0);
    const yesterday = new Date(2024, 0, 14, 20, 0);
    expect(formatDayHeader(yesterday, now)).toBe("Yesterday");
  });

  it("returns a locale-aware weekday for older dates", () => {
    const now = new Date(2024, 0, 15, 12, 0);
    const older = new Date(2024, 0, 10, 12, 0);
    const result = formatDayHeader(older, now);
    expect(result).toBe(older.toLocaleDateString(undefined, { weekday: "long" }));
  });
});

describe("formatDate", () => {
  it("formats the date using the device locale", () => {
    const date = new Date(2024, 0, 15);
    const result = formatDate(date);
    expect(result).toBe(date.toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    }));
  });
});

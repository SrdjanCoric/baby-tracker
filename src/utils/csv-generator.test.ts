import { describe, it, expect } from "vitest";
import {
  escapeCSVValue,
  formatCSVDate,
  formatCSVTime,
  formatCSVDuration,
  generateCSVRow,
  generateCSVHeader,
  formatFeedingsAsCSV,
  formatSleepAsCSV,
  formatDiapersAsCSV,
  formatPumpingAsCSV,
  formatGrowthAsCSV,
  formatTummyTimeAsCSV,
  generateCombinedExport,
} from "./csv-generator";
import type { StoredFeedingEntry } from "@/services/feeding-storage";
import type { StoredSleepEntry } from "@/services/sleep-storage";
import type { StoredDiaperEntry } from "@/services/diaper-storage";
import type { StoredPumpingEntry } from "@/services/pumping-storage";
import type { StoredGrowthEntry } from "@/services/growth-storage";
import type { StoredTummyTimeEntry } from "@/services/tummyTime-storage";

describe("escapeCSVValue", () => {
  it("should return empty string for null", () => {
    expect(escapeCSVValue(null)).toBe("");
  });

  it("should return empty string for undefined", () => {
    expect(escapeCSVValue(undefined)).toBe("");
  });

  it("should return value as-is when no special characters", () => {
    expect(escapeCSVValue("simple text")).toBe("simple text");
  });

  it("should wrap values with commas in quotes", () => {
    expect(escapeCSVValue("hello, world")).toBe('"hello, world"');
  });

  it("should escape existing quotes by doubling them", () => {
    expect(escapeCSVValue('say "hello"')).toBe('"say ""hello"""');
  });

  it("should handle newlines by wrapping in quotes", () => {
    expect(escapeCSVValue("line1\nline2")).toBe('"line1\nline2"');
  });

  it("should handle carriage return newlines", () => {
    expect(escapeCSVValue("line1\r\nline2")).toBe('"line1\r\nline2"');
  });

  it("should handle combination of special characters", () => {
    expect(escapeCSVValue('hello, "world"\nnew line')).toBe(
      '"hello, ""world""\nnew line"'
    );
  });

  it("should convert numbers to strings", () => {
    expect(escapeCSVValue(123)).toBe("123");
  });

  it("should handle zero", () => {
    expect(escapeCSVValue(0)).toBe("0");
  });

  it("should handle boolean true", () => {
    expect(escapeCSVValue(true)).toBe("true");
  });

  it("should handle boolean false", () => {
    expect(escapeCSVValue(false)).toBe("false");
  });

  describe("formula injection prevention", () => {
    it("should prefix values starting with = to prevent formula injection", () => {
      expect(escapeCSVValue("=SUM(A1:A10)")).toBe("'=SUM(A1:A10)");
    });

    it("should prefix values starting with + to prevent formula injection", () => {
      expect(escapeCSVValue("+1234567890")).toBe("'+1234567890");
    });

    it("should prefix values starting with - to prevent formula injection", () => {
      expect(escapeCSVValue("-5+2")).toBe("'-5+2");
    });

    it("should prefix values starting with @ to prevent formula injection", () => {
      expect(escapeCSVValue("@SUM(A1)")).toBe("'@SUM(A1)");
    });

    it("should prefix values starting with | to prevent formula injection", () => {
      expect(escapeCSVValue("|cmd")).toBe("'|cmd");
    });

    it("should not prefix values with formula chars not at beginning", () => {
      expect(escapeCSVValue("Value = 5")).toBe("Value = 5");
      expect(escapeCSVValue("A+B")).toBe("A+B");
    });

    it("should handle formula char with comma requiring quotes", () => {
      expect(escapeCSVValue("=SUM, hello")).toBe("\"'=SUM, hello\"");
    });
  });
});

describe("formatCSVDate", () => {
  it("should format date in ISO format (YYYY-MM-DD)", () => {
    const date = new Date("2024-03-15T10:30:00Z");
    expect(formatCSVDate(date)).toBe("2024-03-15");
  });

  it("should handle date string input", () => {
    expect(formatCSVDate("2024-03-15T10:30:00Z")).toBe("2024-03-15");
  });

  it("should return empty string for invalid date", () => {
    expect(formatCSVDate("invalid")).toBe("");
  });

  it("should return empty string for null", () => {
    expect(formatCSVDate(null)).toBe("");
  });

  it("should return empty string for undefined", () => {
    expect(formatCSVDate(undefined)).toBe("");
  });

  it("should pad month and day with zeros", () => {
    const date = new Date("2024-01-05T10:30:00Z");
    expect(formatCSVDate(date)).toBe("2024-01-05");
  });
});

describe("formatCSVTime", () => {
  it("should format time in 24-hour format (HH:mm)", () => {
    const date = new Date("2024-03-15T14:30:00");
    expect(formatCSVTime(date)).toBe("14:30");
  });

  it("should handle date string input", () => {
    const dateStr = new Date("2024-03-15T09:05:00").toISOString();
    expect(formatCSVTime(dateStr)).toBe("09:05");
  });

  it("should pad hours and minutes with zeros", () => {
    const date = new Date("2024-03-15T05:03:00");
    expect(formatCSVTime(date)).toBe("05:03");
  });

  it("should return empty string for invalid date", () => {
    expect(formatCSVTime("invalid")).toBe("");
  });

  it("should return empty string for null", () => {
    expect(formatCSVTime(null)).toBe("");
  });

  it("should handle midnight", () => {
    const date = new Date("2024-03-15T00:00:00");
    expect(formatCSVTime(date)).toBe("00:00");
  });
});

describe("formatCSVDuration", () => {
  it("should format duration as HH:MM:SS", () => {
    expect(formatCSVDuration(3661)).toBe("01:01:01");
  });

  it("should format zero seconds", () => {
    expect(formatCSVDuration(0)).toBe("00:00:00");
  });

  it("should format seconds only", () => {
    expect(formatCSVDuration(45)).toBe("00:00:45");
  });

  it("should format minutes and seconds", () => {
    expect(formatCSVDuration(125)).toBe("00:02:05");
  });

  it("should format hours correctly", () => {
    expect(formatCSVDuration(7200)).toBe("02:00:00");
  });

  it("should return empty string for null", () => {
    expect(formatCSVDuration(null)).toBe("");
  });

  it("should return empty string for undefined", () => {
    expect(formatCSVDuration(undefined)).toBe("");
  });

  it("should handle negative values by returning empty", () => {
    expect(formatCSVDuration(-100)).toBe("");
  });
});

describe("generateCSVRow", () => {
  it("should join values with commas", () => {
    expect(generateCSVRow(["a", "b", "c"])).toBe("a,b,c");
  });

  it("should handle empty array", () => {
    expect(generateCSVRow([])).toBe("");
  });

  it("should handle single value", () => {
    expect(generateCSVRow(["single"])).toBe("single");
  });

  it("should escape special characters in values", () => {
    expect(generateCSVRow(["hello, world", "simple", '"quoted"'])).toBe(
      '"hello, world",simple,"""quoted"""'
    );
  });
});

describe("generateCSVHeader", () => {
  it("should generate header row from column names", () => {
    expect(generateCSVHeader(["Date", "Time", "Type"])).toBe("Date,Time,Type");
  });

  it("should escape special characters in headers", () => {
    expect(generateCSVHeader(["Name, First", "Amount"])).toBe(
      '"Name, First",Amount'
    );
  });
});

describe("formatFeedingsAsCSV", () => {
  const mockFeedings: StoredFeedingEntry[] = [
    {
      id: "1",
      babyId: "baby1",
      type: "breast",
      side: "left",
      startedAt: "2024-03-15T10:00:00Z",
      endedAt: "2024-03-15T10:30:00Z",
      durationSeconds: 1800,
      leftDurationSeconds: 1800,
      rightDurationSeconds: 0,
      notes: "Good feed",
      createdAt: "2024-03-15T10:30:00Z",
      updatedAt: "2024-03-15T10:30:00Z",
      loggedBy: "user1",
    },
    {
      id: "2",
      babyId: "baby1",
      type: "bottle",
      startedAt: "2024-03-15T14:00:00Z",
      amountMl: 120,
      contentType: "formula",
      createdAt: "2024-03-15T14:00:00Z",
      updatedAt: "2024-03-15T14:00:00Z",
    },
    {
      id: "3",
      babyId: "baby1",
      type: "solid",
      startedAt: "2024-03-15T18:00:00Z",
      foodType: "Banana",
      amount: "full",
      reaction: "liked",
      createdAt: "2024-03-15T18:00:00Z",
      updatedAt: "2024-03-15T18:00:00Z",
    },
  ];

  it("should include header row", () => {
    const csv = formatFeedingsAsCSV(mockFeedings, true);
    const lines = csv.split("\n");
    expect(lines[0]).toContain("Date");
    expect(lines[0]).toContain("Time");
    expect(lines[0]).toContain("Type");
  });

  it("should format breastfeeding entries correctly", () => {
    const csv = formatFeedingsAsCSV([mockFeedings[0]], true);
    const lines = csv.split("\n");
    expect(lines[1]).toContain("breast");
    expect(lines[1]).toContain("left");
    expect(lines[1]).toContain("00:30:00");
  });

  it("should format bottle feeding entries correctly", () => {
    const csv = formatFeedingsAsCSV([mockFeedings[1]], true);
    const lines = csv.split("\n");
    expect(lines[1]).toContain("bottle");
    expect(lines[1]).toContain("120");
    expect(lines[1]).toContain("formula");
  });

  it("should format solid food entries correctly", () => {
    const csv = formatFeedingsAsCSV([mockFeedings[2]], true);
    const lines = csv.split("\n");
    expect(lines[1]).toContain("solid");
    expect(lines[1]).toContain("Banana");
    expect(lines[1]).toContain("full");
    expect(lines[1]).toContain("liked");
  });

  it("should handle empty data", () => {
    const csv = formatFeedingsAsCSV([], true);
    const lines = csv.split("\n").filter((l) => l.trim());
    expect(lines.length).toBe(1); // Just header
  });

  it("should escape commas in values", () => {
    const feedingWithComma: StoredFeedingEntry = {
      ...mockFeedings[0],
      notes: "Good, very good feed",
    };
    const csv = formatFeedingsAsCSV([feedingWithComma], true);
    expect(csv).toContain('"Good, very good feed"');
  });

  it("should escape quotes in values", () => {
    const feedingWithQuote: StoredFeedingEntry = {
      ...mockFeedings[0],
      notes: 'Baby said "yum"',
    };
    const csv = formatFeedingsAsCSV([feedingWithQuote], true);
    expect(csv).toContain('"Baby said ""yum"""');
  });

  it("should escape newlines in values", () => {
    const feedingWithNewline: StoredFeedingEntry = {
      ...mockFeedings[0],
      notes: "Line1\nLine2",
    };
    const csv = formatFeedingsAsCSV([feedingWithNewline], true);
    expect(csv).toContain('"Line1\nLine2"');
  });

  it("should handle missing optional fields", () => {
    const minimalFeeding: StoredFeedingEntry = {
      id: "4",
      babyId: "baby1",
      type: "breast",
      startedAt: "2024-03-15T10:00:00Z",
      createdAt: "2024-03-15T10:00:00Z",
      updatedAt: "2024-03-15T10:00:00Z",
    };
    const csv = formatFeedingsAsCSV([minimalFeeding], true);
    expect(csv).toBeTruthy();
    expect(csv.split("\n").length).toBeGreaterThan(1);
  });

  it("should exclude notes column when includeNotes is false", () => {
    const csv = formatFeedingsAsCSV(mockFeedings, false);
    expect(csv).not.toContain("Notes");
    expect(csv).not.toContain("Good feed");
  });
});

describe("formatSleepAsCSV", () => {
  const mockSleeps: StoredSleepEntry[] = [
    {
      id: "1",
      babyId: "baby1",
      type: "nap",
      startedAt: "2024-03-15T13:00:00Z",
      endedAt: "2024-03-15T14:30:00Z",
      durationSeconds: 5400,
      notes: "Good nap",
      createdAt: "2024-03-15T14:30:00Z",
      updatedAt: "2024-03-15T14:30:00Z",
      loggedBy: "user1",
    },
    {
      id: "2",
      babyId: "baby1",
      type: "night",
      startedAt: "2024-03-15T20:00:00Z",
      endedAt: "2024-03-16T06:00:00Z",
      durationSeconds: 36000,
      createdAt: "2024-03-16T06:00:00Z",
      updatedAt: "2024-03-16T06:00:00Z",
    },
  ];

  it("should include header row", () => {
    const csv = formatSleepAsCSV(mockSleeps, true);
    const lines = csv.split("\n");
    expect(lines[0]).toContain("Date");
    expect(lines[0]).toContain("Start Time");
    expect(lines[0]).toContain("End Time");
    expect(lines[0]).toContain("Duration");
    expect(lines[0]).toContain("Type");
  });

  it("should calculate duration correctly", () => {
    const csv = formatSleepAsCSV([mockSleeps[0]], true);
    const lines = csv.split("\n");
    expect(lines[1]).toContain("01:30:00");
  });

  it("should format nap vs night sleep", () => {
    const csv = formatSleepAsCSV(mockSleeps, true);
    expect(csv).toContain("nap");
    expect(csv).toContain("night");
  });

  it("should handle empty data", () => {
    const csv = formatSleepAsCSV([], true);
    const lines = csv.split("\n").filter((l) => l.trim());
    expect(lines.length).toBe(1);
  });

  it("should handle missing end time (ongoing sleep)", () => {
    const ongoingSleep: StoredSleepEntry = {
      id: "3",
      babyId: "baby1",
      type: "nap",
      startedAt: "2024-03-15T13:00:00Z",
      createdAt: "2024-03-15T13:00:00Z",
      updatedAt: "2024-03-15T13:00:00Z",
    };
    const csv = formatSleepAsCSV([ongoingSleep], true);
    expect(csv).toBeTruthy();
  });

  it("should exclude notes when includeNotes is false", () => {
    const csv = formatSleepAsCSV(mockSleeps, false);
    expect(csv).not.toContain("Notes");
    expect(csv).not.toContain("Good nap");
  });
});

describe("formatDiapersAsCSV", () => {
  const mockDiapers: StoredDiaperEntry[] = [
    {
      id: "1",
      babyId: "baby1",
      type: "wet",
      changedAt: "2024-03-15T10:00:00Z",
      notes: "Normal",
      createdAt: "2024-03-15T10:00:00Z",
      updatedAt: "2024-03-15T10:00:00Z",
      loggedBy: "user1",
    },
    {
      id: "2",
      babyId: "baby1",
      type: "dirty",
      stoolColor: "yellow",
      changedAt: "2024-03-15T14:00:00Z",
      createdAt: "2024-03-15T14:00:00Z",
      updatedAt: "2024-03-15T14:00:00Z",
    },
    {
      id: "3",
      babyId: "baby1",
      type: "mixed",
      stoolColor: "green",
      changedAt: "2024-03-15T18:00:00Z",
      createdAt: "2024-03-15T18:00:00Z",
      updatedAt: "2024-03-15T18:00:00Z",
    },
  ];

  it("should include header row", () => {
    const csv = formatDiapersAsCSV(mockDiapers, true);
    const lines = csv.split("\n");
    expect(lines[0]).toContain("Date");
    expect(lines[0]).toContain("Time");
    expect(lines[0]).toContain("Type");
    expect(lines[0]).toContain("Stool Color");
  });

  it("should include stool color for dirty diapers", () => {
    const csv = formatDiapersAsCSV([mockDiapers[1]], true);
    expect(csv).toContain("yellow");
  });

  it("should handle missing stool color for wet diapers", () => {
    const csv = formatDiapersAsCSV([mockDiapers[0]], true);
    const lines = csv.split("\n");
    expect(lines[1]).toContain("wet");
  });

  it("should handle empty data", () => {
    const csv = formatDiapersAsCSV([], true);
    const lines = csv.split("\n").filter((l) => l.trim());
    expect(lines.length).toBe(1);
  });

  it("should exclude notes when includeNotes is false", () => {
    const csv = formatDiapersAsCSV(mockDiapers, false);
    expect(csv).not.toContain("Notes");
    expect(csv).not.toContain("Normal");
  });
});

describe("formatPumpingAsCSV", () => {
  const mockPumpings: StoredPumpingEntry[] = [
    {
      id: "1",
      babyId: "baby1",
      side: "both",
      startedAt: "2024-03-15T10:00:00Z",
      endedAt: "2024-03-15T10:20:00Z",
      durationSeconds: 1200,
      volumeMl: 150,
      notes: "Good session",
      createdAt: "2024-03-15T10:20:00Z",
      updatedAt: "2024-03-15T10:20:00Z",
      loggedBy: "user1",
    },
    {
      id: "2",
      babyId: "baby1",
      side: "left",
      startedAt: "2024-03-15T14:00:00Z",
      endedAt: "2024-03-15T14:15:00Z",
      durationSeconds: 900,
      volumeMl: 80,
      createdAt: "2024-03-15T14:15:00Z",
      updatedAt: "2024-03-15T14:15:00Z",
    },
  ];

  it("should include header row", () => {
    const csv = formatPumpingAsCSV(mockPumpings, true);
    const lines = csv.split("\n");
    expect(lines[0]).toContain("Date");
    expect(lines[0]).toContain("Time");
    expect(lines[0]).toContain("Duration");
    expect(lines[0]).toContain("Volume (ml)");
    expect(lines[0]).toContain("Side");
  });

  it("should format volume in ml", () => {
    const csv = formatPumpingAsCSV([mockPumpings[0]], true);
    expect(csv).toContain("150");
  });

  it("should handle both/left/right side", () => {
    const csv = formatPumpingAsCSV(mockPumpings, true);
    expect(csv).toContain("both");
    expect(csv).toContain("left");
  });

  it("should handle empty data", () => {
    const csv = formatPumpingAsCSV([], true);
    const lines = csv.split("\n").filter((l) => l.trim());
    expect(lines.length).toBe(1);
  });

  it("should exclude notes when includeNotes is false", () => {
    const csv = formatPumpingAsCSV(mockPumpings, false);
    expect(csv).not.toContain("Notes");
    expect(csv).not.toContain("Good session");
  });
});

describe("formatGrowthAsCSV", () => {
  const mockGrowth: StoredGrowthEntry[] = [
    {
      id: "1",
      babyId: "baby1",
      measuredAt: "2024-03-15T10:00:00Z",
      weightKg: 5.5,
      heightCm: 60,
      headCircumferenceCm: 40,
      notes: "Doctor visit",
      createdAt: "2024-03-15T10:00:00Z",
      updatedAt: "2024-03-15T10:00:00Z",
      loggedBy: "user1",
    },
    {
      id: "2",
      babyId: "baby1",
      measuredAt: "2024-04-15T10:00:00Z",
      weightKg: 6.0,
      createdAt: "2024-04-15T10:00:00Z",
      updatedAt: "2024-04-15T10:00:00Z",
    },
  ];

  it("should include header row", () => {
    const csv = formatGrowthAsCSV(mockGrowth, true);
    const lines = csv.split("\n");
    expect(lines[0]).toContain("Date");
    expect(lines[0]).toContain("Weight (kg)");
    expect(lines[0]).toContain("Height (cm)");
    expect(lines[0]).toContain("Head Circumference (cm)");
  });

  it("should format measurements in metric", () => {
    const csv = formatGrowthAsCSV([mockGrowth[0]], true);
    expect(csv).toContain("5.5");
    expect(csv).toContain("60");
    expect(csv).toContain("40");
  });

  it("should handle partial measurements", () => {
    const csv = formatGrowthAsCSV([mockGrowth[1]], true);
    expect(csv).toContain("6");
    // Height and head should be empty
  });

  it("should handle empty data", () => {
    const csv = formatGrowthAsCSV([], true);
    const lines = csv.split("\n").filter((l) => l.trim());
    expect(lines.length).toBe(1);
  });

  it("should exclude notes when includeNotes is false", () => {
    const csv = formatGrowthAsCSV(mockGrowth, false);
    expect(csv).not.toContain("Notes");
    expect(csv).not.toContain("Doctor visit");
  });
});

describe("formatTummyTimeAsCSV", () => {
  const mockTummyTimes: StoredTummyTimeEntry[] = [
    {
      id: "1",
      babyId: "baby1",
      startedAt: "2024-03-15T10:00:00Z",
      endedAt: "2024-03-15T10:15:00Z",
      durationSeconds: 900,
      notes: "Enjoyed it",
      createdAt: "2024-03-15T10:15:00Z",
      updatedAt: "2024-03-15T10:15:00Z",
      loggedBy: "user1",
    },
    {
      id: "2",
      babyId: "baby1",
      startedAt: "2024-03-15T14:00:00Z",
      endedAt: "2024-03-15T14:10:00Z",
      durationSeconds: 600,
      createdAt: "2024-03-15T14:10:00Z",
      updatedAt: "2024-03-15T14:10:00Z",
    },
  ];

  it("should include header row", () => {
    const csv = formatTummyTimeAsCSV(mockTummyTimes, true);
    const lines = csv.split("\n");
    expect(lines[0]).toContain("Date");
    expect(lines[0]).toContain("Time");
    expect(lines[0]).toContain("Duration");
  });

  it("should format duration correctly", () => {
    const csv = formatTummyTimeAsCSV([mockTummyTimes[0]], true);
    expect(csv).toContain("00:15:00");
  });

  it("should handle empty data", () => {
    const csv = formatTummyTimeAsCSV([], true);
    const lines = csv.split("\n").filter((l) => l.trim());
    expect(lines.length).toBe(1);
  });

  it("should exclude notes when includeNotes is false", () => {
    const csv = formatTummyTimeAsCSV(mockTummyTimes, false);
    expect(csv).not.toContain("Notes");
    expect(csv).not.toContain("Enjoyed it");
  });
});

describe("generateCombinedExport", () => {
  const mockData = {
    feedings: [
      {
        id: "1",
        babyId: "baby1",
        type: "breast" as const,
        startedAt: "2024-03-15T10:00:00Z",
        createdAt: "2024-03-15T10:00:00Z",
        updatedAt: "2024-03-15T10:00:00Z",
      },
    ],
    sleep: [
      {
        id: "1",
        babyId: "baby1",
        type: "nap" as const,
        startedAt: "2024-03-15T13:00:00Z",
        createdAt: "2024-03-15T13:00:00Z",
        updatedAt: "2024-03-15T13:00:00Z",
      },
    ],
    diapers: [
      {
        id: "1",
        babyId: "baby1",
        type: "wet" as const,
        changedAt: "2024-03-15T10:00:00Z",
        createdAt: "2024-03-15T10:00:00Z",
        updatedAt: "2024-03-15T10:00:00Z",
      },
    ],
    pumping: [],
    growth: [],
    tummyTime: [],
  };

  it("should include all selected data types", () => {
    const csv = generateCombinedExport(mockData, ["feedings", "sleep", "diapers"], true);
    expect(csv).toContain("FEEDINGS");
    expect(csv).toContain("SLEEP");
    expect(csv).toContain("DIAPERS");
  });

  it("should separate data types with headers", () => {
    const csv = generateCombinedExport(mockData, ["feedings", "sleep"], true);
    expect(csv).toContain("=== FEEDINGS ===");
    expect(csv).toContain("=== SLEEP ===");
  });

  it("should only include selected data types", () => {
    const csv = generateCombinedExport(mockData, ["feedings"], true);
    expect(csv).toContain("FEEDINGS");
    expect(csv).not.toContain("SLEEP");
    expect(csv).not.toContain("DIAPERS");
  });

  it("should handle empty selected types", () => {
    const csv = generateCombinedExport(mockData, [], true);
    expect(csv).toBe("");
  });

  it("should skip data types with no data", () => {
    const csv = generateCombinedExport(mockData, ["feedings", "pumping"], true);
    expect(csv).toContain("FEEDINGS");
    expect(csv).not.toContain("PUMPING");
  });

  it("should respect includeNotes option", () => {
    const dataWithNotes = {
      ...mockData,
      feedings: [
        {
          ...mockData.feedings[0],
          notes: "Test note",
        },
      ],
    };
    const csvWithNotes = generateCombinedExport(dataWithNotes, ["feedings"], true);
    const csvWithoutNotes = generateCombinedExport(dataWithNotes, ["feedings"], false);

    expect(csvWithNotes).toContain("Notes");
    expect(csvWithoutNotes).not.toContain("Notes");
  });
});

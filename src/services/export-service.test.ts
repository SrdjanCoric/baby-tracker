import { describe, it, expect, beforeEach, vi } from "vitest";
import { ExportService } from "./export-service";
import { FeedingStorageService } from "./feeding-storage";
import { SleepStorageService } from "./sleep-storage";
import { DiaperStorageService } from "./diaper-storage";
import { PumpingStorageService } from "./pumping-storage";
import { GrowthStorageService } from "./growth-storage";
import { TummyTimeStorageService } from "./tummyTime-storage";
import { File } from "expo-file-system";
import * as Sharing from "expo-sharing";

vi.mock("./feeding-storage", () => ({
  FeedingStorageService: {
    getAllFeedings: vi.fn(),
  },
}));

vi.mock("./sleep-storage", () => ({
  SleepStorageService: {
    getAllSleeps: vi.fn(),
  },
}));

vi.mock("./diaper-storage", () => ({
  DiaperStorageService: {
    getAllDiapers: vi.fn(),
  },
}));

vi.mock("./pumping-storage", () => ({
  PumpingStorageService: {
    getAllPumpings: vi.fn(),
  },
}));

vi.mock("./growth-storage", () => ({
  GrowthStorageService: {
    getAllMeasurements: vi.fn(),
  },
}));

vi.mock("./tummyTime-storage", () => ({
  TummyTimeStorageService: {
    getAllTummyTimes: vi.fn(),
  },
}));

vi.mock("expo-file-system", () => {
  const mockWrite = vi.fn().mockResolvedValue(undefined);
  const mockDelete = vi.fn().mockResolvedValue(undefined);

  class MockFile {
    uri = "file://documents/test.csv";
    write = mockWrite;
    delete = mockDelete;
    static mockWrite = mockWrite;
    static mockDelete = mockDelete;
  }

  return {
    File: MockFile,
    Paths: {
      document: { uri: "file://documents/" },
    },
  };
});

vi.mock("expo-sharing", () => ({
  isAvailableAsync: vi.fn(),
  shareAsync: vi.fn(),
}));

describe("ExportService", () => {
  const mockBabyId = "baby-123";
  const mockBabyName = "Emma";

  const mockFeedings = [
    {
      id: "1",
      babyId: mockBabyId,
      type: "breast",
      startedAt: "2024-03-15T10:00:00Z",
      createdAt: "2024-03-15T10:00:00Z",
      updatedAt: "2024-03-15T10:00:00Z",
    },
    {
      id: "2",
      babyId: mockBabyId,
      type: "bottle",
      startedAt: "2024-03-20T14:00:00Z",
      createdAt: "2024-03-20T14:00:00Z",
      updatedAt: "2024-03-20T14:00:00Z",
    },
  ];

  const mockSleeps = [
    {
      id: "1",
      babyId: mockBabyId,
      type: "nap",
      startedAt: "2024-03-15T13:00:00Z",
      createdAt: "2024-03-15T13:00:00Z",
      updatedAt: "2024-03-15T13:00:00Z",
    },
  ];

  const mockDiapers = [
    {
      id: "1",
      babyId: mockBabyId,
      type: "wet",
      changedAt: "2024-03-15T10:00:00Z",
      createdAt: "2024-03-15T10:00:00Z",
      updatedAt: "2024-03-15T10:00:00Z",
    },
    {
      id: "2",
      babyId: mockBabyId,
      type: "dirty",
      changedAt: "2024-03-15T14:00:00Z",
      createdAt: "2024-03-15T14:00:00Z",
      updatedAt: "2024-03-15T14:00:00Z",
    },
    {
      id: "3",
      babyId: mockBabyId,
      type: "mixed",
      changedAt: "2024-03-18T10:00:00Z",
      createdAt: "2024-03-18T10:00:00Z",
      updatedAt: "2024-03-18T10:00:00Z",
    },
  ];

  const mockPumpings = [
    {
      id: "1",
      babyId: mockBabyId,
      side: "both",
      startedAt: "2024-03-15T10:00:00Z",
      createdAt: "2024-03-15T10:00:00Z",
      updatedAt: "2024-03-15T10:00:00Z",
    },
  ];

  const mockGrowth = [
    {
      id: "1",
      babyId: mockBabyId,
      measuredAt: "2024-03-15T10:00:00Z",
      weightKg: 5.5,
      createdAt: "2024-03-15T10:00:00Z",
      updatedAt: "2024-03-15T10:00:00Z",
    },
    {
      id: "2",
      babyId: mockBabyId,
      measuredAt: "2024-03-20T10:00:00Z",
      weightKg: 5.8,
      createdAt: "2024-03-20T10:00:00Z",
      updatedAt: "2024-03-20T10:00:00Z",
    },
  ];

  const mockTummyTimes = [
    {
      id: "1",
      babyId: mockBabyId,
      startedAt: "2024-03-15T10:00:00Z",
      createdAt: "2024-03-15T10:00:00Z",
      updatedAt: "2024-03-15T10:00:00Z",
    },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(FeedingStorageService.getAllFeedings).mockResolvedValue(mockFeedings);
    vi.mocked(SleepStorageService.getAllSleeps).mockResolvedValue(mockSleeps);
    vi.mocked(DiaperStorageService.getAllDiapers).mockResolvedValue(mockDiapers);
    vi.mocked(PumpingStorageService.getAllPumpings).mockResolvedValue(mockPumpings);
    vi.mocked(GrowthStorageService.getAllMeasurements).mockResolvedValue(mockGrowth);
    vi.mocked(TummyTimeStorageService.getAllTummyTimes).mockResolvedValue(mockTummyTimes);
    // File mock is set up in vi.mock factory
    vi.mocked(Sharing.isAvailableAsync).mockResolvedValue(true);
    vi.mocked(Sharing.shareAsync).mockResolvedValue();
  });

  describe("getRecordCounts", () => {
    it("should return counts for all data types", async () => {
      const counts = await ExportService.getRecordCounts(mockBabyId);

      expect(counts).toEqual({
        feedings: 2,
        sleep: 1,
        diapers: 3,
        pumping: 1,
        growth: 2,
        tummyTime: 1,
      });
    });

    it("should return zero counts when no data exists", async () => {
      vi.mocked(FeedingStorageService.getAllFeedings).mockResolvedValue([]);
      vi.mocked(SleepStorageService.getAllSleeps).mockResolvedValue([]);
      vi.mocked(DiaperStorageService.getAllDiapers).mockResolvedValue([]);
      vi.mocked(PumpingStorageService.getAllPumpings).mockResolvedValue([]);
      vi.mocked(GrowthStorageService.getAllMeasurements).mockResolvedValue([]);
      vi.mocked(TummyTimeStorageService.getAllTummyTimes).mockResolvedValue([]);

      const counts = await ExportService.getRecordCounts(mockBabyId);

      expect(counts).toEqual({
        feedings: 0,
        sleep: 0,
        diapers: 0,
        pumping: 0,
        growth: 0,
        tummyTime: 0,
      });
    });

    it("should query data for the correct baby", async () => {
      await ExportService.getRecordCounts(mockBabyId);

      expect(FeedingStorageService.getAllFeedings).toHaveBeenCalledWith(mockBabyId);
      expect(SleepStorageService.getAllSleeps).toHaveBeenCalledWith(mockBabyId);
      expect(DiaperStorageService.getAllDiapers).toHaveBeenCalledWith(mockBabyId);
      expect(PumpingStorageService.getAllPumpings).toHaveBeenCalledWith(mockBabyId);
      expect(GrowthStorageService.getAllMeasurements).toHaveBeenCalledWith(mockBabyId);
      expect(TummyTimeStorageService.getAllTummyTimes).toHaveBeenCalledWith(mockBabyId);
    });
  });

  describe("getRecordCountsInRange", () => {
    it("should filter counts by date range", async () => {
      const startDate = new Date("2024-03-14T00:00:00Z");
      const endDate = new Date("2024-03-16T23:59:59Z");

      const counts = await ExportService.getRecordCountsInRange(
        mockBabyId,
        startDate,
        endDate
      );

      expect(counts.feedings).toBe(1);
      expect(counts.diapers).toBe(2);
      expect(counts.growth).toBe(1);
    });

    it("should return zero when no data in range", async () => {
      const startDate = new Date("2024-01-01T00:00:00Z");
      const endDate = new Date("2024-01-31T23:59:59Z");

      const counts = await ExportService.getRecordCountsInRange(
        mockBabyId,
        startDate,
        endDate
      );

      expect(counts.feedings).toBe(0);
      expect(counts.sleep).toBe(0);
      expect(counts.diapers).toBe(0);
    });
  });

  describe("exportToCSV", () => {
    const defaultOptions = {
      dataTypes: ["feedings", "sleep", "diapers"] as const,
      startDate: new Date("2024-03-01T00:00:00Z"),
      endDate: new Date("2024-03-31T23:59:59Z"),
      babyId: mockBabyId,
      babyName: mockBabyName,
      includeNotes: true,
    };

    it("should generate valid CSV content", async () => {
      const result = await ExportService.exportToCSV(defaultOptions);

      expect(result.success).toBe(true);
      expect(result.recordCount).toBeGreaterThan(0);
    });

    it("should filter by date range", async () => {
      const options = {
        ...defaultOptions,
        startDate: new Date("2024-03-14T00:00:00Z"),
        endDate: new Date("2024-03-16T23:59:59Z"),
      };

      const result = await ExportService.exportToCSV(options);

      expect(result.success).toBe(true);
      expect(result.recordCount).toBe(4);
    });

    it("should filter by selected data types", async () => {
      const options = {
        ...defaultOptions,
        dataTypes: ["feedings"] as const,
      };

      const result = await ExportService.exportToCSV(options);

      expect(result.success).toBe(true);
      expect(result.recordCount).toBe(2);
    });

    it("should include all selected data types in output", async () => {
      const result = await ExportService.exportToCSV(defaultOptions);

      expect(result.content).toContain("FEEDINGS");
      expect(result.content).toContain("SLEEP");
      expect(result.content).toContain("DIAPERS");
    });

    it("should generate appropriate filename", async () => {
      const result = await ExportService.exportToCSV(defaultOptions);

      expect(result.fileName).toContain("Emma");
      expect(result.fileName).toContain(".csv");
    });

    it("should handle empty data", async () => {
      vi.mocked(FeedingStorageService.getAllFeedings).mockResolvedValue([]);
      vi.mocked(SleepStorageService.getAllSleeps).mockResolvedValue([]);
      vi.mocked(DiaperStorageService.getAllDiapers).mockResolvedValue([]);

      const result = await ExportService.exportToCSV(defaultOptions);

      expect(result.success).toBe(true);
      expect(result.recordCount).toBe(0);
    });

    it("should return error on failure", async () => {
      vi.mocked(FeedingStorageService.getAllFeedings).mockRejectedValue(
        new Error("Storage error")
      );

      const result = await ExportService.exportToCSV(defaultOptions);

      expect(result.success).toBe(false);
      expect(result.error).toBeDefined();
    });

    it("should respect includeNotes option", async () => {
      const optionsWithNotes = { ...defaultOptions, includeNotes: true };
      const optionsWithoutNotes = { ...defaultOptions, includeNotes: false };

      const resultWithNotes = await ExportService.exportToCSV(optionsWithNotes);
      const resultWithoutNotes = await ExportService.exportToCSV(optionsWithoutNotes);

      expect(resultWithNotes.content).toContain("Notes");
      expect(resultWithoutNotes.content).not.toContain("Notes");
    });
  });

  describe("shareCSV", () => {
    it("should write file to document directory", async () => {
      const content = "test,csv,content";
      const filename = "test.csv";

      await ExportService.shareCSV(content, filename);

      expect((File as unknown as { mockWrite: ReturnType<typeof vi.fn> }).mockWrite).toHaveBeenCalledWith(
        expect.stringContaining(content)
      );
    });

    it("should use correct MIME type", async () => {
      const content = "test,csv,content";
      const filename = "test.csv";

      await ExportService.shareCSV(content, filename);

      expect(Sharing.shareAsync).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({
          mimeType: "text/csv",
        })
      );
    });

    it("should handle sharing not available", async () => {
      vi.mocked(Sharing.isAvailableAsync).mockResolvedValue(false);

      await expect(
        ExportService.shareCSV("content", "test.csv")
      ).rejects.toThrow("Sharing is not available");
    });

    it("should clean up temp file after sharing", async () => {
      const content = "test,csv,content";
      const filename = "test.csv";

      await ExportService.shareCSV(content, filename);

      expect((File as unknown as { mockDelete: ReturnType<typeof vi.fn> }).mockDelete).toHaveBeenCalled();
    });

    it("should handle share cancellation gracefully", async () => {
      vi.mocked(Sharing.shareAsync).mockResolvedValue();

      const content = "test,csv,content";
      const filename = "test.csv";

      await expect(
        ExportService.shareCSV(content, filename)
      ).resolves.not.toThrow();
    });
  });

  describe("generateFileName", () => {
    it("should include baby name", () => {
      const fileName = ExportService.generateFileName("Emma", new Date("2024-03-15"));

      expect(fileName).toContain("Emma");
    });

    it("should include date", () => {
      const fileName = ExportService.generateFileName("Emma", new Date("2024-03-15"));

      expect(fileName).toContain("2024");
      expect(fileName).toContain("03");
      expect(fileName).toContain("15");
    });

    it("should have .csv extension", () => {
      const fileName = ExportService.generateFileName("Emma", new Date());

      expect(fileName).toMatch(/\.csv$/);
    });

    it("should sanitize baby name for filename", () => {
      const fileName = ExportService.generateFileName("Emma/Rose", new Date());

      expect(fileName).not.toContain("/");
    });

    it("should handle spaces in baby name", () => {
      const fileName = ExportService.generateFileName("Baby Emma", new Date());

      expect(fileName).toMatch(/Baby[_-]Emma/);
    });
  });
});

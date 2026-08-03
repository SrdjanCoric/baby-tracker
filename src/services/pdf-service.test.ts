import { describe, it, expect, beforeEach, vi } from "vitest";
import { PDFService } from "./pdf-service";
import { FeedingStorageService } from "./feeding-storage";
import { SleepStorageService } from "./sleep-storage";
import { DiaperStorageService } from "./diaper-storage";
import { PumpingStorageService } from "./pumping-storage";
import { GrowthStorageService } from "./growth-storage";
import { TummyTimeStorageService } from "./tummyTime-storage";
import * as Print from "expo-print";
import type { ReportOptions } from "@/types/report";

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

vi.mock("expo-print", () => ({
  printToFileAsync: vi.fn(),
}));

vi.mock("expo-sharing", () => ({
  isAvailableAsync: vi.fn(),
  shareAsync: vi.fn(),
}));

function deferred() {
  let resolve!: () => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("PDFService", () => {
  const mockBabyId = "baby-123";
  const startDate = new Date("2024-03-01T00:00:00Z");
  const endDate = new Date("2024-03-31T23:59:59Z");

  const baseOptions: ReportOptions = {
    sections: ["summary"],
    startDate,
    endDate,
    babyId: mockBabyId,
    babyName: "Emma",
    includeCharts: false,
    ensureRangesLoaded: async () => {},
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(FeedingStorageService.getAllFeedings).mockResolvedValue([]);
    vi.mocked(SleepStorageService.getAllSleeps).mockResolvedValue([]);
    vi.mocked(DiaperStorageService.getAllDiapers).mockResolvedValue([]);
    vi.mocked(PumpingStorageService.getAllPumpings).mockResolvedValue([]);
    vi.mocked(GrowthStorageService.getAllMeasurements).mockResolvedValue([]);
    vi.mocked(TummyTimeStorageService.getAllTummyTimes).mockResolvedValue([]);
    vi.mocked(Print.printToFileAsync).mockResolvedValue({
      uri: "file://documents/report.pdf",
    } as Awaited<ReturnType<typeof Print.printToFileAsync>>);
  });

  describe("fetchReportData", () => {
    it("awaits range resolution before reading storage", async () => {
      const gate = deferred();
      const ensureRangesLoaded = vi.fn(() => gate.promise);

      const promise = PDFService.fetchReportData(
        mockBabyId,
        startDate,
        endDate,
        ensureRangesLoaded
      );
      await Promise.resolve();

      expect(ensureRangesLoaded).toHaveBeenCalledTimes(1);
      expect(FeedingStorageService.getAllFeedings).not.toHaveBeenCalled();

      gate.resolve();
      await promise;

      expect(FeedingStorageService.getAllFeedings).toHaveBeenCalledWith(mockBabyId);
      expect(SleepStorageService.getAllSleeps).toHaveBeenCalledWith(mockBabyId);
      expect(DiaperStorageService.getAllDiapers).toHaveBeenCalledWith(mockBabyId);
      expect(PumpingStorageService.getAllPumpings).toHaveBeenCalledWith(mockBabyId);
      expect(GrowthStorageService.getAllMeasurements).toHaveBeenCalledWith(mockBabyId);
      expect(TummyTimeStorageService.getAllTummyTimes).toHaveBeenCalledWith(mockBabyId);
    });

    it("rejects when range resolution fails without reading storage", async () => {
      const ensureRangesLoaded = vi
        .fn()
        .mockRejectedValue(new Error("Failed to fetch activity range"));

      await expect(
        PDFService.fetchReportData(mockBabyId, startDate, endDate, ensureRangesLoaded)
      ).rejects.toThrow("Failed to fetch activity range");
      expect(FeedingStorageService.getAllFeedings).not.toHaveBeenCalled();
    });
  });

  describe("generateReport", () => {
    it("resolves the selected range before generating the report", async () => {
      const ensureRangesLoaded = vi.fn().mockResolvedValue(undefined);

      const result = await PDFService.generateReport({
        ...baseOptions,
        ensureRangesLoaded,
      });

      expect(result.success).toBe(true);
      expect(ensureRangesLoaded).toHaveBeenCalledTimes(1);
      expect(FeedingStorageService.getAllFeedings).toHaveBeenCalled();
    });

    it("classifies any resolver failure as a range-load failure", async () => {
      const ensureRangesLoaded = vi
        .fn()
        .mockRejectedValue(
          new Error("Activity pull storage scope changed during reconciliation")
        );

      const result = await PDFService.generateReport({
        ...baseOptions,
        ensureRangesLoaded,
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain(
        "Activity pull storage scope changed during reconciliation"
      );
      expect(result.errorKind).toBe("rangeLoad");
      expect(result.filePath).toBeUndefined();
      expect(FeedingStorageService.getAllFeedings).not.toHaveBeenCalled();
      expect(Print.printToFileAsync).not.toHaveBeenCalled();
    });
  });
});

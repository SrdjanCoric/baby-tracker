/**
 * PDF Service
 * Handles PDF report generation and sharing
 */

import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { FeedingStorageService } from "./feeding-storage";
import { SleepStorageService } from "./sleep-storage";
import { DiaperStorageService } from "./diaper-storage";
import { PumpingStorageService } from "./pumping-storage";
import { GrowthStorageService } from "./growth-storage";
import { TummyTimeStorageService } from "./tummyTime-storage";
import type {
  ReportOptions,
  ReportResult,
  AggregatedReportData,
} from "@/types/report";
import {
  aggregateMetadata,
  aggregateSummary,
  aggregateFeeding,
  aggregateSleep,
  aggregateDiapers,
  aggregatePumping,
  aggregateGrowth,
  aggregateTummyTime,
  type RawReportData,
} from "@/utils/report-aggregator";
import {
  wrapInHtmlDocument,
  renderHeaderSection,
  renderSummarySection,
  renderFeedingSection,
  renderSleepSection,
  renderDiaperSection,
  renderPumpingSection,
  renderGrowthSection,
  renderTummyTimeSection,
} from "@/utils/pdf-templates";
import { PDF_MIME_TYPE } from "@/constants/report";
import {
  ActivityRangeLoadError,
  ensureActivityRangesLoaded,
} from "./activity-range-error";

function sanitizeFileName(name: string): string {
  return name.replace(/[/\\?%*:|"<>]/g, "-").replace(/\s+/g, "_");
}

function _isInDateRange(date: Date, startDate: Date, endDate: Date): boolean {
  return date >= startDate && date <= endDate;
}

export const PDFService = {
  async fetchReportData(
    babyId: string,
    _startDate: Date,
    _endDate: Date,
    ensureRangesLoaded: () => Promise<void>
  ): Promise<RawReportData> {
    await ensureActivityRangesLoaded(ensureRangesLoaded);

    const [feedings, sleeps, diapers, pumpings, growth, tummyTimes] =
      await Promise.all([
        FeedingStorageService.getAllFeedings(babyId),
        SleepStorageService.getAllSleeps(babyId),
        DiaperStorageService.getAllDiapers(babyId),
        PumpingStorageService.getAllPumpings(babyId),
        GrowthStorageService.getAllMeasurements(babyId),
        TummyTimeStorageService.getAllTummyTimes(babyId),
      ]);

    return {
      feedings,
      sleeps,
      diapers,
      pumpings,
      growth,
      tummyTimes,
    };
  },

  aggregateReportData(
    data: RawReportData,
    options: ReportOptions
  ): AggregatedReportData {
    const metadata = aggregateMetadata(options);
    const result: AggregatedReportData = { metadata };

    if (options.sections.includes("summary")) {
      result.summary = aggregateSummary(
        data,
        options.startDate,
        options.endDate
      );
    }

    if (options.sections.includes("feeding")) {
      result.feeding = aggregateFeeding(
        data.feedings,
        options.startDate,
        options.endDate
      );
    }

    if (options.sections.includes("sleep")) {
      result.sleep = aggregateSleep(
        data.sleeps,
        options.startDate,
        options.endDate
      );
    }

    if (options.sections.includes("diapers")) {
      result.diapers = aggregateDiapers(
        data.diapers,
        options.startDate,
        options.endDate
      );
    }

    if (options.sections.includes("pumping")) {
      result.pumping = aggregatePumping(
        data.pumpings,
        options.startDate,
        options.endDate
      );
    }

    if (options.sections.includes("growth")) {
      result.growth = aggregateGrowth(
        data.growth,
        options.startDate,
        options.endDate,
        options.babyBirthDate,
        options.babyGender
      );
    }

    if (options.sections.includes("tummyTime")) {
      result.tummyTime = aggregateTummyTime(
        data.tummyTimes,
        options.startDate,
        options.endDate
      );
    }

    return result;
  },

  generateHtml(
    aggregatedData: AggregatedReportData,
    options: ReportOptions
  ): string {
    const sections: string[] = [];

    sections.push(renderHeaderSection(aggregatedData.metadata));

    if (aggregatedData.summary && options.sections.includes("summary")) {
      sections.push(
        renderSummarySection(aggregatedData.summary, aggregatedData.metadata)
      );
    }

    if (aggregatedData.feeding && options.sections.includes("feeding")) {
      sections.push(renderFeedingSection(aggregatedData.feeding));
    }

    if (aggregatedData.sleep && options.sections.includes("sleep")) {
      sections.push(renderSleepSection(aggregatedData.sleep));
    }

    if (aggregatedData.diapers && options.sections.includes("diapers")) {
      sections.push(renderDiaperSection(aggregatedData.diapers));
    }

    if (aggregatedData.pumping && options.sections.includes("pumping")) {
      sections.push(renderPumpingSection(aggregatedData.pumping));
    }

    if (aggregatedData.growth && options.sections.includes("growth")) {
      sections.push(
        renderGrowthSection(
          aggregatedData.growth,
          options.babyGender,
          options.includeCharts,
          { weightUnit: options.weightUnit, heightUnit: options.heightUnit }
        )
      );
    }

    if (aggregatedData.tummyTime && options.sections.includes("tummyTime")) {
      sections.push(renderTummyTimeSection(aggregatedData.tummyTime));
    }

    sections.push(`
      <div class="footer">
        <p>Sofi Baby Tracker</p>
      </div>
    `);

    const content = sections.join("\n");
    const title = `${options.babyName} - Report`;

    return wrapInHtmlDocument(content, title);
  },

  generateFileName(babyName: string, date: Date): string {
    const sanitizedName = sanitizeFileName(babyName);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");

    return `${sanitizedName}_report_${year}-${month}-${day}.pdf`;
  },

  async generateReport(options: ReportOptions): Promise<ReportResult> {
    try {
      const rawData = await this.fetchReportData(
        options.babyId,
        options.startDate,
        options.endDate,
        options.ensureRangesLoaded
      );

      const aggregatedData = this.aggregateReportData(rawData, options);

      const html = this.generateHtml(aggregatedData, options);

      const { uri } = await Print.printToFileAsync({
        html,
        base64: false,
      });

      const fileName = this.generateFileName(options.babyName, new Date());

      return {
        success: true,
        filePath: uri,
        fileName,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : "Report generation failed";
      return {
        success: false,
        error: message,
        errorKind: error instanceof ActivityRangeLoadError ? "rangeLoad" : undefined,
      };
    }
  },

  async shareReport(filePath: string, _fileName: string): Promise<void> {
    const isAvailable = await Sharing.isAvailableAsync();
    if (!isAvailable) {
      throw new Error("Sharing is not available on this device");
    }

    await Sharing.shareAsync(filePath, {
      mimeType: PDF_MIME_TYPE,
      dialogTitle: "Share Baby Health Report",
      UTI: "com.adobe.pdf",
    });
  },
};

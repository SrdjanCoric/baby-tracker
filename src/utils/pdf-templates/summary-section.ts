/**
 * Summary section template for PDF reports
 */

import type { SummaryStats, ReportMetadata } from "@/types/report";
import { formatDuration } from "./base-template";
import i18n from "@/i18n";

export function renderSummarySection(
  stats: SummaryStats,
  metadata: ReportMetadata
): string {
  const t = i18n.t.bind(i18n);
  const daysText = t("reports.pdf.day", { count: metadata.totalDays });

  return `
    <div class="section">
      <h2 class="section-title">
        <span class="section-icon">📊</span>
        ${t("reports.pdf.summaryTitle", { count: metadata.totalDays, unit: daysText })}
      </h2>

      <div class="stats-grid">
        <div class="stat-box">
          <div class="stat-value">${stats.totalFeedings}</div>
          <div class="stat-label">${t("reports.pdf.feedings")}</div>
          <div class="stat-secondary">${(stats.totalFeedings / metadata.totalDays).toFixed(1)}${t("reports.pdf.perDayAvg")}</div>
        </div>

        <div class="stat-box">
          <div class="stat-value">${formatDuration(stats.totalSleepMinutes)}</div>
          <div class="stat-label">${t("reports.pdf.totalSleep")}</div>
          <div class="stat-secondary">${formatDuration(stats.totalSleepMinutes / metadata.totalDays)}${t("reports.pdf.perDayAvg")}</div>
        </div>

        <div class="stat-box">
          <div class="stat-value">${stats.totalDiapers}</div>
          <div class="stat-label">${t("reports.pdf.diapers")}</div>
          <div class="stat-secondary">${(stats.totalDiapers / metadata.totalDays).toFixed(1)}${t("reports.pdf.perDayAvg")}</div>
        </div>

        ${stats.totalPumpingMl > 0 ? `
        <div class="stat-box">
          <div class="stat-value">${stats.totalPumpingMl} ml</div>
          <div class="stat-label">${t("reports.pdf.pumped")}</div>
          <div class="stat-secondary">${Math.round(stats.totalPumpingMl / metadata.totalDays)} ml${t("reports.pdf.perDayAvg")}</div>
        </div>
        ` : ""}

        ${stats.totalTummyTimeMinutes > 0 ? `
        <div class="stat-box">
          <div class="stat-value">${formatDuration(stats.totalTummyTimeMinutes)}</div>
          <div class="stat-label">${t("reports.pdf.tummyTime")}</div>
          <div class="stat-secondary">${formatDuration(stats.totalTummyTimeMinutes / metadata.totalDays)}${t("reports.pdf.perDayAvg")}</div>
        </div>
        ` : ""}

        ${stats.growthMeasurements > 0 ? `
        <div class="stat-box">
          <div class="stat-value">${stats.growthMeasurements}</div>
          <div class="stat-label">${t("reports.pdf.growthMeasurements")}</div>
        </div>
        ` : ""}
      </div>
    </div>
  `;
}

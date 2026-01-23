/**
 * Summary section template for PDF reports
 */

import type { SummaryStats, ReportMetadata } from "@/types/report";
import { formatDuration } from "./base-template";

export function renderSummarySection(
  stats: SummaryStats,
  metadata: ReportMetadata
): string {
  const daysText = metadata.totalDays === 1 ? "day" : "days";

  return `
    <div class="section">
      <h2 class="section-title">
        <span class="section-icon">📊</span>
        Summary (${metadata.totalDays} ${daysText})
      </h2>

      <div class="stats-grid">
        <div class="stat-box">
          <div class="stat-value">${stats.totalFeedings}</div>
          <div class="stat-label">Feedings</div>
          <div class="stat-secondary">${(stats.totalFeedings / metadata.totalDays).toFixed(1)}/day avg</div>
        </div>

        <div class="stat-box">
          <div class="stat-value">${formatDuration(stats.totalSleepMinutes)}</div>
          <div class="stat-label">Total Sleep</div>
          <div class="stat-secondary">${formatDuration(stats.totalSleepMinutes / metadata.totalDays)}/day avg</div>
        </div>

        <div class="stat-box">
          <div class="stat-value">${stats.totalDiapers}</div>
          <div class="stat-label">Diapers</div>
          <div class="stat-secondary">${(stats.totalDiapers / metadata.totalDays).toFixed(1)}/day avg</div>
        </div>

        ${stats.totalPumpingMl > 0 ? `
        <div class="stat-box">
          <div class="stat-value">${stats.totalPumpingMl} ml</div>
          <div class="stat-label">Pumped</div>
          <div class="stat-secondary">${Math.round(stats.totalPumpingMl / metadata.totalDays)} ml/day avg</div>
        </div>
        ` : ""}

        ${stats.totalTummyTimeMinutes > 0 ? `
        <div class="stat-box">
          <div class="stat-value">${formatDuration(stats.totalTummyTimeMinutes)}</div>
          <div class="stat-label">Tummy Time</div>
          <div class="stat-secondary">${formatDuration(stats.totalTummyTimeMinutes / metadata.totalDays)}/day avg</div>
        </div>
        ` : ""}

        ${stats.growthMeasurements > 0 ? `
        <div class="stat-box">
          <div class="stat-value">${stats.growthMeasurements}</div>
          <div class="stat-label">Growth Measurements</div>
        </div>
        ` : ""}
      </div>
    </div>
  `;
}

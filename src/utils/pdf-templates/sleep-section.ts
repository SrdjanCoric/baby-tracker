/**
 * Sleep section template for PDF reports
 */

import type { SleepReportStats } from "@/types/report";
import { formatDuration } from "./base-template";
import i18n from "@/i18n";

export function renderSleepSection(stats: SleepReportStats): string {
  const t = i18n.t.bind(i18n);
  return `
    <div class="section">
      <h2 class="section-title">
        <span class="section-icon">😴</span>
        ${t("reports.pdf.sleepTitle")}
      </h2>

      <div class="card">
        <div class="stats-grid">
          <div class="stat-box">
            <div class="stat-value">${formatDuration(stats.totalMinutes)}</div>
            <div class="stat-label">${t("reports.pdf.totalSleep")}</div>
            <div class="stat-secondary">${formatDuration(stats.avgPerDay)}${t("reports.pdf.perDayAvg")}</div>
          </div>

          <div class="stat-box">
            <div class="stat-value">${stats.totalSessions}</div>
            <div class="stat-label">${t("reports.pdf.sleepSessions")}</div>
          </div>

          <div class="stat-box">
            <div class="stat-value">${formatDuration(stats.avgDurationMinutes)}</div>
            <div class="stat-label">${t("reports.pdf.avgDuration")}</div>
          </div>
        </div>
      </div>

      <div class="card">
        <h3 style="font-size: 13px; font-weight: 600; margin-bottom: 10px;">${t("reports.pdf.sleepByType")}</h3>
        <table class="table">
          <thead>
            <tr>
              <th>${t("reports.pdf.type")}</th>
              <th class="text-center">${t("reports.pdf.sessions")}</th>
              <th class="text-center">${t("reports.pdf.total")}</th>
              <th class="text-center">${t("reports.pdf.average")}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>${t("reports.pdf.naps")}</td>
              <td class="text-center">${stats.byType.nap.count}</td>
              <td class="text-center">${formatDuration(stats.byType.nap.totalMinutes)}</td>
              <td class="text-center">${formatDuration(stats.byType.nap.avgMinutes)}</td>
            </tr>
            <tr>
              <td>${t("reports.pdf.nightSleep")}</td>
              <td class="text-center">${stats.byType.night.count}</td>
              <td class="text-center">${formatDuration(stats.byType.night.totalMinutes)}</td>
              <td class="text-center">${formatDuration(stats.byType.night.avgMinutes)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      ${stats.longestSleepMinutes > 0 || stats.shortestSleepMinutes > 0 ? `
      <div class="card">
        <h3 style="font-size: 13px; font-weight: 600; margin-bottom: 10px;">${t("reports.pdf.sleepRange")}</h3>
        <div class="two-column">
          <div class="info-row">
            <span class="info-label">${t("reports.pdf.longestSleep")}</span>
            <span class="info-value">${formatDuration(stats.longestSleepMinutes)}</span>
          </div>
          <div class="info-row">
            <span class="info-label">${t("reports.pdf.shortestSleep")}</span>
            <span class="info-value">${formatDuration(stats.shortestSleepMinutes)}</span>
          </div>
        </div>
      </div>
      ` : ""}
    </div>
  `;
}

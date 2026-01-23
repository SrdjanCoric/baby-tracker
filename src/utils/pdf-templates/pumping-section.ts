/**
 * Pumping section template for PDF reports
 */

import type { PumpingReportStats } from "@/types/report";
import { formatDuration } from "./base-template";
import i18n from "@/i18n";

export function renderPumpingSection(stats: PumpingReportStats): string {
  const t = i18n.t.bind(i18n);
  const totalBySide = stats.bySide.left.totalMl + stats.bySide.right.totalMl + stats.bySide.both.totalMl;

  return `
    <div class="section">
      <h2 class="section-title">
        <span class="section-icon">🫙</span>
        ${t("reports.pdf.pumpingTitle")}
      </h2>

      <div class="card">
        <div class="stats-grid">
          <div class="stat-box">
            <div class="stat-value">${stats.totalMl} ml</div>
            <div class="stat-label">${t("reports.pdf.totalPumped")}</div>
          </div>

          <div class="stat-box">
            <div class="stat-value">${stats.totalSessions}</div>
            <div class="stat-label">${t("reports.pdf.pumpingSessions")}</div>
            <div class="stat-secondary">${stats.avgSessionsPerDay}${t("reports.pdf.perDayAvg")}</div>
          </div>

          <div class="stat-box">
            <div class="stat-value">${stats.avgMlPerSession} ml</div>
            <div class="stat-label">${t("reports.pdf.avgPerSession")}</div>
          </div>
        </div>
      </div>

      <div class="card">
        <h3 style="font-size: 13px; font-weight: 600; margin-bottom: 10px;">${t("reports.pdf.totalSessions")}</h3>
        <div class="two-column">
          <div>
            <div class="info-row">
              <span class="info-label">${t("reports.pdf.totalDuration")}</span>
              <span class="info-value">${formatDuration(stats.totalMinutes)}</span>
            </div>
            <div class="info-row">
              <span class="info-label">${t("reports.pdf.avgDuration")}</span>
              <span class="info-value">${formatDuration(stats.avgMinutesPerSession)}</span>
            </div>
          </div>
          <div>
            <div class="info-row">
              <span class="info-label">${t("reports.pdf.avgPerDay")}</span>
              <span class="info-value">${stats.avgSessionsPerDay}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <h3 style="font-size: 13px; font-weight: 600; margin-bottom: 10px;">${t("reports.pdf.pumpingBySide")}</h3>
        <table class="table">
          <thead>
            <tr>
              <th>${t("reports.pdf.side")}</th>
              <th class="text-center">${t("reports.pdf.sessions")}</th>
              <th class="text-center">${t("reports.pdf.volume")}</th>
              <th class="text-center">%</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>${t("reports.pdf.left")}</td>
              <td class="text-center">${stats.bySide.left.sessions}</td>
              <td class="text-center">${stats.bySide.left.totalMl} ml</td>
              <td class="text-center">${totalBySide > 0 ? Math.round((stats.bySide.left.totalMl / totalBySide) * 100) : 0}%</td>
            </tr>
            <tr>
              <td>${t("reports.pdf.right")}</td>
              <td class="text-center">${stats.bySide.right.sessions}</td>
              <td class="text-center">${stats.bySide.right.totalMl} ml</td>
              <td class="text-center">${totalBySide > 0 ? Math.round((stats.bySide.right.totalMl / totalBySide) * 100) : 0}%</td>
            </tr>
            <tr>
              <td>${t("reports.pdf.both")}</td>
              <td class="text-center">${stats.bySide.both.sessions}</td>
              <td class="text-center">${stats.bySide.both.totalMl} ml</td>
              <td class="text-center">${totalBySide > 0 ? Math.round((stats.bySide.both.totalMl / totalBySide) * 100) : 0}%</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `;
}

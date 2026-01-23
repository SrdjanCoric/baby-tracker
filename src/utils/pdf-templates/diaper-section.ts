/**
 * Diaper section template for PDF reports
 */

import type { DiaperReportStats } from "@/types/report";
import i18n from "@/i18n";

export function renderDiaperSection(stats: DiaperReportStats): string {
  const t = i18n.t.bind(i18n);
  const hasStoolColors = Object.keys(stats.stoolColors).length > 0;

  return `
    <div class="section">
      <h2 class="section-title">
        <span class="section-icon">🚼</span>
        ${t("reports.pdf.diapersTitle")}
      </h2>

      <div class="card">
        <div class="stats-grid">
          <div class="stat-box">
            <div class="stat-value">${stats.total}</div>
            <div class="stat-label">${t("reports.pdf.totalDiapers")}</div>
            <div class="stat-secondary">${stats.avgPerDay}${t("reports.pdf.perDayAvg")}</div>
          </div>

          <div class="stat-box">
            <div class="stat-value">${stats.byType.wet}</div>
            <div class="stat-label">${t("reports.pdf.wetDiapers")}</div>
          </div>

          <div class="stat-box">
            <div class="stat-value">${stats.byType.dirty + stats.byType.mixed}</div>
            <div class="stat-label">${t("reports.pdf.dirtyDiapers")}/${t("reports.pdf.mixedDiapers")}</div>
          </div>
        </div>
      </div>

      <div class="card">
        <h3 style="font-size: 13px; font-weight: 600; margin-bottom: 10px;">${t("reports.pdf.diapersPerDay")}</h3>
        <table class="table">
          <thead>
            <tr>
              <th>${t("reports.pdf.type")}</th>
              <th class="text-center">${t("reports.pdf.count")}</th>
              <th class="text-center">%</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>${t("reports.pdf.wetDiapers")}</td>
              <td class="text-center">${stats.byType.wet}</td>
              <td class="text-center">${stats.total > 0 ? Math.round((stats.byType.wet / stats.total) * 100) : 0}%</td>
            </tr>
            <tr>
              <td>${t("reports.pdf.dirtyDiapers")}</td>
              <td class="text-center">${stats.byType.dirty}</td>
              <td class="text-center">${stats.total > 0 ? Math.round((stats.byType.dirty / stats.total) * 100) : 0}%</td>
            </tr>
            <tr>
              <td>${t("reports.pdf.mixedDiapers")}</td>
              <td class="text-center">${stats.byType.mixed}</td>
              <td class="text-center">${stats.total > 0 ? Math.round((stats.byType.mixed / stats.total) * 100) : 0}%</td>
            </tr>
          </tbody>
        </table>
      </div>

      ${hasStoolColors ? `
      <div class="card">
        <h3 style="font-size: 13px; font-weight: 600; margin-bottom: 10px;">${t("reports.pdf.stoolColorBreakdown")}</h3>
        <div style="display: flex; flex-wrap: wrap; gap: 8px;">
          ${Object.entries(stats.stoolColors).map(([color, count]) => {
            const colorKey = `stoolColors.${color}`;
            // @ts-expect-error - dynamic key lookup
            return `<span class="badge badge-secondary">${t(colorKey)}: ${count}</span>`;
          }).join("")}
        </div>
      </div>
      ` : ""}
    </div>
  `;
}

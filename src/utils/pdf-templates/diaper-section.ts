/**
 * Diaper section template for PDF reports
 */

import type { DiaperReportStats } from "@/types/report";

const STOOL_COLOR_LABELS: Record<string, string> = {
  yellow: "Yellow (mustard)",
  brown: "Brown",
  green: "Green",
  black: "Black (meconium)",
  white: "White/Pale",
  red: "Red-tinged",
  orange: "Orange",
};

export function renderDiaperSection(stats: DiaperReportStats): string {
  const hasStoolColors = Object.keys(stats.stoolColors).length > 0;

  return `
    <div class="section">
      <h2 class="section-title">
        <span class="section-icon">🚼</span>
        Diapers
      </h2>

      <div class="card">
        <div class="stats-grid">
          <div class="stat-box">
            <div class="stat-value">${stats.total}</div>
            <div class="stat-label">Total Changes</div>
            <div class="stat-secondary">${stats.avgPerDay}/day avg</div>
          </div>

          <div class="stat-box">
            <div class="stat-value">${stats.byType.wet}</div>
            <div class="stat-label">Wet Only</div>
          </div>

          <div class="stat-box">
            <div class="stat-value">${stats.byType.dirty + stats.byType.mixed}</div>
            <div class="stat-label">Dirty/Mixed</div>
          </div>
        </div>
      </div>

      <div class="card">
        <h3 style="font-size: 13px; font-weight: 600; margin-bottom: 10px;">Diaper Types</h3>
        <table class="table">
          <thead>
            <tr>
              <th>Type</th>
              <th class="text-center">Count</th>
              <th class="text-center">Percentage</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Wet</td>
              <td class="text-center">${stats.byType.wet}</td>
              <td class="text-center">${stats.total > 0 ? Math.round((stats.byType.wet / stats.total) * 100) : 0}%</td>
            </tr>
            <tr>
              <td>Dirty</td>
              <td class="text-center">${stats.byType.dirty}</td>
              <td class="text-center">${stats.total > 0 ? Math.round((stats.byType.dirty / stats.total) * 100) : 0}%</td>
            </tr>
            <tr>
              <td>Mixed</td>
              <td class="text-center">${stats.byType.mixed}</td>
              <td class="text-center">${stats.total > 0 ? Math.round((stats.byType.mixed / stats.total) * 100) : 0}%</td>
            </tr>
          </tbody>
        </table>
      </div>

      ${hasStoolColors ? `
      <div class="card">
        <h3 style="font-size: 13px; font-weight: 600; margin-bottom: 10px;">Stool Colors</h3>
        <div style="display: flex; flex-wrap: wrap; gap: 8px;">
          ${Object.entries(stats.stoolColors).map(([color, count]) => `
            <span class="badge badge-secondary">
              ${STOOL_COLOR_LABELS[color] || color}: ${count}
            </span>
          `).join("")}
        </div>
      </div>
      ` : ""}
    </div>
  `;
}

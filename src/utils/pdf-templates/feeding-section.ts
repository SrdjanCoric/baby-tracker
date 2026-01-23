/**
 * Feeding section template for PDF reports
 */

import type { FeedingReportStats } from "@/types/report";
import { formatDuration } from "./base-template";

export function renderFeedingSection(stats: FeedingReportStats): string {
  const hasBreast = stats.byType.breast > 0;
  const hasBottle = stats.byType.bottle > 0;
  const hasSolid = stats.byType.solid > 0;

  return `
    <div class="section">
      <h2 class="section-title">
        <span class="section-icon">🤱</span>
        Feeding
      </h2>

      <div class="card">
        <div class="stats-grid">
          <div class="stat-box">
            <div class="stat-value">${stats.total}</div>
            <div class="stat-label">Total Feedings</div>
            <div class="stat-secondary">${stats.avgPerDay}/day avg</div>
          </div>

          <div class="stat-box">
            <div class="stat-value">${stats.byType.breast}</div>
            <div class="stat-label">Breastfeeding</div>
          </div>

          <div class="stat-box">
            <div class="stat-value">${stats.byType.bottle}</div>
            <div class="stat-label">Bottles</div>
          </div>
        </div>
      </div>

      ${hasBreast ? `
      <div class="card">
        <h3 style="font-size: 13px; font-weight: 600; margin-bottom: 10px;">Breastfeeding Details</h3>
        <div class="two-column">
          <div>
            <div class="info-row">
              <span class="info-label">Total Sessions</span>
              <span class="info-value">${stats.breastfeeding.totalSessions}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Total Duration</span>
              <span class="info-value">${formatDuration(stats.breastfeeding.totalMinutes)}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Avg Duration</span>
              <span class="info-value">${formatDuration(stats.breastfeeding.avgDurationMinutes)}</span>
            </div>
          </div>
          <div>
            <div class="info-row">
              <span class="info-label">Left Side</span>
              <span class="info-value">${formatDuration(stats.breastfeeding.leftMinutes)}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Right Side</span>
              <span class="info-value">${formatDuration(stats.breastfeeding.rightMinutes)}</span>
            </div>
          </div>
        </div>
      </div>
      ` : ""}

      ${hasBottle ? `
      <div class="card">
        <h3 style="font-size: 13px; font-weight: 600; margin-bottom: 10px;">Bottle Feeding Details</h3>
        <div class="two-column">
          <div>
            <div class="info-row">
              <span class="info-label">Total Sessions</span>
              <span class="info-value">${stats.bottle.totalSessions}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Total Volume</span>
              <span class="info-value">${stats.bottle.totalMl} ml</span>
            </div>
            <div class="info-row">
              <span class="info-label">Avg per Bottle</span>
              <span class="info-value">${stats.bottle.avgMl} ml</span>
            </div>
          </div>
          <div>
            <div class="info-row">
              <span class="info-label">Formula</span>
              <span class="info-value">${stats.bottle.byContentType.formula} bottles</span>
            </div>
            <div class="info-row">
              <span class="info-label">Breast Milk</span>
              <span class="info-value">${stats.bottle.byContentType.breastMilk} bottles</span>
            </div>
          </div>
        </div>
      </div>
      ` : ""}

      ${hasSolid ? `
      <div class="card">
        <h3 style="font-size: 13px; font-weight: 600; margin-bottom: 10px;">Solid Foods</h3>
        <div class="info-row">
          <span class="info-label">Total Meals</span>
          <span class="info-value">${stats.solid.totalSessions}</span>
        </div>
        ${stats.solid.uniqueFoods.length > 0 ? `
        <div style="margin-top: 8px;">
          <span class="info-label">Foods introduced:</span>
          <div style="margin-top: 4px;">
            ${stats.solid.uniqueFoods.map(food => `<span class="badge badge-primary" style="margin: 2px;">${food}</span>`).join("")}
          </div>
        </div>
        ` : ""}
      </div>
      ` : ""}
    </div>
  `;
}

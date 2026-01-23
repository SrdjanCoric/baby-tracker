/**
 * Feeding section template for PDF reports
 */

import type { FeedingReportStats } from "@/types/report";
import { formatDuration } from "./base-template";
import i18n from "@/i18n";

export function renderFeedingSection(stats: FeedingReportStats): string {
  const t = i18n.t.bind(i18n);
  const hasBreast = stats.byType.breast > 0;
  const hasBottle = stats.byType.bottle > 0;
  const hasSolid = stats.byType.solid > 0;

  return `
    <div class="section">
      <h2 class="section-title">
        <span class="section-icon">🤱</span>
        ${t("reports.pdf.feedingTitle")}
      </h2>

      <div class="card">
        <div class="stats-grid">
          <div class="stat-box">
            <div class="stat-value">${stats.total}</div>
            <div class="stat-label">${t("reports.pdf.totalFeedings")}</div>
            <div class="stat-secondary">${stats.avgPerDay}${t("reports.pdf.perDayAvg")}</div>
          </div>

          <div class="stat-box">
            <div class="stat-value">${stats.byType.breast}</div>
            <div class="stat-label">${t("reports.pdf.breastfeeding")}</div>
          </div>

          <div class="stat-box">
            <div class="stat-value">${stats.byType.bottle}</div>
            <div class="stat-label">${t("reports.pdf.bottles")}</div>
          </div>
        </div>
      </div>

      ${hasBreast ? `
      <div class="card">
        <h3 style="font-size: 13px; font-weight: 600; margin-bottom: 10px;">${t("reports.pdf.breastfeedingDetails")}</h3>
        <div class="two-column">
          <div>
            <div class="info-row">
              <span class="info-label">${t("reports.pdf.totalSessions")}</span>
              <span class="info-value">${stats.breastfeeding.totalSessions}</span>
            </div>
            <div class="info-row">
              <span class="info-label">${t("reports.pdf.totalDuration")}</span>
              <span class="info-value">${formatDuration(stats.breastfeeding.totalMinutes)}</span>
            </div>
            <div class="info-row">
              <span class="info-label">${t("reports.pdf.avgDuration")}</span>
              <span class="info-value">${formatDuration(stats.breastfeeding.avgDurationMinutes)}</span>
            </div>
          </div>
          <div>
            <div class="info-row">
              <span class="info-label">${t("reports.pdf.leftSide")}</span>
              <span class="info-value">${formatDuration(stats.breastfeeding.leftMinutes)}</span>
            </div>
            <div class="info-row">
              <span class="info-label">${t("reports.pdf.rightSide")}</span>
              <span class="info-value">${formatDuration(stats.breastfeeding.rightMinutes)}</span>
            </div>
          </div>
        </div>
      </div>
      ` : ""}

      ${hasBottle ? `
      <div class="card">
        <h3 style="font-size: 13px; font-weight: 600; margin-bottom: 10px;">${t("reports.pdf.bottleFeedingDetails")}</h3>
        <div class="two-column">
          <div>
            <div class="info-row">
              <span class="info-label">${t("reports.pdf.totalSessions")}</span>
              <span class="info-value">${stats.bottle.totalSessions}</span>
            </div>
            <div class="info-row">
              <span class="info-label">${t("reports.pdf.totalVolume")}</span>
              <span class="info-value">${stats.bottle.totalMl} ml</span>
            </div>
            <div class="info-row">
              <span class="info-label">${t("reports.pdf.avgPerBottle")}</span>
              <span class="info-value">${stats.bottle.avgMl} ml</span>
            </div>
          </div>
          <div>
            <div class="info-row">
              <span class="info-label">${t("reports.pdf.formula")}</span>
              <span class="info-value">${stats.bottle.byContentType.formula}</span>
            </div>
            <div class="info-row">
              <span class="info-label">${t("reports.pdf.breastMilk")}</span>
              <span class="info-value">${stats.bottle.byContentType.breastMilk}</span>
            </div>
          </div>
        </div>
      </div>
      ` : ""}

      ${hasSolid ? `
      <div class="card">
        <h3 style="font-size: 13px; font-weight: 600; margin-bottom: 10px;">${t("reports.pdf.solidFoods")}</h3>
        <div class="info-row">
          <span class="info-label">${t("reports.pdf.totalMeals")}</span>
          <span class="info-value">${stats.solid.totalSessions}</span>
        </div>
        ${stats.solid.uniqueFoods.length > 0 ? `
        <div style="margin-top: 8px;">
          <span class="info-label">${t("reports.pdf.foodsIntroduced")}</span>
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

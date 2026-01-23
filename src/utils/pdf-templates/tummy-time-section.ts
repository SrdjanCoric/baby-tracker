/**
 * Tummy Time section template for PDF reports
 */

import type { TummyTimeReportStats } from "@/types/report";
import { formatDuration } from "./base-template";
import i18n from "@/i18n";

export function renderTummyTimeSection(stats: TummyTimeReportStats): string {
  const t = i18n.t.bind(i18n);
  const goalProgress = stats.dailyGoalMinutes && stats.totalDays > 0
    ? Math.round((stats.daysGoalMet / stats.totalDays) * 100)
    : null;

  return `
    <div class="section">
      <h2 class="section-title">
        <span class="section-icon">💪</span>
        ${t("reports.pdf.tummyTimeTitle")}
      </h2>

      <div class="card">
        <div class="stats-grid">
          <div class="stat-box">
            <div class="stat-value">${formatDuration(stats.totalMinutes)}</div>
            <div class="stat-label">${t("reports.pdf.totalTummyTime")}</div>
          </div>

          <div class="stat-box">
            <div class="stat-value">${stats.totalSessions}</div>
            <div class="stat-label">${t("reports.pdf.tummyTimeSessions")}</div>
            <div class="stat-secondary">${stats.avgSessionsPerDay}${t("reports.pdf.perDayAvg")}</div>
          </div>

          <div class="stat-box">
            <div class="stat-value">${formatDuration(stats.avgMinutesPerSession)}</div>
            <div class="stat-label">${t("reports.pdf.avgDuration")}</div>
          </div>
        </div>
      </div>

      <div class="card">
        <h3 style="font-size: 13px; font-weight: 600; margin-bottom: 10px;">${t("reports.pdf.totalSessions")}</h3>
        <div class="two-column">
          <div>
            <div class="info-row">
              <span class="info-label">${t("reports.pdf.longestSleep")}</span>
              <span class="info-value">${formatDuration(stats.longestSessionMinutes)}</span>
            </div>
            <div class="info-row">
              <span class="info-label">${t("reports.pdf.avgPerSession")}</span>
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

      ${stats.dailyGoalMinutes ? `
      <div class="card">
        <h3 style="font-size: 13px; font-weight: 600; margin-bottom: 10px;">${t("reports.pdf.goalAchievementRate")}</h3>
        <div class="info-row">
          <span class="info-label">${t("tummyTime.dailyGoal")}</span>
          <span class="info-value">${formatDuration(stats.dailyGoalMinutes)}</span>
        </div>
        <div class="info-row">
          <span class="info-label">${t("reports.pdf.daysWithTummyTime")}</span>
          <span class="info-value">${stats.daysGoalMet} / ${stats.totalDays}</span>
        </div>
        ${goalProgress !== null ? `
        <div style="margin-top: 8px;">
          <div style="display: flex; justify-content: space-between; font-size: 10px; margin-bottom: 4px;">
            <span class="info-label">${t("reports.pdf.goalAchievementRate")}</span>
            <span class="info-value">${goalProgress}%</span>
          </div>
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${goalProgress}%;"></div>
          </div>
        </div>
        ` : ""}
      </div>
      ` : ""}
    </div>
  `;
}

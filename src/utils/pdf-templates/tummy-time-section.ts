/**
 * Tummy Time section template for PDF reports
 */

import type { TummyTimeReportStats } from "@/types/report";
import { formatDuration } from "./base-template";

export function renderTummyTimeSection(stats: TummyTimeReportStats): string {
  const goalProgress = stats.dailyGoalMinutes && stats.totalDays > 0
    ? Math.round((stats.daysGoalMet / stats.totalDays) * 100)
    : null;

  return `
    <div class="section">
      <h2 class="section-title">
        <span class="section-icon">💪</span>
        Tummy Time
      </h2>

      <div class="card">
        <div class="stats-grid">
          <div class="stat-box">
            <div class="stat-value">${formatDuration(stats.totalMinutes)}</div>
            <div class="stat-label">Total Time</div>
          </div>

          <div class="stat-box">
            <div class="stat-value">${stats.totalSessions}</div>
            <div class="stat-label">Sessions</div>
            <div class="stat-secondary">${stats.avgSessionsPerDay}/day avg</div>
          </div>

          <div class="stat-box">
            <div class="stat-value">${formatDuration(stats.avgMinutesPerSession)}</div>
            <div class="stat-label">Avg Duration</div>
          </div>
        </div>
      </div>

      <div class="card">
        <h3 style="font-size: 13px; font-weight: 600; margin-bottom: 10px;">Session Details</h3>
        <div class="two-column">
          <div>
            <div class="info-row">
              <span class="info-label">Longest Session</span>
              <span class="info-value">${formatDuration(stats.longestSessionMinutes)}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Avg per Session</span>
              <span class="info-value">${formatDuration(stats.avgMinutesPerSession)}</span>
            </div>
          </div>
          <div>
            <div class="info-row">
              <span class="info-label">Sessions per Day</span>
              <span class="info-value">${stats.avgSessionsPerDay}</span>
            </div>
          </div>
        </div>
      </div>

      ${stats.dailyGoalMinutes ? `
      <div class="card">
        <h3 style="font-size: 13px; font-weight: 600; margin-bottom: 10px;">Goal Progress</h3>
        <div class="info-row">
          <span class="info-label">Daily Goal</span>
          <span class="info-value">${formatDuration(stats.dailyGoalMinutes)}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Days Goal Met</span>
          <span class="info-value">${stats.daysGoalMet} of ${stats.totalDays} days</span>
        </div>
        ${goalProgress !== null ? `
        <div style="margin-top: 8px;">
          <div style="display: flex; justify-content: space-between; font-size: 10px; margin-bottom: 4px;">
            <span class="info-label">Achievement Rate</span>
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

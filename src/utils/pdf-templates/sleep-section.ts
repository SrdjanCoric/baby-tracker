/**
 * Sleep section template for PDF reports
 */

import type { SleepReportStats } from "@/types/report";
import { formatDuration } from "./base-template";

export function renderSleepSection(stats: SleepReportStats): string {
  return `
    <div class="section">
      <h2 class="section-title">
        <span class="section-icon">😴</span>
        Sleep
      </h2>

      <div class="card">
        <div class="stats-grid">
          <div class="stat-box">
            <div class="stat-value">${formatDuration(stats.totalMinutes)}</div>
            <div class="stat-label">Total Sleep</div>
            <div class="stat-secondary">${formatDuration(stats.avgPerDay)}/day avg</div>
          </div>

          <div class="stat-box">
            <div class="stat-value">${stats.totalSessions}</div>
            <div class="stat-label">Sleep Sessions</div>
          </div>

          <div class="stat-box">
            <div class="stat-value">${formatDuration(stats.avgDurationMinutes)}</div>
            <div class="stat-label">Avg Duration</div>
          </div>
        </div>
      </div>

      <div class="card">
        <h3 style="font-size: 13px; font-weight: 600; margin-bottom: 10px;">Sleep by Type</h3>
        <table class="table">
          <thead>
            <tr>
              <th>Type</th>
              <th class="text-center">Sessions</th>
              <th class="text-center">Total</th>
              <th class="text-center">Average</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Naps</td>
              <td class="text-center">${stats.byType.nap.count}</td>
              <td class="text-center">${formatDuration(stats.byType.nap.totalMinutes)}</td>
              <td class="text-center">${formatDuration(stats.byType.nap.avgMinutes)}</td>
            </tr>
            <tr>
              <td>Night Sleep</td>
              <td class="text-center">${stats.byType.night.count}</td>
              <td class="text-center">${formatDuration(stats.byType.night.totalMinutes)}</td>
              <td class="text-center">${formatDuration(stats.byType.night.avgMinutes)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      ${stats.longestSleepMinutes > 0 || stats.shortestSleepMinutes > 0 ? `
      <div class="card">
        <h3 style="font-size: 13px; font-weight: 600; margin-bottom: 10px;">Sleep Range</h3>
        <div class="two-column">
          <div class="info-row">
            <span class="info-label">Longest Sleep</span>
            <span class="info-value">${formatDuration(stats.longestSleepMinutes)}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Shortest Sleep</span>
            <span class="info-value">${formatDuration(stats.shortestSleepMinutes)}</span>
          </div>
        </div>
      </div>
      ` : ""}
    </div>
  `;
}

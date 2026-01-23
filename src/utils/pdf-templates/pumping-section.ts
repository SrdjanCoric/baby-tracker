/**
 * Pumping section template for PDF reports
 */

import type { PumpingReportStats } from "@/types/report";
import { formatDuration } from "./base-template";

export function renderPumpingSection(stats: PumpingReportStats): string {
  const totalBySide = stats.bySide.left.totalMl + stats.bySide.right.totalMl + stats.bySide.both.totalMl;

  return `
    <div class="section">
      <h2 class="section-title">
        <span class="section-icon">🫙</span>
        Pumping
      </h2>

      <div class="card">
        <div class="stats-grid">
          <div class="stat-box">
            <div class="stat-value">${stats.totalMl} ml</div>
            <div class="stat-label">Total Pumped</div>
          </div>

          <div class="stat-box">
            <div class="stat-value">${stats.totalSessions}</div>
            <div class="stat-label">Sessions</div>
            <div class="stat-secondary">${stats.avgSessionsPerDay}/day avg</div>
          </div>

          <div class="stat-box">
            <div class="stat-value">${stats.avgMlPerSession} ml</div>
            <div class="stat-label">Avg per Session</div>
          </div>
        </div>
      </div>

      <div class="card">
        <h3 style="font-size: 13px; font-weight: 600; margin-bottom: 10px;">Session Details</h3>
        <div class="two-column">
          <div>
            <div class="info-row">
              <span class="info-label">Total Time</span>
              <span class="info-value">${formatDuration(stats.totalMinutes)}</span>
            </div>
            <div class="info-row">
              <span class="info-label">Avg Duration</span>
              <span class="info-value">${formatDuration(stats.avgMinutesPerSession)}</span>
            </div>
          </div>
          <div>
            <div class="info-row">
              <span class="info-label">Sessions/Day</span>
              <span class="info-value">${stats.avgSessionsPerDay}</span>
            </div>
          </div>
        </div>
      </div>

      <div class="card">
        <h3 style="font-size: 13px; font-weight: 600; margin-bottom: 10px;">By Side</h3>
        <table class="table">
          <thead>
            <tr>
              <th>Side</th>
              <th class="text-center">Sessions</th>
              <th class="text-center">Total Volume</th>
              <th class="text-center">Percentage</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Left</td>
              <td class="text-center">${stats.bySide.left.sessions}</td>
              <td class="text-center">${stats.bySide.left.totalMl} ml</td>
              <td class="text-center">${totalBySide > 0 ? Math.round((stats.bySide.left.totalMl / totalBySide) * 100) : 0}%</td>
            </tr>
            <tr>
              <td>Right</td>
              <td class="text-center">${stats.bySide.right.sessions}</td>
              <td class="text-center">${stats.bySide.right.totalMl} ml</td>
              <td class="text-center">${totalBySide > 0 ? Math.round((stats.bySide.right.totalMl / totalBySide) * 100) : 0}%</td>
            </tr>
            <tr>
              <td>Both</td>
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

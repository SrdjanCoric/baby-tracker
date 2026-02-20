/**
 * Growth section template for PDF reports
 */

import type { GrowthReportStats } from "@/types/report";
import type { Gender } from "@/types/growth-chart";
import { formatDate, getPercentileClass } from "./base-template";
import {
  generatePercentileLine,
  getPercentileValue,
} from "@/utils/percentile-calculator";
import { PERCENTILE_LINES } from "@/types/growth-chart";
import { PERCENTILE_COLORS_HEX } from "@/constants/report";
import i18n from "@/i18n";

function renderPercentileBadge(percentile: number | undefined): string {
  if (percentile === undefined) return "-";
  const className = getPercentileClass(percentile);
  return `<span class="percentile-label ${className}">${Math.round(percentile)}%</span>`;
}

function generateGrowthChartSvg(
  stats: GrowthReportStats,
  measurementType: "weight" | "height" | "head",
  gender: Gender
): string {
  const measurements = stats.measurements.filter((m) => {
    if (measurementType === "weight") return m.weight != null;
    if (measurementType === "height") return m.height != null;
    return m.headCircumference != null;
  });

  if (measurements.length === 0) return "";

  const width = 400;
  const height = 200;
  const padding = { top: 20, right: 50, bottom: 30, left: 45 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const maxAge = Math.min(24, Math.max(...measurements.map((m) => m.ageMonths)) + 2);
  const minAge = 0;

  const p3Data = generatePercentileLine(gender, measurementType, 3, minAge, maxAge, 1);
  const p97Data = generatePercentileLine(gender, measurementType, 97, minAge, maxAge, 1);

  let minY = Math.min(...p3Data.map((p) => p.value));
  let maxY = Math.max(...p97Data.map((p) => p.value));

  const measurementValues = measurements.map((m) => {
    if (measurementType === "weight") return m.weight!;
    if (measurementType === "height") return m.height!;
    return m.headCircumference!;
  });

  minY = Math.min(minY, ...measurementValues);
  maxY = Math.max(maxY, ...measurementValues);

  const yRange = maxY - minY;
  minY = Math.max(0, minY - yRange * 0.1);
  maxY = maxY + yRange * 0.1;

  const scaleX = (age: number) =>
    padding.left + ((age - minAge) / (maxAge - minAge)) * chartWidth;
  const scaleY = (value: number) =>
    padding.top + ((maxY - value) / (maxY - minY)) * chartHeight;

  const percentileLines = PERCENTILE_LINES.map((percentile) => {
    const points = generatePercentileLine(gender, measurementType, percentile, minAge, maxAge, 1);
    const pathData = points
      .map((p, i) => `${i === 0 ? "M" : "L"} ${scaleX(p.ageMonths).toFixed(1)} ${scaleY(p.value).toFixed(1)}`)
      .join(" ");
    return { percentile, pathData, color: PERCENTILE_COLORS_HEX[percentile] };
  });

  const measurementPath = measurements
    .map((m, i) => {
      const value = measurementType === "weight" ? m.weight! : measurementType === "height" ? m.height! : m.headCircumference!;
      return `${i === 0 ? "M" : "L"} ${scaleX(m.ageMonths).toFixed(1)} ${scaleY(value).toFixed(1)}`;
    })
    .join(" ");

  const measurementPoints = measurements.map((m) => {
    const value = measurementType === "weight" ? m.weight! : measurementType === "height" ? m.height! : m.headCircumference!;
    return { x: scaleX(m.ageMonths), y: scaleY(value) };
  });

  const t = i18n.t.bind(i18n);
  const title = measurementType === "weight" ? `${t("reports.pdf.weight")} (kg)` : measurementType === "height" ? `${t("reports.pdf.height")} (cm)` : `${t("reports.pdf.headCircumference")} (cm)`;

  return `
    <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="${width}" height="${height}" fill="#FFFFFF" rx="8"/>

      <!-- Grid lines -->
      ${[0, 6, 12, 18, 24].filter(age => age <= maxAge).map(age => `
        <line x1="${scaleX(age)}" y1="${padding.top}" x2="${scaleX(age)}" y2="${height - padding.bottom}"
              stroke="#E5E7EB" stroke-width="1" stroke-dasharray="4,4"/>
        <text x="${scaleX(age)}" y="${height - 8}" font-size="9" fill="#6B7280" text-anchor="middle">${age}m</text>
      `).join("")}

      <!-- Y-axis labels -->
      ${Array.from({ length: 5 }).map((_, i) => {
        const value = minY + ((maxY - minY) * (4 - i)) / 4;
        return `
          <line x1="${padding.left}" y1="${scaleY(value)}" x2="${width - padding.right}" y2="${scaleY(value)}"
                stroke="#E5E7EB" stroke-width="1" stroke-dasharray="4,4"/>
          <text x="${padding.left - 5}" y="${scaleY(value) + 3}" font-size="9" fill="#6B7280" text-anchor="end">
            ${measurementType === "weight" ? value.toFixed(1) : Math.round(value)}
          </text>
        `;
      }).join("")}

      <!-- Percentile lines -->
      ${percentileLines.map(({ percentile, pathData, color }) => `
        <path d="${pathData}" fill="none" stroke="${color}" stroke-width="${percentile === 50 ? 2 : 1.5}" opacity="${percentile === 50 ? 1 : 0.7}"/>
      `).join("")}

      <!-- Percentile labels -->
      ${percentileLines.map(({ percentile, color }) => {
        const lastValue = getPercentileValue(gender, maxAge, percentile, measurementType);
        if (lastValue === null) return "";
        return `
          <text x="${width - padding.right + 4}" y="${scaleY(lastValue) + 3}" font-size="8" fill="${color}" font-weight="${percentile === 50 ? "bold" : "normal"}">
            ${percentile}%
          </text>
        `;
      }).join("")}

      <!-- Baby's measurement line -->
      ${measurements.length > 1 ? `
        <path d="${measurementPath}" fill="none" stroke="#009B77" stroke-width="2.5" stroke-linecap="round"/>
      ` : ""}

      <!-- Baby's measurement points -->
      ${measurementPoints.map(({ x, y }) => `
        <circle cx="${x}" cy="${y}" r="5" fill="#009B77" stroke="#FFFFFF" stroke-width="2"/>
      `).join("")}

      <!-- Title -->
      <text x="${width / 2}" y="14" font-size="11" fill="#374151" text-anchor="middle" font-weight="600">${title}</text>
    </svg>
  `;
}

export function renderGrowthSection(
  stats: GrowthReportStats,
  babyGender?: Gender,
  includeCharts?: boolean
): string {
  const t = i18n.t.bind(i18n);
  const hasWeight = stats.latestWeight !== undefined;
  const hasHeight = stats.latestHeight !== undefined;
  const hasHead = stats.latestHeadCircumference !== undefined;
  const hasMeasurements = stats.measurements.length > 0;

  const showCharts = includeCharts && babyGender && hasMeasurements;

  return `
    <div class="section">
      <h2 class="section-title">
        <span class="section-icon">📏</span>
        ${t("reports.pdf.growthTitle")}
      </h2>

      ${hasWeight || hasHeight || hasHead ? `
      <div class="card">
        <h3 style="font-size: 13px; font-weight: 600; margin-bottom: 10px;">${t("reports.pdf.latestMeasurements")}</h3>
        <table class="table">
          <thead>
            <tr>
              <th>${t("reports.pdf.measurements")}</th>
              <th class="text-center">${t("reports.pdf.volume")}</th>
              <th class="text-center">${t("reports.pdf.percentile")}</th>
              <th class="text-center">${t("reports.pdf.date")}</th>
            </tr>
          </thead>
          <tbody>
            ${hasWeight ? `
            <tr>
              <td>${t("reports.pdf.weight")}</td>
              <td class="text-center">${stats.latestWeight!.value.toFixed(2)} kg</td>
              <td class="text-center">${renderPercentileBadge(stats.latestWeight!.percentile)}</td>
              <td class="text-center">${formatDate(stats.latestWeight!.date)}</td>
            </tr>
            ` : ""}
            ${hasHeight ? `
            <tr>
              <td>${t("reports.pdf.height")}</td>
              <td class="text-center">${stats.latestHeight!.value.toFixed(1)} cm</td>
              <td class="text-center">${renderPercentileBadge(stats.latestHeight!.percentile)}</td>
              <td class="text-center">${formatDate(stats.latestHeight!.date)}</td>
            </tr>
            ` : ""}
            ${hasHead ? `
            <tr>
              <td>${t("reports.pdf.headCircumference")}</td>
              <td class="text-center">${stats.latestHeadCircumference!.value.toFixed(1)} cm</td>
              <td class="text-center">${renderPercentileBadge(stats.latestHeadCircumference!.percentile)}</td>
              <td class="text-center">${formatDate(stats.latestHeadCircumference!.date)}</td>
            </tr>
            ` : ""}
          </tbody>
        </table>
      </div>
      ` : ""}

      ${stats.weightGain || stats.heightGain ? `
      <div class="card">
        <h3 style="font-size: 13px; font-weight: 600; margin-bottom: 10px;">${t("reports.pdf.growthHistory")}</h3>
        <div class="two-column">
          ${stats.weightGain ? `
          <div>
            <div class="info-row">
              <span class="info-label">${t("reports.pdf.weight")}</span>
              <span class="info-value" style="color: ${stats.weightGain.change >= 0 ? "#22C55E" : "#EF4444"}">
                ${stats.weightGain.change >= 0 ? "+" : ""}${stats.weightGain.change.toFixed(2)} kg
              </span>
            </div>
            <div style="font-size: 10px; color: #6B7280; margin-top: 2px;">
              ${stats.weightGain.startValue.toFixed(2)} kg → ${stats.weightGain.endValue.toFixed(2)} kg
            </div>
          </div>
          ` : ""}
          ${stats.heightGain ? `
          <div>
            <div class="info-row">
              <span class="info-label">${t("reports.pdf.height")}</span>
              <span class="info-value" style="color: ${stats.heightGain.change >= 0 ? "#22C55E" : "#EF4444"}">
                ${stats.heightGain.change >= 0 ? "+" : ""}${stats.heightGain.change.toFixed(1)} cm
              </span>
            </div>
            <div style="font-size: 10px; color: #6B7280; margin-top: 2px;">
              ${stats.heightGain.startValue.toFixed(1)} cm → ${stats.heightGain.endValue.toFixed(1)} cm
            </div>
          </div>
          ` : ""}
        </div>
      </div>
      ` : ""}

      ${showCharts && hasWeight ? `
      <div class="card">
        <h3 style="font-size: 13px; font-weight: 600; margin-bottom: 10px;">WHO ${t("reports.pdf.weight")}</h3>
        <div class="chart-container">
          ${generateGrowthChartSvg(stats, "weight", babyGender!)}
        </div>
      </div>
      ` : ""}

      ${showCharts && hasHeight ? `
      <div class="card">
        <h3 style="font-size: 13px; font-weight: 600; margin-bottom: 10px;">WHO ${t("reports.pdf.height")}</h3>
        <div class="chart-container">
          ${generateGrowthChartSvg(stats, "height", babyGender!)}
        </div>
      </div>
      ` : ""}

      ${showCharts && hasHead ? `
      <div class="card">
        <h3 style="font-size: 13px; font-weight: 600; margin-bottom: 10px;">WHO ${t("reports.pdf.headCircumference")}</h3>
        <div class="chart-container">
          ${generateGrowthChartSvg(stats, "head", babyGender!)}
        </div>
      </div>
      ` : ""}

      ${!hasMeasurements ? `
      <div class="card" style="text-align: center; padding: 24px;">
        <p style="color: #6B7280;">${t("growth.noMeasurements")}</p>
      </div>
      ` : ""}
    </div>
  `;
}

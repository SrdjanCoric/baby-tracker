/**
 * Header section template for PDF reports
 */

import type { ReportMetadata } from "@/types/report";
import { formatDate, formatDateTime } from "./base-template";

export function renderHeaderSection(metadata: ReportMetadata): string {
  const ageText = metadata.babyAgeMonths !== undefined
    ? `${Math.floor(metadata.babyAgeMonths)} months old`
    : "";

  return `
    <div class="header">
      <h1 class="header-title">${metadata.babyName}'s Health Report</h1>
      <p class="header-subtitle">
        ${formatDate(metadata.startDate)} - ${formatDate(metadata.endDate)}
        ${ageText ? ` | ${ageText}` : ""}
      </p>
      <p class="header-subtitle" style="font-size: 10px; margin-top: 4px;">
        Generated on ${formatDateTime(metadata.generatedAt)}
      </p>
    </div>
  `;
}

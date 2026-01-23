/**
 * Header section template for PDF reports
 */

import type { ReportMetadata } from "@/types/report";
import { formatDate, formatDateTime } from "./base-template";
import i18n from "@/i18n";

export function renderHeaderSection(metadata: ReportMetadata): string {
  const t = i18n.t.bind(i18n);
  const ageText = metadata.babyAgeMonths !== undefined
    ? t("baby.monthsOld", { count: Math.floor(metadata.babyAgeMonths) })
    : "";

  return `
    <div class="header">
      <h1 class="header-title">${t("reports.pdf.healthReport", { name: metadata.babyName })}</h1>
      <p class="header-subtitle">
        ${formatDate(metadata.startDate)} - ${formatDate(metadata.endDate)}
        ${ageText ? ` | ${ageText}` : ""}
      </p>
      <p class="header-subtitle" style="font-size: 10px; margin-top: 4px;">
        ${t("reports.pdf.generatedOn", { date: formatDateTime(metadata.generatedAt) })}
      </p>
    </div>
  `;
}

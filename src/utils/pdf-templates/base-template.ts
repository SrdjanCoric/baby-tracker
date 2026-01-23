/**
 * Base HTML template for PDF reports
 */

import { REPORT_COLORS } from "@/constants/report";

const { primary, primaryLight, secondary, text, textLight, border, background, tableHeader, tableRowAlt } = REPORT_COLORS;

export const baseStyles = `
  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  body {
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    color: ${text};
    background-color: ${background};
    font-size: 12px;
    line-height: 1.5;
    padding: 20px;
  }

  .report-container {
    max-width: 100%;
    margin: 0 auto;
  }

  .header {
    text-align: center;
    margin-bottom: 24px;
    padding-bottom: 16px;
    border-bottom: 2px solid ${primary};
  }

  .header-title {
    font-size: 24px;
    font-weight: 700;
    color: ${primary};
    margin-bottom: 4px;
  }

  .header-subtitle {
    font-size: 14px;
    color: ${textLight};
  }

  .section {
    margin-bottom: 24px;
    page-break-inside: avoid;
  }

  .section-title {
    font-size: 16px;
    font-weight: 600;
    color: ${primary};
    margin-bottom: 12px;
    padding-bottom: 4px;
    border-bottom: 1px solid ${border};
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .section-icon {
    font-size: 18px;
  }

  .card {
    background-color: ${background};
    border: 1px solid ${border};
    border-radius: 8px;
    padding: 12px;
    margin-bottom: 12px;
  }

  .stats-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 12px;
  }

  .stat-box {
    background-color: ${primaryLight};
    border-radius: 6px;
    padding: 10px;
    text-align: center;
  }

  .stat-value {
    font-size: 20px;
    font-weight: 700;
    color: ${primary};
    margin-bottom: 2px;
  }

  .stat-label {
    font-size: 10px;
    color: ${textLight};
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .stat-secondary {
    font-size: 10px;
    color: ${secondary};
    margin-top: 2px;
  }

  .table {
    width: 100%;
    border-collapse: collapse;
    font-size: 11px;
  }

  .table th,
  .table td {
    padding: 8px 10px;
    text-align: left;
    border-bottom: 1px solid ${border};
  }

  .table th {
    background-color: ${tableHeader};
    font-weight: 600;
    color: ${text};
    font-size: 10px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .table tr:nth-child(even) td {
    background-color: ${tableRowAlt};
  }

  .table .text-right {
    text-align: right;
  }

  .table .text-center {
    text-align: center;
  }

  .info-row {
    display: flex;
    justify-content: space-between;
    padding: 6px 0;
    border-bottom: 1px solid ${border};
  }

  .info-row:last-child {
    border-bottom: none;
  }

  .info-label {
    color: ${textLight};
    font-size: 11px;
  }

  .info-value {
    font-weight: 500;
    font-size: 11px;
  }

  .badge {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 12px;
    font-size: 10px;
    font-weight: 500;
  }

  .badge-primary {
    background-color: ${primaryLight};
    color: ${primary};
  }

  .badge-secondary {
    background-color: ${tableHeader};
    color: ${textLight};
  }

  .progress-bar {
    background-color: ${border};
    border-radius: 4px;
    height: 8px;
    overflow: hidden;
    margin-top: 4px;
  }

  .progress-fill {
    background-color: ${primary};
    height: 100%;
    border-radius: 4px;
  }

  .chart-container {
    margin: 16px 0;
    text-align: center;
  }

  .percentile-label {
    font-size: 10px;
    padding: 2px 6px;
    border-radius: 4px;
    font-weight: 500;
  }

  .percentile-normal {
    background-color: #DCFCE7;
    color: #166534;
  }

  .percentile-warning {
    background-color: #FEF3C7;
    color: #92400E;
  }

  .percentile-alert {
    background-color: #FEE2E2;
    color: #991B1B;
  }

  .two-column {
    display: grid;
    grid-template-columns: repeat(2, 1fr);
    gap: 16px;
  }

  .footer {
    margin-top: 32px;
    padding-top: 16px;
    border-top: 1px solid ${border};
    text-align: center;
    font-size: 10px;
    color: ${textLight};
  }

  .page-break {
    page-break-before: always;
  }

  @media print {
    body {
      padding: 0;
    }

    .section {
      page-break-inside: avoid;
    }
  }
`;

export function wrapInHtmlDocument(content: string, title: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>${baseStyles}</style>
</head>
<body>
  <div class="report-container">
    ${content}
  </div>
</body>
</html>
  `.trim();
}

export function formatDate(date: Date): string {
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatDateTime(date: Date): string {
  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDuration(minutes: number): string {
  if (minutes < 60) {
    return `${Math.round(minutes)} min`;
  }
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = Math.round(minutes % 60);
  if (remainingMinutes === 0) {
    return `${hours}h`;
  }
  return `${hours}h ${remainingMinutes}m`;
}

export function getPercentileClass(percentile: number): string {
  if (percentile < 3 || percentile > 97) {
    return "percentile-alert";
  }
  if (percentile < 15 || percentile > 85) {
    return "percentile-warning";
  }
  return "percentile-normal";
}

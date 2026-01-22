/**
 * Input Sanitization Utility
 * Provides functions to sanitize user input for security
 */

/**
 * Removes HTML tags and potential script injection from strings
 * @param input - The string to sanitize
 * @returns Sanitized string with HTML tags removed
 */
export function sanitizeHtml(input: string): string {
  if (!input) return "";

  let result = input;

  result = result.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");

  result = result.replace(/<[^>]*>/g, "");

  result = result.replace(/&lt;/g, "<");
  result = result.replace(/&gt;/g, ">");
  result = result.replace(/&amp;/g, "&");
  result = result.replace(/&quot;/g, '"');
  result = result.replace(/&#x27;/g, "'");
  result = result.replace(/&#x2F;/g, "/");

  result = result.replace(/javascript:/gi, "");
  result = result.replace(/on\w+\s*=/gi, "");

  return result.trim();
}

/**
 * Sanitizes a name input (removes HTML, limits length, trims whitespace)
 * @param name - The name to sanitize
 * @param maxLength - Maximum allowed length (default 100)
 * @returns Sanitized name
 */
export function sanitizeName(name: string, maxLength = 100): string {
  const sanitized = sanitizeHtml(name);
  return sanitized.slice(0, maxLength).trim();
}

/**
 * CSV Formula Injection Prevention
 * Prefixes potentially dangerous CSV values with a single quote
 * to prevent formula injection when opened in Excel/Sheets
 *
 * Dangerous characters: = + - @ | (at the start of a cell)
 * These can be used to execute formulas in spreadsheet applications
 *
 * @param value - The value to sanitize for CSV
 * @returns Sanitized value safe for CSV
 */
export function sanitizeCSVValue(value: string): string {
  if (!value) return "";

  const trimmed = value.trim();

  if (/^[=+\-@|]/.test(trimmed)) {
    return `'${trimmed}`;
  }

  return trimmed;
}

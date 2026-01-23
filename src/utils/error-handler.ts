/**
 * Error handling utilities
 * Functions for creating, categorizing, and handling errors
 */

import type { AppError, ErrorCategory, ErrorSeverity } from "@/types/error";

interface CreateAppErrorOptions {
  message: string;
  code?: string;
  category?: ErrorCategory;
  severity?: ErrorSeverity;
  originalError?: Error;
  context?: Record<string, unknown>;
  isRecoverable?: boolean;
}

const NETWORK_ERROR_PATTERNS = [
  /network/i,
  /fetch/i,
  /internet/i,
  /connection/i,
  /offline/i,
  /ECONNREFUSED/i,
  /ENOTFOUND/i,
];

const AUTH_ERROR_PATTERNS = [
  /401/,
  /403/,
  /unauthorized/i,
  /forbidden/i,
  /session.*expired/i,
  /authentication.*failed/i,
  /not.*authenticated/i,
];

const VALIDATION_ERROR_PATTERNS = [
  /validation/i,
  /invalid/i,
  /required/i,
  /format/i,
];

const SYNC_ERROR_PATTERNS = [/\bsync\b/i, /conflict/i, /merge/i];

const STORAGE_ERROR_PATTERNS = [
  /storage/i,
  /quota/i,
  /asyncstorage/i,
  /disk/i,
];

const SENSITIVE_KEYS = new Set([
  "email",
  "password",
  "token",
  "accesstoken",
  "refreshtoken",
  "babyname",
  "name",
  "firstname",
  "lastname",
  "phone",
  "address",
  "secret",
  "apikey",
  "authorization",
]);

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const NAME_PATTERN_REGEX = /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b/g;
const BABY_NAME_REGEX = /\bbaby\s+([A-Z][a-z]+)\b/gi;

export function createAppError(options: CreateAppErrorOptions): AppError {
  return {
    message: options.message,
    code: options.code,
    category: options.category ?? "unknown",
    severity: options.severity ?? "medium",
    originalError: options.originalError,
    context: options.context,
    timestamp: new Date(),
    isRecoverable: options.isRecoverable ?? true,
  };
}

export function getErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) {
    return "Something went wrong. Please try again.";
  }

  const message = error.message.toLowerCase();

  if (NETWORK_ERROR_PATTERNS.some((p) => p.test(error.message))) {
    return "Unable to connect. Please check your internet connection.";
  }

  if (/timeout/i.test(message)) {
    return "Request timed out. Please try again.";
  }

  if (/401/i.test(message) || /unauthorized/i.test(message)) {
    return "Your session has expired. Please sign in again.";
  }

  if (/403/i.test(message) || /forbidden/i.test(message)) {
    return "You don't have permission to perform this action.";
  }

  if (/404/i.test(message)) {
    return "The requested data was not found.";
  }

  if (/429/i.test(message)) {
    return "Too many requests. Please wait a moment and try again.";
  }

  if (/5\d{2}/i.test(message) || /server.*error/i.test(message)) {
    return "Something went wrong on our end. Please try again later.";
  }

  return "Something went wrong. Please try again.";
}

export function getErrorCategory(error: Error): ErrorCategory {
  const message = error.message;

  if (NETWORK_ERROR_PATTERNS.some((p) => p.test(message))) {
    return "network";
  }

  if (AUTH_ERROR_PATTERNS.some((p) => p.test(message))) {
    return "auth";
  }

  if (VALIDATION_ERROR_PATTERNS.some((p) => p.test(message))) {
    return "validation";
  }

  if (SYNC_ERROR_PATTERNS.some((p) => p.test(message))) {
    return "sync";
  }

  if (STORAGE_ERROR_PATTERNS.some((p) => p.test(message))) {
    return "storage";
  }

  return "unknown";
}

export function isNetworkError(error: Error): boolean {
  return getErrorCategory(error) === "network";
}

export function isAuthError(error: Error): boolean {
  return getErrorCategory(error) === "auth";
}

export function isRecoverableError(error: Error): boolean {
  const message = error.message;

  if (NETWORK_ERROR_PATTERNS.some((p) => p.test(message))) {
    return true;
  }

  if (/timeout/i.test(message)) {
    return true;
  }

  if (/429/i.test(message) || /503/i.test(message)) {
    return true;
  }

  if (AUTH_ERROR_PATTERNS.some((p) => p.test(message))) {
    return false;
  }

  if (/404/i.test(message)) {
    return false;
  }

  if (VALIDATION_ERROR_PATTERNS.some((p) => p.test(message))) {
    return false;
  }

  return false;
}

export function calculateBackoffDelay(
  attempt: number,
  baseDelayMs: number,
  maxDelayMs: number
): number {
  const delay = baseDelayMs * Math.pow(2, attempt);
  return Math.min(delay, maxDelayMs);
}

export function shouldRetryError(
  error: Error,
  attempt: number,
  maxRetries: number
): boolean {
  if (attempt >= maxRetries) {
    return false;
  }

  return isRecoverableError(error);
}

export function sanitizeErrorForReporting(error: AppError): AppError {
  let sanitizedMessage = error.message;
  sanitizedMessage = sanitizedMessage.replace(EMAIL_REGEX, "[EMAIL]");
  sanitizedMessage = sanitizedMessage.replace(NAME_PATTERN_REGEX, "[NAME]");
  sanitizedMessage = sanitizedMessage.replace(BABY_NAME_REGEX, "baby [NAME]");

  let sanitizedContext: Record<string, unknown> | undefined;
  if (error.context) {
    sanitizedContext = {};
    for (const [key, value] of Object.entries(error.context)) {
      if (!SENSITIVE_KEYS.has(key.toLowerCase())) {
        sanitizedContext[key] = value;
      }
    }
  }

  return {
    ...error,
    message: sanitizedMessage,
    context: sanitizedContext,
  };
}

interface FormattedError {
  title: string;
  message: string;
  canRetry: boolean;
}

const CATEGORY_TITLES: Record<ErrorCategory, string> = {
  network: "Connection Error",
  auth: "Authentication Error",
  validation: "Validation Error",
  sync: "Sync Error",
  storage: "Storage Error",
  unknown: "Error",
};

export function formatErrorForUser(error: AppError): FormattedError {
  const title = CATEGORY_TITLES[error.category] || "Error";
  const message = getErrorMessage(error.originalError || new Error(error.message));

  return {
    title,
    message,
    canRetry: error.isRecoverable,
  };
}

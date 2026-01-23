/**
 * Error type definitions
 * Types for error handling, error boundaries, and error reporting
 */

export type ErrorSeverity = "low" | "medium" | "high" | "critical";

export type ErrorCategory =
  | "network"
  | "auth"
  | "validation"
  | "sync"
  | "storage"
  | "unknown";

export interface AppError {
  message: string;
  code?: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  originalError?: Error;
  context?: Record<string, unknown>;
  timestamp: Date;
  isRecoverable: boolean;
}

export interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export interface ErrorInfo {
  componentStack: string;
}

export interface ErrorFallbackProps {
  error: Error | null;
  resetError: () => void;
  errorInfo?: ErrorInfo | null;
}

export interface ErrorReportPayload {
  message: string;
  stack?: string;
  category: ErrorCategory;
  severity: ErrorSeverity;
  context?: Record<string, unknown>;
  componentStack?: string;
  deviceInfo?: DeviceInfo;
  timestamp: string;
}

export interface DeviceInfo {
  platform: string;
  version: string;
  appVersion?: string;
}

export interface NetworkErrorInfo {
  url?: string;
  method?: string;
  status?: number;
  message: string;
}

export interface ApiErrorResponse {
  message: string;
  code?: string;
  status: number;
  details?: Record<string, unknown>;
}

export type RetryConfig = {
  maxRetries: number;
  baseDelayMs: number;
  maxDelayMs: number;
  shouldRetry: (error: Error, attempt: number) => boolean;
};

export const DEFAULT_RETRY_CONFIG: RetryConfig = {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 30000,
  shouldRetry: (error, attempt) => {
    if (attempt >= 3) return false;
    if (error.message.includes("Network")) return true;
    if (error.message.includes("timeout")) return true;
    return false;
  },
};

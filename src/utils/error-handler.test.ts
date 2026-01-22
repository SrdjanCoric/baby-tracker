import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  createAppError,
  getErrorMessage,
  getErrorCategory,
  isNetworkError,
  isAuthError,
  isRecoverableError,
  calculateBackoffDelay,
  shouldRetryError,
  sanitizeErrorForReporting,
  formatErrorForUser,
} from "./error-handler";
import type { ErrorCategory, ErrorSeverity } from "@/types/error";

describe("error-handler utilities", () => {
  describe("createAppError", () => {
    it("should create an AppError with all properties", () => {
      const originalError = new Error("Original error");
      const error = createAppError({
        message: "Test error",
        code: "TEST_001",
        category: "validation",
        severity: "medium",
        originalError,
        context: { field: "email" },
        isRecoverable: true,
      });

      expect(error.message).toBe("Test error");
      expect(error.code).toBe("TEST_001");
      expect(error.category).toBe("validation");
      expect(error.severity).toBe("medium");
      expect(error.originalError).toBe(originalError);
      expect(error.context).toEqual({ field: "email" });
      expect(error.isRecoverable).toBe(true);
      expect(error.timestamp).toBeInstanceOf(Date);
    });

    it("should use defaults for optional properties", () => {
      const error = createAppError({
        message: "Simple error",
      });

      expect(error.message).toBe("Simple error");
      expect(error.category).toBe("unknown");
      expect(error.severity).toBe("medium");
      expect(error.isRecoverable).toBe(true);
    });

    it("should include timestamp", () => {
      const before = new Date();
      const error = createAppError({ message: "Test" });
      const after = new Date();

      expect(error.timestamp.getTime()).toBeGreaterThanOrEqual(
        before.getTime()
      );
      expect(error.timestamp.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });

  describe("getErrorMessage", () => {
    it("should return user-friendly message for network error", () => {
      const error = new Error("Network request failed");
      expect(getErrorMessage(error)).toBe(
        "Unable to connect. Please check your internet connection."
      );
    });

    it("should return user-friendly message for timeout error", () => {
      const error = new Error("Request timeout");
      expect(getErrorMessage(error)).toBe(
        "Request timed out. Please try again."
      );
    });

    it("should return user-friendly message for auth error (401)", () => {
      const error = new Error("401 Unauthorized");
      expect(getErrorMessage(error)).toBe(
        "Your session has expired. Please sign in again."
      );
    });

    it("should return user-friendly message for forbidden error (403)", () => {
      const error = new Error("403 Forbidden");
      expect(getErrorMessage(error)).toBe(
        "You don't have permission to perform this action."
      );
    });

    it("should return user-friendly message for not found error (404)", () => {
      const error = new Error("404 Not Found");
      expect(getErrorMessage(error)).toBe("The requested data was not found.");
    });

    it("should return user-friendly message for rate limit error (429)", () => {
      const error = new Error("429 Too Many Requests");
      expect(getErrorMessage(error)).toBe(
        "Too many requests. Please wait a moment and try again."
      );
    });

    it("should return user-friendly message for server error (500)", () => {
      const error = new Error("500 Internal Server Error");
      expect(getErrorMessage(error)).toBe(
        "Something went wrong on our end. Please try again later."
      );
    });

    it("should return generic message for unknown error", () => {
      const error = new Error("Some unknown error");
      expect(getErrorMessage(error)).toBe(
        "Something went wrong. Please try again."
      );
    });

    it("should handle non-Error objects", () => {
      expect(getErrorMessage("string error")).toBe(
        "Something went wrong. Please try again."
      );
      expect(getErrorMessage(null)).toBe(
        "Something went wrong. Please try again."
      );
      expect(getErrorMessage(undefined)).toBe(
        "Something went wrong. Please try again."
      );
    });
  });

  describe("getErrorCategory", () => {
    it("should categorize network errors", () => {
      expect(getErrorCategory(new Error("Network error"))).toBe("network");
      expect(getErrorCategory(new Error("Failed to fetch"))).toBe("network");
      expect(getErrorCategory(new Error("No internet connection"))).toBe(
        "network"
      );
    });

    it("should categorize auth errors", () => {
      expect(getErrorCategory(new Error("401 Unauthorized"))).toBe("auth");
      expect(getErrorCategory(new Error("403 Forbidden"))).toBe("auth");
      expect(getErrorCategory(new Error("Session expired"))).toBe("auth");
    });

    it("should categorize validation errors", () => {
      expect(getErrorCategory(new Error("Validation failed"))).toBe(
        "validation"
      );
      expect(getErrorCategory(new Error("Invalid input"))).toBe("validation");
    });

    it("should categorize sync errors", () => {
      expect(getErrorCategory(new Error("Sync failed"))).toBe("sync");
      expect(getErrorCategory(new Error("Conflict detected"))).toBe("sync");
    });

    it("should categorize storage errors", () => {
      expect(getErrorCategory(new Error("Storage quota exceeded"))).toBe(
        "storage"
      );
      expect(getErrorCategory(new Error("AsyncStorage error"))).toBe("storage");
    });

    it("should return unknown for unrecognized errors", () => {
      expect(getErrorCategory(new Error("Random error"))).toBe("unknown");
    });
  });

  describe("isNetworkError", () => {
    it("should return true for network errors", () => {
      expect(isNetworkError(new Error("Network error"))).toBe(true);
      expect(isNetworkError(new Error("Failed to fetch"))).toBe(true);
      expect(isNetworkError(new Error("No internet"))).toBe(true);
      expect(isNetworkError(new Error("Connection refused"))).toBe(true);
    });

    it("should return false for non-network errors", () => {
      expect(isNetworkError(new Error("Validation error"))).toBe(false);
      expect(isNetworkError(new Error("401 Unauthorized"))).toBe(false);
    });
  });

  describe("isAuthError", () => {
    it("should return true for auth errors", () => {
      expect(isAuthError(new Error("401 Unauthorized"))).toBe(true);
      expect(isAuthError(new Error("403 Forbidden"))).toBe(true);
      expect(isAuthError(new Error("Session expired"))).toBe(true);
      expect(isAuthError(new Error("Authentication failed"))).toBe(true);
    });

    it("should return false for non-auth errors", () => {
      expect(isAuthError(new Error("Network error"))).toBe(false);
      expect(isAuthError(new Error("404 Not Found"))).toBe(false);
    });
  });

  describe("isRecoverableError", () => {
    it("should return true for recoverable errors", () => {
      expect(isRecoverableError(new Error("Network error"))).toBe(true);
      expect(isRecoverableError(new Error("timeout"))).toBe(true);
      expect(isRecoverableError(new Error("429 Too Many Requests"))).toBe(true);
      expect(isRecoverableError(new Error("503 Service Unavailable"))).toBe(
        true
      );
    });

    it("should return false for non-recoverable errors", () => {
      expect(isRecoverableError(new Error("401 Unauthorized"))).toBe(false);
      expect(isRecoverableError(new Error("403 Forbidden"))).toBe(false);
      expect(isRecoverableError(new Error("404 Not Found"))).toBe(false);
      expect(isRecoverableError(new Error("Validation failed"))).toBe(false);
    });
  });

  describe("calculateBackoffDelay", () => {
    it("should return base delay for first attempt", () => {
      expect(calculateBackoffDelay(0, 1000, 30000)).toBe(1000);
    });

    it("should exponentially increase delay", () => {
      expect(calculateBackoffDelay(1, 1000, 30000)).toBe(2000);
      expect(calculateBackoffDelay(2, 1000, 30000)).toBe(4000);
      expect(calculateBackoffDelay(3, 1000, 30000)).toBe(8000);
    });

    it("should cap delay at max value", () => {
      expect(calculateBackoffDelay(10, 1000, 30000)).toBe(30000);
      expect(calculateBackoffDelay(100, 1000, 30000)).toBe(30000);
    });

    it("should handle custom base and max delays", () => {
      expect(calculateBackoffDelay(0, 500, 5000)).toBe(500);
      expect(calculateBackoffDelay(3, 500, 5000)).toBe(4000);
      expect(calculateBackoffDelay(4, 500, 5000)).toBe(5000);
    });
  });

  describe("shouldRetryError", () => {
    it("should return true for network errors within retry limit", () => {
      expect(shouldRetryError(new Error("Network error"), 0, 3)).toBe(true);
      expect(shouldRetryError(new Error("Network error"), 1, 3)).toBe(true);
      expect(shouldRetryError(new Error("Network error"), 2, 3)).toBe(true);
    });

    it("should return false when retry limit exceeded", () => {
      expect(shouldRetryError(new Error("Network error"), 3, 3)).toBe(false);
      expect(shouldRetryError(new Error("Network error"), 4, 3)).toBe(false);
    });

    it("should return true for timeout errors", () => {
      expect(shouldRetryError(new Error("Request timeout"), 0, 3)).toBe(true);
    });

    it("should return true for 429 and 503 errors", () => {
      expect(shouldRetryError(new Error("429 Too Many Requests"), 0, 3)).toBe(
        true
      );
      expect(
        shouldRetryError(new Error("503 Service Unavailable"), 0, 3)
      ).toBe(true);
    });

    it("should return false for non-recoverable errors", () => {
      expect(shouldRetryError(new Error("401 Unauthorized"), 0, 3)).toBe(false);
      expect(shouldRetryError(new Error("403 Forbidden"), 0, 3)).toBe(false);
      expect(shouldRetryError(new Error("404 Not Found"), 0, 3)).toBe(false);
    });
  });

  describe("sanitizeErrorForReporting", () => {
    it("should remove sensitive data from error context", () => {
      const error = createAppError({
        message: "Test error",
        context: {
          email: "user@example.com",
          password: "secret123",
          token: "jwt-token-here",
          babyName: "Emma",
          userId: "123",
        },
      });

      const sanitized = sanitizeErrorForReporting(error);

      expect(sanitized.context).not.toHaveProperty("email");
      expect(sanitized.context).not.toHaveProperty("password");
      expect(sanitized.context).not.toHaveProperty("token");
      expect(sanitized.context).not.toHaveProperty("babyName");
      expect(sanitized.context).toHaveProperty("userId");
    });

    it("should redact PII from error message", () => {
      const error = createAppError({
        message: "Error for user user@example.com with baby Emma",
      });

      const sanitized = sanitizeErrorForReporting(error);

      expect(sanitized.message).not.toContain("user@example.com");
      expect(sanitized.message).not.toContain("Emma");
    });

    it("should preserve non-sensitive context", () => {
      const error = createAppError({
        message: "Test error",
        context: {
          errorCode: "ERR_001",
          timestamp: "2024-01-01",
          retryCount: 3,
        },
      });

      const sanitized = sanitizeErrorForReporting(error);

      expect(sanitized.context?.errorCode).toBe("ERR_001");
      expect(sanitized.context?.timestamp).toBe("2024-01-01");
      expect(sanitized.context?.retryCount).toBe(3);
    });
  });

  describe("formatErrorForUser", () => {
    it("should format error with title and message", () => {
      const error = createAppError({
        message: "Network error",
        category: "network",
      });

      const formatted = formatErrorForUser(error);

      expect(formatted.title).toBe("Connection Error");
      expect(formatted.message).toBe(
        "Unable to connect. Please check your internet connection."
      );
      expect(formatted.canRetry).toBe(true);
    });

    it("should include retry action for recoverable errors", () => {
      const error = createAppError({
        message: "Network error",
        category: "network",
        isRecoverable: true,
      });

      const formatted = formatErrorForUser(error);
      expect(formatted.canRetry).toBe(true);
    });

    it("should not include retry for non-recoverable errors", () => {
      const error = createAppError({
        message: "Session expired",
        category: "auth",
        isRecoverable: false,
      });

      const formatted = formatErrorForUser(error);
      expect(formatted.canRetry).toBe(false);
    });

    it("should return appropriate title for each category", () => {
      expect(
        formatErrorForUser(createAppError({ message: "x", category: "network" }))
          .title
      ).toBe("Connection Error");
      expect(
        formatErrorForUser(createAppError({ message: "x", category: "auth" }))
          .title
      ).toBe("Authentication Error");
      expect(
        formatErrorForUser(
          createAppError({ message: "x", category: "validation" })
        ).title
      ).toBe("Validation Error");
      expect(
        formatErrorForUser(createAppError({ message: "x", category: "sync" }))
          .title
      ).toBe("Sync Error");
      expect(
        formatErrorForUser(createAppError({ message: "x", category: "storage" }))
          .title
      ).toBe("Storage Error");
      expect(
        formatErrorForUser(createAppError({ message: "x", category: "unknown" }))
          .title
      ).toBe("Error");
    });
  });
});

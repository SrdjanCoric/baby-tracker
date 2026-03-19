import { describe, it, expect } from "vitest";
import {
  validateEmail,
  validatePassword,
  validatePasswordConfirmation,
  validateDisplayName,
  validateSignUp,
  validateSignIn,
  sanitizeAuthError,
} from "./auth";

describe("validateEmail", () => {
  it("should return valid for correct email format", () => {
    const result = validateEmail("test@example.com");
    expect(result.isValid).toBe(true);
    expect(result.normalizedEmail).toBe("test@example.com");
  });

  it("should normalize email to lowercase", () => {
    const result = validateEmail("Test@EXAMPLE.COM");
    expect(result.isValid).toBe(true);
    expect(result.normalizedEmail).toBe("test@example.com");
  });

  it("should trim whitespace from email", () => {
    const result = validateEmail("  test@example.com  ");
    expect(result.isValid).toBe(true);
    expect(result.normalizedEmail).toBe("test@example.com");
  });

  it("should return invalid for empty string", () => {
    const result = validateEmail("");
    expect(result.isValid).toBe(false);
    expect(result.error).toBe("validation.emailRequired");
  });

  it("should return invalid for whitespace only", () => {
    const result = validateEmail("   ");
    expect(result.isValid).toBe(false);
    expect(result.error).toBe("validation.emailRequired");
  });

  it("should return invalid for missing @ symbol", () => {
    const result = validateEmail("testexample.com");
    expect(result.isValid).toBe(false);
    expect(result.error).toBe("validation.emailInvalid");
  });

  it("should return invalid for missing domain", () => {
    const result = validateEmail("test@");
    expect(result.isValid).toBe(false);
    expect(result.error).toBe("validation.emailInvalid");
  });

  it("should return invalid for missing local part", () => {
    const result = validateEmail("@example.com");
    expect(result.isValid).toBe(false);
    expect(result.error).toBe("validation.emailInvalid");
  });

  it("should return invalid for missing TLD", () => {
    const result = validateEmail("test@example");
    expect(result.isValid).toBe(false);
    expect(result.error).toBe("validation.emailInvalid");
  });

  it("should return invalid for null", () => {
    const result = validateEmail(null as unknown as string);
    expect(result.isValid).toBe(false);
    expect(result.error).toBe("validation.emailRequired");
  });

  it("should return invalid for undefined", () => {
    const result = validateEmail(undefined as unknown as string);
    expect(result.isValid).toBe(false);
    expect(result.error).toBe("validation.emailRequired");
  });

  it("should accept email with subdomain", () => {
    const result = validateEmail("test@mail.example.com");
    expect(result.isValid).toBe(true);
  });

  it("should accept email with plus sign", () => {
    const result = validateEmail("test+tag@example.com");
    expect(result.isValid).toBe(true);
  });
});

describe("validatePassword", () => {
  it("should return valid for password meeting all requirements", () => {
    const result = validatePassword("Password1");
    expect(result.isValid).toBe(true);
  });

  it("should return valid for complex password", () => {
    const result = validatePassword("MySecure123");
    expect(result.isValid).toBe(true);
  });

  it("should return invalid for password with 7 characters", () => {
    const result = validatePassword("Pass12");
    expect(result.isValid).toBe(false);
    expect(result.error).toBe("validation.passwordMinLength");
  });

  it("should return invalid for empty password", () => {
    const result = validatePassword("");
    expect(result.isValid).toBe(false);
    expect(result.error).toBe("validation.passwordRequired");
  });

  it("should return invalid for null", () => {
    const result = validatePassword(null as unknown as string);
    expect(result.isValid).toBe(false);
    expect(result.error).toBe("validation.passwordRequired");
  });

  it("should return invalid for undefined", () => {
    const result = validatePassword(undefined as unknown as string);
    expect(result.isValid).toBe(false);
    expect(result.error).toBe("validation.passwordRequired");
  });

  it("should return invalid for password without uppercase", () => {
    const result = validatePassword("password1");
    expect(result.isValid).toBe(false);
    expect(result.error).toBe("validation.passwordUppercase");
  });

  it("should return invalid for password without lowercase", () => {
    const result = validatePassword("PASSWORD1");
    expect(result.isValid).toBe(false);
    expect(result.error).toBe("validation.passwordLowercase");
  });

  it("should return invalid for password without number", () => {
    const result = validatePassword("Password");
    expect(result.isValid).toBe(false);
    expect(result.error).toBe("validation.passwordNumber");
  });

  it("should accept very long passwords with complexity", () => {
    const longPassword = "Aa1" + "a".repeat(97);
    const result = validatePassword(longPassword);
    expect(result.isValid).toBe(true);
  });
});

describe("validatePasswordConfirmation", () => {
  it("should return valid when passwords match", () => {
    const result = validatePasswordConfirmation("Password123", "Password123");
    expect(result.isValid).toBe(true);
  });

  it("should return invalid when passwords do not match", () => {
    const result = validatePasswordConfirmation("Password123", "Password456");
    expect(result.isValid).toBe(false);
    expect(result.error).toBe("validation.passwordsMismatch");
  });

  it("should return invalid for empty confirmation", () => {
    const result = validatePasswordConfirmation("Password123", "");
    expect(result.isValid).toBe(false);
    expect(result.error).toBe("validation.confirmPasswordRequired");
  });

  it("should return invalid for null confirmation", () => {
    const result = validatePasswordConfirmation(
      "Password123",
      null as unknown as string
    );
    expect(result.isValid).toBe(false);
    expect(result.error).toBe("validation.confirmPasswordRequired");
  });

  it("should be case sensitive", () => {
    const result = validatePasswordConfirmation("Password123", "password123");
    expect(result.isValid).toBe(false);
    expect(result.error).toBe("validation.passwordsMismatch");
  });
});

describe("validateDisplayName", () => {
  it("should return valid for name with 2+ characters", () => {
    const result = validateDisplayName("Jo");
    expect(result.isValid).toBe(true);
  });

  it("should return valid for typical name", () => {
    const result = validateDisplayName("John Doe");
    expect(result.isValid).toBe(true);
  });

  it("should return invalid for single character", () => {
    const result = validateDisplayName("J");
    expect(result.isValid).toBe(false);
    expect(result.error).toBe("validation.displayNameMinLength");
  });

  it("should return invalid for empty string", () => {
    const result = validateDisplayName("");
    expect(result.isValid).toBe(false);
    expect(result.error).toBe("validation.displayNameRequired");
  });

  it("should return invalid for whitespace only", () => {
    const result = validateDisplayName("   ");
    expect(result.isValid).toBe(false);
    expect(result.error).toBe("validation.displayNameRequired");
  });

  it("should return invalid for name over 50 characters", () => {
    const longName = "a".repeat(51);
    const result = validateDisplayName(longName);
    expect(result.isValid).toBe(false);
    expect(result.error).toBe("validation.displayNameMaxLength");
  });

  it("should return valid for exactly 50 characters", () => {
    const name = "a".repeat(50);
    const result = validateDisplayName(name);
    expect(result.isValid).toBe(true);
  });

  it("should return invalid for null", () => {
    const result = validateDisplayName(null as unknown as string);
    expect(result.isValid).toBe(false);
    expect(result.error).toBe("validation.displayNameRequired");
  });
});

describe("validateSignUp", () => {
  it("should return valid for correct input", () => {
    const result = validateSignUp({
      email: "test@example.com",
      password: "Password123",
      confirmPassword: "Password123",
    });
    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual({});
    expect(result.normalizedEmail).toBe("test@example.com");
  });

  it("should return valid with optional display name", () => {
    const result = validateSignUp({
      email: "test@example.com",
      password: "Password123",
      confirmPassword: "Password123",
      displayName: "John",
    });
    expect(result.isValid).toBe(true);
  });

  it("should return all errors for completely invalid input", () => {
    const result = validateSignUp({
      email: "",
      password: "short",
      confirmPassword: "different",
      displayName: "J",
    });
    expect(result.isValid).toBe(false);
    expect(result.errors.email).toBe("validation.emailRequired");
    expect(result.errors.password).toBe("validation.passwordMinLength");
    expect(result.errors.confirmPassword).toBe("validation.passwordsMismatch");
    expect(result.errors.displayName).toBe(
      "validation.displayNameMinLength"
    );
  });

  it("should return email error for invalid email", () => {
    const result = validateSignUp({
      email: "invalid",
      password: "Password123",
      confirmPassword: "Password123",
    });
    expect(result.isValid).toBe(false);
    expect(result.errors.email).toBe("validation.emailInvalid");
  });

  it("should return password error for short password", () => {
    const result = validateSignUp({
      email: "test@example.com",
      password: "short",
      confirmPassword: "short",
    });
    expect(result.isValid).toBe(false);
    expect(result.errors.password).toBe("validation.passwordMinLength");
  });

  it("should return confirmation error for mismatched passwords", () => {
    const result = validateSignUp({
      email: "test@example.com",
      password: "Password123",
      confirmPassword: "Password456",
    });
    expect(result.isValid).toBe(false);
    expect(result.errors.confirmPassword).toBe("validation.passwordsMismatch");
  });

  it("should not validate display name if not provided", () => {
    const result = validateSignUp({
      email: "test@example.com",
      password: "Password123",
      confirmPassword: "Password123",
    });
    expect(result.isValid).toBe(true);
    expect(result.errors.displayName).toBeUndefined();
  });

  it("should return error for password without complexity", () => {
    const result = validateSignUp({
      email: "test@example.com",
      password: "password",
      confirmPassword: "password",
    });
    expect(result.isValid).toBe(false);
    expect(result.errors.password).toBe("validation.passwordUppercase");
  });
});

describe("Security Payloads", () => {
  describe("SQL Injection in email", () => {
    it("should reject SQL injection with OR", () => {
      const result = validateEmail("' OR '1'='1");
      expect(result.isValid).toBe(false);
      expect(result.error).toBe("validation.emailInvalid");
    });

    it("should reject SQL injection with UNION", () => {
      const result = validateEmail("admin@test.com' UNION SELECT * FROM users--");
      expect(result.isValid).toBe(false);
      expect(result.error).toBe("validation.emailInvalid");
    });

    it("should reject SQL injection with DROP", () => {
      const result = validateEmail("test'; DROP TABLE users;--@example.com");
      expect(result.isValid).toBe(false);
      expect(result.error).toBe("validation.emailInvalid");
    });
  });

  describe("SQL Injection in displayName", () => {
    it("should accept and not execute SQL in display name", () => {
      const result = validateDisplayName("Robert'); DROP TABLE users;--");
      expect(result.isValid).toBe(true);
    });
  });

  describe("XSS in email", () => {
    it("should reject XSS script tag in email", () => {
      const result = validateEmail("<script>alert('xss')</script>@test.com");
      expect(result.isValid).toBe(false);
      expect(result.error).toBe("validation.emailInvalid");
    });

    it("should reject XSS with event handler", () => {
      const result = validateEmail("test@<img onerror=alert('xss')>.com");
      expect(result.isValid).toBe(false);
      expect(result.error).toBe("validation.emailInvalid");
    });
  });

  describe("XSS in displayName", () => {
    it("should accept display name with HTML (sanitization handled at render)", () => {
      const result = validateDisplayName("<script>alert('xss')</script>");
      expect(result.isValid).toBe(true);
    });

    it("should accept display name with event handler (sanitization handled at render)", () => {
      const result = validateDisplayName("<img onerror=alert('xss')>");
      expect(result.isValid).toBe(true);
    });
  });

  describe("XSS in password", () => {
    it("should accept password with XSS payload if it meets complexity", () => {
      const result = validatePassword("<Script>Alert1</Script>");
      expect(result.isValid).toBe(true);
    });
  });

  describe("Unicode normalization attacks", () => {
    it("should handle unicode in email", () => {
      const result = validateEmail("test\u0000@example.com");
      expect(result.isValid).toBe(false);
    });

    it("should reject homograph characters in email", () => {
      const result = validateEmail("аdmin@example.com");
      expect(result.isValid).toBe(false);
      expect(result.error).toBe("validation.emailInvalid");
    });
  });
});

describe("validateSignIn", () => {
  it("should return valid for correct input", () => {
    const result = validateSignIn({
      email: "test@example.com",
      password: "Password123",
    });
    expect(result.isValid).toBe(true);
    expect(result.errors).toEqual({});
    expect(result.normalizedEmail).toBe("test@example.com");
  });

  it("should return email error for invalid email", () => {
    const result = validateSignIn({
      email: "invalid",
      password: "Password123",
    });
    expect(result.isValid).toBe(false);
    expect(result.errors.email).toBe("validation.emailInvalid");
  });

  it("should return password error for empty password", () => {
    const result = validateSignIn({
      email: "test@example.com",
      password: "",
    });
    expect(result.isValid).toBe(false);
    expect(result.errors.password).toBe("validation.passwordRequired");
  });

  it("should return both errors for invalid email and empty password", () => {
    const result = validateSignIn({
      email: "",
      password: "",
    });
    expect(result.isValid).toBe(false);
    expect(result.errors.email).toBe("validation.emailRequired");
    expect(result.errors.password).toBe("validation.passwordRequired");
  });

  it("should not validate password complexity for sign in", () => {
    const result = validateSignIn({
      email: "test@example.com",
      password: "short",
    });
    expect(result.isValid).toBe(true);
  });

  it("should normalize email on sign in", () => {
    const result = validateSignIn({
      email: "  TEST@EXAMPLE.COM  ",
      password: "password",
    });
    expect(result.normalizedEmail).toBe("test@example.com");
  });
});

describe("sanitizeAuthError", () => {
  it("should return fallback key for null error", () => {
    const result = sanitizeAuthError(null, "auth.signInError");
    expect(result).toBe("auth.signInError");
  });

  it("should detect invalid credentials error", () => {
    const error = new Error("Invalid login credentials");
    const result = sanitizeAuthError(error, "auth.signInError");
    expect(result).toBe("auth.invalidCredentials");
  });

  it("should detect email not confirmed error", () => {
    const error = new Error("Email not confirmed");
    const result = sanitizeAuthError(error, "auth.signInError");
    expect(result).toBe("auth.emailNotConfirmed");
  });

  it("should detect rate limit error", () => {
    const error = new Error("Too many requests");
    const result = sanitizeAuthError(error, "auth.signInError");
    expect(result).toBe("auth.tooManyAttempts");
  });

  it("should detect email already exists error", () => {
    const error = new Error("User already registered");
    const result = sanitizeAuthError(error, "auth.signUpError");
    expect(result).toBe("auth.emailAlreadyExists");
  });

  it("should detect provider not enabled error", () => {
    const error = new Error("Provider is not enabled");
    const result = sanitizeAuthError(error, "auth.googleSignInError");
    expect(result).toBe("auth.providerNotEnabled");
  });

  it("should detect provider not supported error", () => {
    const error = new Error("Provider is not supported");
    const result = sanitizeAuthError(error, "auth.googleSignInError");
    expect(result).toBe("auth.providerNotSupported");
  });

  it("should detect code 400 as provider not supported", () => {
    const error = new Error("code 400 provider error");
    const result = sanitizeAuthError(error, "auth.googleSignInError");
    expect(result).toBe("auth.providerNotSupported");
  });

  it("should detect popup closed error", () => {
    const error = new Error("Popup was closed by user");
    const result = sanitizeAuthError(error, "auth.googleSignInError");
    expect(result).toBe("auth.popupClosed");
  });

  it("should detect oauth error", () => {
    const error = new Error("OAuth callback failed");
    const result = sanitizeAuthError(error, "auth.googleSignInError");
    expect(result).toBe("auth.oauthError");
  });

  it("should detect network error", () => {
    const error = new Error("Network request failed");
    const result = sanitizeAuthError(error, "auth.signInError");
    expect(result).toBe("errors.network");
  });

  it("should detect fetch error as network error", () => {
    const error = new Error("fetch failed");
    const result = sanitizeAuthError(error, "auth.signInError");
    expect(result).toBe("errors.network");
  });

  it("should detect timeout as network error", () => {
    const error = new Error("Request timeout");
    const result = sanitizeAuthError(error, "auth.signInError");
    expect(result).toBe("errors.network");
  });

  it("should return fallback for unknown error", () => {
    const error = new Error("Some unknown error");
    const result = sanitizeAuthError(error, "auth.signInError");
    expect(result).toBe("auth.signInError");
  });
});

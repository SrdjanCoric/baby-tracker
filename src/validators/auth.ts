export interface AuthValidationResult {
  isValid: boolean;
  error?: string;
}

export interface EmailValidationResult extends AuthValidationResult {
  normalizedEmail?: string;
}

const EMAIL_REGEX = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/;
const MIN_PASSWORD_LENGTH = 8;
const PASSWORD_HAS_UPPERCASE = /[A-Z]/;
const PASSWORD_HAS_LOWERCASE = /[a-z]/;
const PASSWORD_HAS_NUMBER = /[0-9]/;

export function validateEmail(email: string): EmailValidationResult {
  if (!email || typeof email !== "string") {
    return { isValid: false, error: "Email is required" };
  }

  const trimmed = email.trim();

  if (trimmed.length === 0) {
    return { isValid: false, error: "Email is required" };
  }

  if (!EMAIL_REGEX.test(trimmed)) {
    return { isValid: false, error: "Invalid email format" };
  }

  const normalizedEmail = trimmed.toLowerCase();

  return { isValid: true, normalizedEmail };
}

export function validatePassword(password: string): AuthValidationResult {
  if (!password || typeof password !== "string") {
    return { isValid: false, error: "Password is required" };
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    return {
      isValid: false,
      error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
    };
  }

  if (!PASSWORD_HAS_UPPERCASE.test(password)) {
    return {
      isValid: false,
      error: "Password must contain at least one uppercase letter",
    };
  }

  if (!PASSWORD_HAS_LOWERCASE.test(password)) {
    return {
      isValid: false,
      error: "Password must contain at least one lowercase letter",
    };
  }

  if (!PASSWORD_HAS_NUMBER.test(password)) {
    return {
      isValid: false,
      error: "Password must contain at least one number",
    };
  }

  return { isValid: true };
}

export function validatePasswordConfirmation(
  password: string,
  confirmPassword: string
): AuthValidationResult {
  if (!confirmPassword || typeof confirmPassword !== "string") {
    return { isValid: false, error: "Please confirm your password" };
  }

  if (password !== confirmPassword) {
    return { isValid: false, error: "Passwords do not match" };
  }

  return { isValid: true };
}

export function validateDisplayName(name: string): AuthValidationResult {
  if (!name || typeof name !== "string") {
    return { isValid: false, error: "Display name is required" };
  }

  const trimmed = name.trim();

  if (trimmed.length === 0) {
    return { isValid: false, error: "Display name is required" };
  }

  if (trimmed.length < 2) {
    return { isValid: false, error: "Display name must be at least 2 characters" };
  }

  if (trimmed.length > 50) {
    return { isValid: false, error: "Display name must be less than 50 characters" };
  }

  return { isValid: true };
}

export interface SignUpInput {
  email: string;
  password: string;
  confirmPassword: string;
  displayName?: string;
}

export interface SignUpValidationResult {
  isValid: boolean;
  errors: {
    email?: string;
    password?: string;
    confirmPassword?: string;
    displayName?: string;
  };
  normalizedEmail?: string;
}

export function validateSignUp(input: SignUpInput): SignUpValidationResult {
  const errors: SignUpValidationResult["errors"] = {};

  const emailResult = validateEmail(input.email);
  if (!emailResult.isValid) {
    errors.email = emailResult.error;
  }

  const passwordResult = validatePassword(input.password);
  if (!passwordResult.isValid) {
    errors.password = passwordResult.error;
  }

  const confirmResult = validatePasswordConfirmation(
    input.password,
    input.confirmPassword
  );
  if (!confirmResult.isValid) {
    errors.confirmPassword = confirmResult.error;
  }

  if (input.displayName !== undefined) {
    const nameResult = validateDisplayName(input.displayName);
    if (!nameResult.isValid) {
      errors.displayName = nameResult.error;
    }
  }

  const isValid = Object.keys(errors).length === 0;

  return {
    isValid,
    errors,
    normalizedEmail: emailResult.normalizedEmail,
  };
}

export interface SignInInput {
  email: string;
  password: string;
}

export interface SignInValidationResult {
  isValid: boolean;
  errors: {
    email?: string;
    password?: string;
  };
  normalizedEmail?: string;
}

export function sanitizeAuthError(error: Error | null, fallbackKey: string): string {
  if (!error) return fallbackKey;

  const message = error.message?.toLowerCase() ?? "";

  if (message.includes("invalid login credentials") || message.includes("invalid credentials")) {
    return "auth.invalidCredentials";
  }
  if (message.includes("email not confirmed")) {
    return "auth.emailNotConfirmed";
  }
  if (message.includes("too many requests") || message.includes("rate limit")) {
    return "auth.tooManyAttempts";
  }
  if (message.includes("user already registered") || message.includes("already exists")) {
    return "auth.emailAlreadyExists";
  }
  if (message.includes("network") || message.includes("fetch")) {
    return "errors.network";
  }

  return fallbackKey;
}

export function validateSignIn(input: SignInInput): SignInValidationResult {
  const errors: SignInValidationResult["errors"] = {};

  const emailResult = validateEmail(input.email);
  if (!emailResult.isValid) {
    errors.email = emailResult.error;
  }

  if (!input.password || input.password.length === 0) {
    errors.password = "Password is required";
  }

  const isValid = Object.keys(errors).length === 0;

  return {
    isValid,
    errors,
    normalizedEmail: emailResult.normalizedEmail,
  };
}

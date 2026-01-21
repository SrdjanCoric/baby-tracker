export const INVITE_CODE_LENGTH = 8;

export const VALID_CHARACTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

const AMBIGUOUS_CHARACTERS = /[0OlI1\s]/;

export interface InviteCodeValidationResult {
  isValid: boolean;
  error?: string;
}

export function generateInviteCode(): string {
  const randomValues = new Uint8Array(INVITE_CODE_LENGTH);
  crypto.getRandomValues(randomValues);

  let result = "";
  for (let i = 0; i < INVITE_CODE_LENGTH; i++) {
    const randomIndex = randomValues[i] % VALID_CHARACTERS.length;
    result += VALID_CHARACTERS[randomIndex];
  }
  return result;
}

export function validateInviteCode(code: string): InviteCodeValidationResult {
  if (!code || code.trim() === "") {
    return { isValid: false, error: "inviteCodeRequired" };
  }

  if (AMBIGUOUS_CHARACTERS.test(code)) {
    return { isValid: false, error: "inviteCodeInvalidChars" };
  }

  const normalized = normalizeInviteCode(code);

  if (normalized.length !== INVITE_CODE_LENGTH) {
    return { isValid: false, error: "inviteCodeLength" };
  }

  for (const char of normalized) {
    if (!VALID_CHARACTERS.includes(char)) {
      return { isValid: false, error: "inviteCodeInvalidChars" };
    }
  }

  return { isValid: true };
}

export function normalizeInviteCode(code: string): string {
  return code
    .toUpperCase()
    .replace(/[\s-]/g, "");
}

export function formatInviteCodeForDisplay(code: string): string {
  if (!code) return "";

  const normalized = normalizeInviteCode(code);

  if (normalized.length <= 4) {
    return normalized;
  }

  return `${normalized.slice(0, 4)}-${normalized.slice(4)}`;
}

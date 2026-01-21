import { describe, it, expect } from "vitest";
import {
  generateInviteCode,
  validateInviteCode,
  normalizeInviteCode,
  formatInviteCodeForDisplay,
  INVITE_CODE_LENGTH,
  VALID_CHARACTERS,
} from "./inviteCode";

describe("Invite code utilities", () => {
  describe("INVITE_CODE_LENGTH", () => {
    it("should be 8 characters", () => {
      expect(INVITE_CODE_LENGTH).toBe(8);
    });
  });

  describe("VALID_CHARACTERS", () => {
    it("should exclude ambiguous characters (0, O, l, 1, I)", () => {
      expect(VALID_CHARACTERS).not.toContain("0");
      expect(VALID_CHARACTERS).not.toContain("O");
      expect(VALID_CHARACTERS).not.toContain("l");
      expect(VALID_CHARACTERS).not.toContain("1");
      expect(VALID_CHARACTERS).not.toContain("I");
    });

    it("should contain uppercase letters and numbers", () => {
      expect(VALID_CHARACTERS).toContain("A");
      expect(VALID_CHARACTERS).toContain("B");
      expect(VALID_CHARACTERS).toContain("Z");
      expect(VALID_CHARACTERS).toContain("2");
      expect(VALID_CHARACTERS).toContain("9");
    });
  });

  describe("generateInviteCode", () => {
    it("should generate an 8-character alphanumeric code", () => {
      const code = generateInviteCode();
      expect(code).toHaveLength(8);
    });

    it("should only use valid characters", () => {
      const code = generateInviteCode();
      for (const char of code) {
        expect(VALID_CHARACTERS).toContain(char);
      }
    });

    it("should generate unique codes on multiple calls", () => {
      const codes = new Set<string>();
      for (let i = 0; i < 100; i++) {
        codes.add(generateInviteCode());
      }
      expect(codes.size).toBeGreaterThan(95);
    });

    it("should not contain ambiguous characters", () => {
      for (let i = 0; i < 100; i++) {
        const code = generateInviteCode();
        expect(code).not.toMatch(/[0OlI1]/);
      }
    });
  });

  describe("validateInviteCode", () => {
    it("should return valid for correct 8-character code", () => {
      const result = validateInviteCode("ABCD2345");
      expect(result.isValid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it("should return invalid for empty code", () => {
      const result = validateInviteCode("");
      expect(result.isValid).toBe(false);
      expect(result.error).toBe("inviteCodeRequired");
    });

    it("should return invalid for code that is too short", () => {
      const result = validateInviteCode("ABC234");
      expect(result.isValid).toBe(false);
      expect(result.error).toBe("inviteCodeLength");
    });

    it("should return invalid for code that is too long", () => {
      const result = validateInviteCode("ABCD234567");
      expect(result.isValid).toBe(false);
      expect(result.error).toBe("inviteCodeLength");
    });

    it("should return invalid for code with invalid characters", () => {
      const result = validateInviteCode("ABCD234!");
      expect(result.isValid).toBe(false);
      expect(result.error).toBe("inviteCodeInvalidChars");
    });

    it("should be case-insensitive (accept lowercase)", () => {
      const result = validateInviteCode("abcd2345");
      expect(result.isValid).toBe(true);
    });

    it("should be case-insensitive (accept mixed case)", () => {
      const result = validateInviteCode("AbCd2345");
      expect(result.isValid).toBe(true);
    });

    it("should reject codes with spaces", () => {
      const result = validateInviteCode("ABCD 234");
      expect(result.isValid).toBe(false);
      expect(result.error).toBe("inviteCodeInvalidChars");
    });

    it("should reject codes with ambiguous characters (0)", () => {
      const result = validateInviteCode("ABCD0234");
      expect(result.isValid).toBe(false);
      expect(result.error).toBe("inviteCodeInvalidChars");
    });

    it("should reject codes with ambiguous characters (O)", () => {
      const result = validateInviteCode("ABCDO234");
      expect(result.isValid).toBe(false);
      expect(result.error).toBe("inviteCodeInvalidChars");
    });

    it("should reject codes with ambiguous characters (1)", () => {
      const result = validateInviteCode("ABCD1234");
      expect(result.isValid).toBe(false);
      expect(result.error).toBe("inviteCodeInvalidChars");
    });

    it("should reject codes with ambiguous characters (l)", () => {
      const result = validateInviteCode("ABCDl234");
      expect(result.isValid).toBe(false);
      expect(result.error).toBe("inviteCodeInvalidChars");
    });

    it("should reject codes with ambiguous characters (I)", () => {
      const result = validateInviteCode("ABCDI234");
      expect(result.isValid).toBe(false);
      expect(result.error).toBe("inviteCodeInvalidChars");
    });
  });

  describe("normalizeInviteCode", () => {
    it("should convert lowercase to uppercase", () => {
      expect(normalizeInviteCode("abcd2345")).toBe("ABCD2345");
    });

    it("should handle mixed case", () => {
      expect(normalizeInviteCode("AbCd2345")).toBe("ABCD2345");
    });

    it("should remove whitespace", () => {
      expect(normalizeInviteCode("ABCD 2345")).toBe("ABCD2345");
      expect(normalizeInviteCode(" ABCD2345 ")).toBe("ABCD2345");
      expect(normalizeInviteCode("AB CD 23 45")).toBe("ABCD2345");
    });

    it("should remove dashes", () => {
      expect(normalizeInviteCode("ABCD-2345")).toBe("ABCD2345");
    });

    it("should handle empty string", () => {
      expect(normalizeInviteCode("")).toBe("");
    });
  });

  describe("formatInviteCodeForDisplay", () => {
    it("should format code with dash in the middle", () => {
      expect(formatInviteCodeForDisplay("ABCD2345")).toBe("ABCD-2345");
    });

    it("should handle already formatted code", () => {
      expect(formatInviteCodeForDisplay("ABCD-2345")).toBe("ABCD-2345");
    });

    it("should handle lowercase input", () => {
      expect(formatInviteCodeForDisplay("abcd2345")).toBe("ABCD-2345");
    });

    it("should handle empty string", () => {
      expect(formatInviteCodeForDisplay("")).toBe("");
    });

    it("should handle short codes gracefully", () => {
      expect(formatInviteCodeForDisplay("ABC")).toBe("ABC");
    });
  });
});

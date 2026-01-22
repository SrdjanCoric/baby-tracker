import { describe, it, expect } from "vitest";
import {
  validateDeletionConfirmation,
  CONFIRMATION_TEXT,
  calculateTotalRecords,
} from "./account-deletion";
import type { DeletionPreview } from "@/types/account-deletion";

describe("Account Deletion Utilities", () => {
  describe("CONFIRMATION_TEXT", () => {
    it("should be 'DELETE'", () => {
      expect(CONFIRMATION_TEXT).toBe("DELETE");
    });
  });

  describe("validateDeletionConfirmation", () => {
    it("should return true for exact match 'DELETE'", () => {
      expect(validateDeletionConfirmation("DELETE")).toBe(true);
    });

    it("should return false for partial match", () => {
      expect(validateDeletionConfirmation("DEL")).toBe(false);
      expect(validateDeletionConfirmation("DELET")).toBe(false);
      expect(validateDeletionConfirmation("DELETE1")).toBe(false);
    });

    it("should be case-sensitive - reject lowercase", () => {
      expect(validateDeletionConfirmation("delete")).toBe(false);
      expect(validateDeletionConfirmation("Delete")).toBe(false);
      expect(validateDeletionConfirmation("DeLeTe")).toBe(false);
    });

    it("should trim whitespace from input", () => {
      expect(validateDeletionConfirmation(" DELETE ")).toBe(true);
      expect(validateDeletionConfirmation("  DELETE")).toBe(true);
      expect(validateDeletionConfirmation("DELETE  ")).toBe(true);
    });

    it("should return false for empty string", () => {
      expect(validateDeletionConfirmation("")).toBe(false);
    });

    it("should return false for whitespace only", () => {
      expect(validateDeletionConfirmation("   ")).toBe(false);
    });

    it("should return false for similar words", () => {
      expect(validateDeletionConfirmation("REMOVE")).toBe(false);
      expect(validateDeletionConfirmation("ERASE")).toBe(false);
      expect(validateDeletionConfirmation("CONFIRM")).toBe(false);
    });

    it("should not accept DELETE with extra characters", () => {
      expect(validateDeletionConfirmation("DELETE!")).toBe(false);
      expect(validateDeletionConfirmation("DELETEME")).toBe(false);
      expect(validateDeletionConfirmation("MYDELETE")).toBe(false);
    });
  });

  describe("calculateTotalRecords", () => {
    const mockPreview: DeletionPreview = {
      feedings: 10,
      sleep: 5,
      diapers: 20,
      pumping: 3,
      growth: 2,
      tummyTime: 8,
      babies: [],
      householdWillBeDeleted: false,
      hasOtherCaregivers: false,
    };

    it("should calculate total records correctly", () => {
      const total = calculateTotalRecords(mockPreview);
      expect(total).toBe(48); // 10 + 5 + 20 + 3 + 2 + 8
    });

    it("should return 0 for empty preview", () => {
      const emptyPreview: DeletionPreview = {
        feedings: 0,
        sleep: 0,
        diapers: 0,
        pumping: 0,
        growth: 0,
        tummyTime: 0,
        babies: [],
        householdWillBeDeleted: false,
        hasOtherCaregivers: false,
      };
      expect(calculateTotalRecords(emptyPreview)).toBe(0);
    });

    it("should handle single data type", () => {
      const singleTypePreview: DeletionPreview = {
        feedings: 100,
        sleep: 0,
        diapers: 0,
        pumping: 0,
        growth: 0,
        tummyTime: 0,
        babies: [],
        householdWillBeDeleted: false,
        hasOtherCaregivers: false,
      };
      expect(calculateTotalRecords(singleTypePreview)).toBe(100);
    });

    it("should handle large numbers", () => {
      const largePreview: DeletionPreview = {
        feedings: 10000,
        sleep: 5000,
        diapers: 15000,
        pumping: 2000,
        growth: 100,
        tummyTime: 3000,
        babies: [],
        householdWillBeDeleted: false,
        hasOtherCaregivers: false,
      };
      expect(calculateTotalRecords(largePreview)).toBe(35100);
    });
  });
});

import { describe, it, expect } from "vitest";
import { sanitizeHtml, sanitizeName, sanitizeCSVValue } from "./sanitize";

describe("sanitize utilities", () => {
  describe("sanitizeHtml", () => {
    it("should return empty string for empty input", () => {
      expect(sanitizeHtml("")).toBe("");
    });

    it("should return empty string for null/undefined input", () => {
      expect(sanitizeHtml(null as unknown as string)).toBe("");
      expect(sanitizeHtml(undefined as unknown as string)).toBe("");
    });

    it("should pass through normal text unchanged", () => {
      expect(sanitizeHtml("John")).toBe("John");
      expect(sanitizeHtml("Mary Jane")).toBe("Mary Jane");
      expect(sanitizeHtml("José García")).toBe("José García");
    });

    it("should remove basic HTML tags", () => {
      expect(sanitizeHtml("<b>Bold</b>")).toBe("Bold");
      expect(sanitizeHtml("<i>Italic</i>")).toBe("Italic");
      expect(sanitizeHtml("<div>Div content</div>")).toBe("Div content");
    });

    it("should remove nested HTML tags", () => {
      expect(sanitizeHtml("<div><span>Nested</span></div>")).toBe("Nested");
    });

    it("should remove script tags and content", () => {
      expect(sanitizeHtml("<script>alert('xss')</script>")).toBe("");
      expect(sanitizeHtml("Hello<script>evil()</script>World")).toBe(
        "HelloWorld"
      );
    });

    it("should remove javascript: protocols", () => {
      expect(sanitizeHtml("javascript:alert('xss')")).toBe("alert('xss')");
    });

    it("should remove event handlers", () => {
      expect(sanitizeHtml("onclick=evil()")).toBe("evil()");
      expect(sanitizeHtml("onerror=hack()")).toBe("hack()");
    });

    it("should handle HTML entities", () => {
      expect(sanitizeHtml("&lt;script&gt;")).toBe("<script>");
      expect(sanitizeHtml("&amp;")).toBe("&");
    });

    it("should trim whitespace", () => {
      expect(sanitizeHtml("  hello  ")).toBe("hello");
    });
  });

  describe("sanitizeName", () => {
    it("should sanitize HTML from name", () => {
      expect(sanitizeName("<b>John</b>")).toBe("John");
    });

    it("should truncate long names to default max length", () => {
      const longName = "a".repeat(150);
      expect(sanitizeName(longName)).toHaveLength(100);
    });

    it("should truncate to custom max length", () => {
      const longName = "a".repeat(50);
      expect(sanitizeName(longName, 30)).toHaveLength(30);
    });

    it("should trim whitespace", () => {
      expect(sanitizeName("  John  ")).toBe("John");
    });

    it("should handle normal names correctly", () => {
      expect(sanitizeName("Emma")).toBe("Emma");
      expect(sanitizeName("María José")).toBe("María José");
      expect(sanitizeName("李明")).toBe("李明");
    });

    it("should handle empty input", () => {
      expect(sanitizeName("")).toBe("");
    });
  });

  describe("sanitizeCSVValue", () => {
    it("should return empty string for empty input", () => {
      expect(sanitizeCSVValue("")).toBe("");
    });

    it("should return empty string for null/undefined", () => {
      expect(sanitizeCSVValue(null as unknown as string)).toBe("");
      expect(sanitizeCSVValue(undefined as unknown as string)).toBe("");
    });

    it("should pass through normal text unchanged", () => {
      expect(sanitizeCSVValue("Hello World")).toBe("Hello World");
      expect(sanitizeCSVValue("Baby ate well")).toBe("Baby ate well");
    });

    it("should prefix values starting with = to prevent formula injection", () => {
      expect(sanitizeCSVValue("=SUM(A1:A10)")).toBe("'=SUM(A1:A10)");
      expect(sanitizeCSVValue("=cmd|'/C calc'!A0")).toBe("'=cmd|'/C calc'!A0");
    });

    it("should prefix values starting with + to prevent formula injection", () => {
      expect(sanitizeCSVValue("+1234567890")).toBe("'+1234567890");
    });

    it("should prefix values starting with - to prevent formula injection", () => {
      expect(sanitizeCSVValue("-5+2")).toBe("'-5+2");
    });

    it("should prefix values starting with @ to prevent formula injection", () => {
      expect(sanitizeCSVValue("@SUM(A1)")).toBe("'@SUM(A1)");
    });

    it("should prefix values starting with | to prevent formula injection", () => {
      expect(sanitizeCSVValue("|cmd")).toBe("'|cmd");
    });

    it("should not prefix values starting with formula chars if not at beginning", () => {
      expect(sanitizeCSVValue("Value = 5")).toBe("Value = 5");
      expect(sanitizeCSVValue("A+B")).toBe("A+B");
    });

    it("should trim whitespace before checking for formula characters", () => {
      expect(sanitizeCSVValue("  =SUM(A1)")).toBe("'=SUM(A1)");
    });

    it("should handle unicode characters", () => {
      expect(sanitizeCSVValue("Bebé comió bien")).toBe("Bebé comió bien");
    });
  });
});

import { describe, it, expect } from "vitest";

describe("Testing infrastructure", () => {
  it("should run vitest tests", () => {
    expect(1 + 1).toBe(2);
  });

  it("should handle string operations", () => {
    const greeting = "Hello, Baby Tracker!";
    expect(greeting).toContain("Baby");
  });
});

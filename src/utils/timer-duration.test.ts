import { describe, expect, it } from "vitest";
import { shouldDiscardTimerDuration } from "./timer-duration";

describe("shouldDiscardTimerDuration", () => {
  it("keeps the production 60-second minimum", () => {
    expect(shouldDiscardTimerDuration(59)).toBe(true);
    expect(shouldDiscardTimerDuration(60)).toBe(false);
  });

  it("allows immediate completion only for the generated E2E minimum", () => {
    expect(shouldDiscardTimerDuration(0, "0")).toBe(false);
    expect(shouldDiscardTimerDuration(0, "true")).toBe(true);
  });
});

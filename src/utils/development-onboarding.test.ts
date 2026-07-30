import { describe, expect, it } from "vitest";
import { canRenderDevelopmentOnboardingTools } from "./development-onboarding";

describe("development onboarding tools gate", () => {
  it("is disabled in production builds", () => {
    expect(canRenderDevelopmentOnboardingTools(true)).toBe(true);
    expect(canRenderDevelopmentOnboardingTools(false)).toBe(false);
  });
});

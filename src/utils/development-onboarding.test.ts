import { describe, expect, it } from "vitest";
import { canLaunchNewOwnerOnboardingPreview } from "./development-onboarding";

describe("canLaunchNewOwnerOnboardingPreview", () => {
  it("requires both a development build and the explicit launch argument", () => {
    expect(canLaunchNewOwnerOnboardingPreview(true, true)).toBe(true);
    expect(canLaunchNewOwnerOnboardingPreview(true, "true")).toBe(true);
    expect(canLaunchNewOwnerOnboardingPreview(true, false)).toBe(false);
    expect(canLaunchNewOwnerOnboardingPreview(false, true)).toBe(false);
  });
});

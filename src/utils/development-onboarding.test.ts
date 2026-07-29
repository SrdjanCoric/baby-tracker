import { describe, expect, it } from "vitest";
import {
  canLaunchNewOwnerOnboardingPreview,
  canRenderDevelopmentOnboardingTools,
  canUseRoleBasedDevelopmentOnboarding,
  enableDevelopmentOnboardingReplay,
  isDevelopmentOnboardingReplayEnabled,
  resetDevelopmentOnboardingReplay,
} from "./development-onboarding";

describe("canLaunchNewOwnerOnboardingPreview", () => {
  it("requires both a development build and the explicit launch argument", () => {
    expect(canLaunchNewOwnerOnboardingPreview(true, true)).toBe(true);
    expect(canLaunchNewOwnerOnboardingPreview(true, "true")).toBe(true);
    expect(canLaunchNewOwnerOnboardingPreview(true, false)).toBe(false);
    expect(canLaunchNewOwnerOnboardingPreview(false, true)).toBe(false);
  });
});

describe("development tools gate", () => {
  it("is disabled in production builds", () => {
    expect(canRenderDevelopmentOnboardingTools(true)).toBe(true);
    expect(canRenderDevelopmentOnboardingTools(false)).toBe(false);
  });

  it("enables role-based routing for either launch preview or session replay in development", () => {
    expect(canUseRoleBasedDevelopmentOnboarding(true, true, false)).toBe(true);
    expect(canUseRoleBasedDevelopmentOnboarding(true, undefined, true)).toBe(true);
    expect(canUseRoleBasedDevelopmentOnboarding(true, undefined, false)).toBe(false);
    expect(canUseRoleBasedDevelopmentOnboarding(false, true, true)).toBe(false);
  });
});

describe("development onboarding replay", () => {
  it("can be enabled only for the current development session", () => {
    resetDevelopmentOnboardingReplay();

    expect(enableDevelopmentOnboardingReplay(false)).toBe(false);
    expect(isDevelopmentOnboardingReplayEnabled(true)).toBe(false);

    expect(enableDevelopmentOnboardingReplay(true)).toBe(true);
    expect(isDevelopmentOnboardingReplayEnabled(true)).toBe(true);
    expect(isDevelopmentOnboardingReplayEnabled(false)).toBe(false);

    resetDevelopmentOnboardingReplay();
    expect(isDevelopmentOnboardingReplayEnabled(true)).toBe(false);
  });
});

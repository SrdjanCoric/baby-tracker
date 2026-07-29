import { describe, expect, it } from "vitest";
import {
  DEVELOPMENT_ONBOARDING_PREVIEW_ADAPTERS,
  getDevelopmentOnboardingPreview,
  type DevelopmentOnboardingPreviewPath,
} from "./development-onboarding-preview";

const paths: DevelopmentOnboardingPreviewPath[] = [
  "start-tracking",
  "join-family",
  "returning-user",
];

describe("development onboarding preview adapters", () => {
  it("provides deterministic isolated states for every onboarding path", () => {
    expect(Object.keys(DEVELOPMENT_ONBOARDING_PREVIEW_ADAPTERS)).toEqual(paths);

    for (const path of paths) {
      const adapter = DEVELOPMENT_ONBOARDING_PREVIEW_ADAPTERS[path];
      expect(adapter.scenarios).toContain("loading");
      expect(adapter.scenarios).toContain("recoverable-error");
      expect(adapter.scenarios).toContain("cancelled");
      expect(adapter.scenarios).toContain("success");

      for (const scenario of adapter.scenarios) {
        expect(getDevelopmentOnboardingPreview(path, scenario)).toEqual(
          getDevelopmentOnboardingPreview(path, scenario)
        );
      }
    }

    expect(DEVELOPMENT_ONBOARDING_PREVIEW_ADAPTERS["start-tracking"].scenarios)
      .toContain("skipped");
    expect(DEVELOPMENT_ONBOARDING_PREVIEW_ADAPTERS["join-family"].scenarios)
      .not.toContain("skipped");
    expect(DEVELOPMENT_ONBOARDING_PREVIEW_ADAPTERS["returning-user"].scenarios)
      .not.toContain("skipped");
  });

  it("describes loading, recovery, cancellation, skip, and successful completion without callbacks", () => {
    expect(getDevelopmentOnboardingPreview("join-family", "loading")).toMatchObject({
      status: "loading",
      primaryAction: null,
    });
    expect(getDevelopmentOnboardingPreview("returning-user", "recoverable-error")).toMatchObject({
      status: "recoverable-error",
      primaryAction: "Try again",
    });
    expect(getDevelopmentOnboardingPreview("join-family", "cancelled")).toMatchObject({
      status: "cancelled",
      primaryAction: "Return to Welcome",
    });
    expect(getDevelopmentOnboardingPreview("start-tracking", "skipped")).toMatchObject({
      status: "skipped",
      primaryAction: "Open Home",
    });
    expect(getDevelopmentOnboardingPreview("start-tracking", "success")).toMatchObject({
      status: "success",
      primaryAction: "Continue",
    });
  });
});

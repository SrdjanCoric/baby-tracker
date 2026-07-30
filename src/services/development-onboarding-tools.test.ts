import { describe, expect, it, vi } from "vitest";
import {
  clearUnfinishedOnboardingDraft,
  runFirstLaunchRoutingAgain,
  type DevelopmentOnboardingToolDependencies,
} from "./development-onboarding-tools";

function createDependencies(): DevelopmentOnboardingToolDependencies {
  return {
    resetOnboardingState: vi.fn().mockResolvedValue(undefined),
    clearUnfinishedDraft: vi.fn().mockResolvedValue(undefined),
    beginReturningAuthentication: vi.fn().mockResolvedValue(undefined),
    beginReturningRestoration: vi.fn().mockResolvedValue(1),
  };
}

describe("development onboarding tools", () => {
  it("replays signed-in first launch after resetting onboarding state", async () => {
    const dependencies = createDependencies();

    await runFirstLaunchRoutingAgain(
      { isAuthenticated: true, language: "en" },
      dependencies
    );

    expect(dependencies.resetOnboardingState).toHaveBeenCalledOnce();
    expect(dependencies.beginReturningAuthentication).toHaveBeenCalledWith("en");
    expect(dependencies.beginReturningRestoration).toHaveBeenCalledOnce();
    expect(dependencies.clearUnfinishedDraft).not.toHaveBeenCalled();
    expect(vi.mocked(dependencies.resetOnboardingState).mock.invocationCallOrder[0])
      .toBeLessThan(vi.mocked(dependencies.beginReturningAuthentication).mock.invocationCallOrder[0]);
  });

  it("replays signed-out first launch at Welcome without creating a draft", async () => {
    const dependencies = createDependencies();

    await runFirstLaunchRoutingAgain(
      { isAuthenticated: false, language: "system" },
      dependencies
    );

    expect(dependencies.resetOnboardingState).toHaveBeenCalledOnce();
    expect(dependencies.beginReturningAuthentication).not.toHaveBeenCalled();
    expect(dependencies.beginReturningRestoration).not.toHaveBeenCalled();
  });

  it("clears only an unfinished draft", async () => {
    const dependencies = createDependencies();

    await clearUnfinishedOnboardingDraft(dependencies);

    expect(dependencies.clearUnfinishedDraft).toHaveBeenCalledOnce();
    expect(dependencies.resetOnboardingState).not.toHaveBeenCalled();
    expect(dependencies.beginReturningAuthentication).not.toHaveBeenCalled();
    expect(dependencies.beginReturningRestoration).not.toHaveBeenCalled();
  });

  it("does not begin returning restoration when reset fails", async () => {
    const dependencies = createDependencies();
    vi.mocked(dependencies.resetOnboardingState).mockRejectedValueOnce(new Error("storage failed"));

    await expect(runFirstLaunchRoutingAgain(
      { isAuthenticated: true, language: "en" },
      dependencies
    )).rejects.toThrow("storage failed");

    expect(dependencies.beginReturningAuthentication).not.toHaveBeenCalled();
    expect(dependencies.beginReturningRestoration).not.toHaveBeenCalled();
  });
});

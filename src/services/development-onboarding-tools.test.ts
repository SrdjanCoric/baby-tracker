import { describe, expect, it, vi } from "vitest";
import {
  clearUnfinishedOnboardingDraft,
  runFirstLaunchRoutingAgain,
  type DevelopmentOnboardingToolDependencies,
} from "./development-onboarding-tools";

function createDependencies(): DevelopmentOnboardingToolDependencies {
  return {
    clearLegacyDraft: vi.fn().mockResolvedValue(undefined),
    clearLegacyCompletion: vi.fn().mockResolvedValue(undefined),
    clearVersionedState: vi.fn().mockResolvedValue(undefined),
    clearUnfinishedDraft: vi.fn().mockResolvedValue(undefined),
    beginReturningAuthentication: vi.fn().mockResolvedValue(undefined),
    beginReturningRestoration: vi.fn().mockResolvedValue(1),
  };
}

describe("development onboarding tools", () => {
  it("replays signed-in first launch after clearing only onboarding state", async () => {
    const dependencies = createDependencies();

    await runFirstLaunchRoutingAgain(
      { isAuthenticated: true, language: "en" },
      dependencies
    );

    expect(dependencies.clearLegacyDraft).toHaveBeenCalledOnce();
    expect(dependencies.clearVersionedState).toHaveBeenCalledOnce();
    expect(dependencies.beginReturningAuthentication).toHaveBeenCalledWith("en");
    expect(dependencies.beginReturningRestoration).toHaveBeenCalledOnce();
    expect(dependencies.clearLegacyCompletion).toHaveBeenCalledOnce();
    expect(dependencies.clearUnfinishedDraft).not.toHaveBeenCalled();
    const completionOrder = vi.mocked(dependencies.clearLegacyCompletion).mock.invocationCallOrder[0];
    expect(vi.mocked(dependencies.clearLegacyDraft).mock.invocationCallOrder[0])
      .toBeLessThan(completionOrder);
    expect(vi.mocked(dependencies.beginReturningRestoration).mock.invocationCallOrder[0])
      .toBeLessThan(completionOrder);
  });

  it("replays signed-out first launch at Welcome without creating a draft", async () => {
    const dependencies = createDependencies();

    await runFirstLaunchRoutingAgain(
      { isAuthenticated: false, language: "system" },
      dependencies
    );

    expect(dependencies.clearLegacyDraft).toHaveBeenCalledOnce();
    expect(dependencies.clearVersionedState).toHaveBeenCalledOnce();
    expect(dependencies.clearLegacyCompletion).toHaveBeenCalledOnce();
    expect(dependencies.beginReturningAuthentication).not.toHaveBeenCalled();
    expect(dependencies.beginReturningRestoration).not.toHaveBeenCalled();
  });

  it("clears only an unfinished draft", async () => {
    const dependencies = createDependencies();

    await clearUnfinishedOnboardingDraft(dependencies);

    expect(dependencies.clearUnfinishedDraft).toHaveBeenCalledOnce();
    expect(dependencies.clearLegacyDraft).not.toHaveBeenCalled();
    expect(dependencies.clearLegacyCompletion).not.toHaveBeenCalled();
    expect(dependencies.clearVersionedState).not.toHaveBeenCalled();
    expect(dependencies.beginReturningAuthentication).not.toHaveBeenCalled();
    expect(dependencies.beginReturningRestoration).not.toHaveBeenCalled();
  });

  it.each([
    "clearLegacyDraft",
    "clearVersionedState",
    "beginReturningAuthentication",
    "beginReturningRestoration",
  ] as const)("does not clear completion when %s fails", async operation => {
    const dependencies = createDependencies();
    vi.mocked(dependencies[operation]).mockRejectedValueOnce(new Error("storage failed"));

    await expect(runFirstLaunchRoutingAgain(
      { isAuthenticated: true, language: "en" },
      dependencies
    )).rejects.toThrow("storage failed");

    expect(dependencies.clearLegacyCompletion).not.toHaveBeenCalled();
  });
});

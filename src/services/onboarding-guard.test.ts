import { describe, expect, it } from "vitest";
import {
  getOnboardingRedirect,
  shouldStartReturningRestoration,
} from "@/services/onboarding-guard";
import type { NewOwnerOnboardingState } from "@/types/new-owner-onboarding";

const welcome: NewOwnerOnboardingState = {
  version: 2,
  screen: "welcome",
  language: "en",
  entryPath: null,
  babyDraft: { name: "", birthDate: null, gender: null },
};

const firstActivity: NewOwnerOnboardingState = {
  version: 2,
  screen: "first-activity",
  language: "en",
  entryPath: "owner",
  babyId: "baby-1",
  firstActivity: { status: "pending" },
};

const completed: NewOwnerOnboardingState = {
  version: 2,
  screen: "completed",
  language: "en",
  entryPath: "legacy",
  babyId: null,
  firstActivity: { status: "legacy-completed" },
};

describe("production onboarding guard", () => {
  it("starts returning restoration for a restored session without onboarding state", () => {
    expect(shouldStartReturningRestoration(welcome, true)).toBe(true);
    expect(shouldStartReturningRestoration(welcome, false)).toBe(false);
    expect(shouldStartReturningRestoration(firstActivity, true)).toBe(false);
  });

  it.each([
    [welcome, ["(tabs)"], "/onboarding/owner"],
    [welcome, ["onboarding", "owner"], null],
    [firstActivity, ["(tabs)"], "/onboarding/owner/activity"],
    [firstActivity, ["feeding"], null],
    [completed, ["onboarding", "owner"], "/(tabs)"],
    [completed, ["(tabs)"], null],
    [welcome, ["login-callback"], null],
  ] as const)("routes state %s from %s", (state, segments, expected) => {
    expect(getOnboardingRedirect(state, segments)).toBe(expected);
  });
});

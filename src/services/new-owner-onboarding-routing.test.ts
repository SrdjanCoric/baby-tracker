import { describe, expect, it } from "vitest";
import { getOnboardingDestination } from "@/services/new-owner-onboarding-routing";
import type { NewOwnerOnboardingState } from "@/types/new-owner-onboarding";

const base = {
  version: 2 as const,
  language: "en" as const,
  entryPath: "returning" as const,
};

describe("getOnboardingDestination", () => {
  it.each([
    [{ ...base, screen: "welcome", entryPath: null, babyDraft: { name: "", birthDate: null, gender: null } }, "/onboarding/owner", undefined],
    [{ ...base, screen: "returning-auth", authIntent: "returning-user" }, "/auth/sign-in?resumeOnboarding=true", null],
    [{ ...base, screen: "returning-restoring", attempt: 1, householdId: null }, "/onboarding/owner/restore", "restore"],
    [{ ...base, screen: "returning-verified-empty", attempt: 1, householdId: "household-1" }, "/onboarding/owner/restore", "restore"],
    [{ ...base, screen: "returning-unavailable", attempt: 1, householdId: null, reason: "profile" }, "/onboarding/owner/restore", "restore"],
    [{ ...base, screen: "returning-signed-out" }, "/onboarding/owner", undefined],
    [{ ...base, screen: "returning-restored", attempt: 1, householdId: "household-1", babyId: "baby-1" }, "/(tabs)", null],
    [{ ...base, screen: "completed", entryPath: "legacy", babyId: null, firstActivity: { status: "legacy-completed" } }, "/(tabs)", null],
  ] as const)("routes %s to its production destination", (state, route, ownerLeaf) => {
    expect(getOnboardingDestination(state as NewOwnerOnboardingState)).toEqual({
      route,
      ownerLeaf,
    });
  });
});

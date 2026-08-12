import { Alert } from "react-native";
import {
  babyReducer,
  initialBabyState,
  presentGuestMigrationConflict,
} from "./baby-context";
import type { StoredBabyProfile } from "@/services/baby-storage";

jest.mock("@/services/baby-storage", () => ({ BabyStorageService: {} }));
jest.mock("@/services/baby-sync-service", () => ({}));
jest.mock("@/services/guest-account-migration", () => ({}));
jest.mock("./sync-context", () => ({}));
jest.mock("./auth-context", () => ({}));
jest.mock("@/services/sync", () => ({
  tombstonedId: jest.fn(),
  upsertById: <T extends { id: string }>(items: T[], incoming: T) =>
    items.some(item => item.id === incoming.id)
      ? items.map(item => item.id === incoming.id ? incoming : item)
      : [...items, incoming],
}));

jest.mock("@/i18n", () => ({
  __esModule: true,
  default: { t: (key: string) => key },
}));

describe("guest migration conflict confirmation", () => {
  it("requires a second confirmation before deleting guest data", () => {
    const alertSpy = jest.spyOn(Alert, "alert");
    const useAnotherAccount = jest.fn();
    const discardGuestData = jest.fn();

    presentGuestMigrationConflict({ useAnotherAccount, discardGuestData });
    const firstButtons = alertSpy.mock.calls[0][2];
    firstButtons?.find(button => button.text === "newOwnerOnboarding.migration.keepAccountData")
      ?.onPress?.();

    expect(discardGuestData).not.toHaveBeenCalled();
    expect(alertSpy).toHaveBeenCalledTimes(2);

    const confirmationButtons = alertSpy.mock.calls[1][2];
    confirmationButtons?.find(
      button => button.text === "newOwnerOnboarding.migration.keepAccountData"
    )?.onPress?.();

    expect(discardGuestData).toHaveBeenCalledTimes(1);
    expect(useAnotherAccount).not.toHaveBeenCalled();
  });
});

describe("babyReducer realtime updates", () => {
  const baby: StoredBabyProfile = {
    id: "baby-1",
    name: "Ada",
    birthDate: "2026-01-01T00:00:00.000Z",
    gender: "female",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-02T00:00:00.000Z",
  };

  it("keeps the selected baby reference stable when a remote row transforms to the same profile", () => {
    const state = { ...initialBabyState, babies: [baby], selectedBaby: baby };

    const next = babyReducer(state, { type: "REMOTE_UPDATE", payload: { ...baby } });

    expect(next).toBe(state);
    expect(next.selectedBaby).toBe(baby);
  });

  it("propagates genuine remote profile edits", () => {
    const state = { ...initialBabyState, babies: [baby], selectedBaby: baby };
    const renamed = { ...baby, name: "Grace", birthDate: "2026-02-01T00:00:00.000Z" };

    const next = babyReducer(state, { type: "REMOTE_UPDATE", payload: renamed });

    expect(next).not.toBe(state);
    expect(next.selectedBaby).toBe(renamed);
    expect(next.babies).toEqual([renamed]);
  });

  it("repairs a selected baby that diverged from the matching list entry", () => {
    const canonical = { ...baby, name: "Emmy" };
    const staleSelected = { ...baby, name: "Emma" };
    const state = {
      ...initialBabyState,
      babies: [canonical],
      selectedBaby: staleSelected,
    };

    const next = babyReducer(state, {
      type: "REMOTE_UPDATE",
      payload: { ...canonical },
    });

    expect(next.selectedBaby).toEqual(canonical);
    expect(next.selectedBaby).not.toBe(staleSelected);
  });
});

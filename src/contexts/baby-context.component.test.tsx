import { Alert } from "react-native";
import { presentGuestMigrationConflict } from "./baby-context";

jest.mock("@/services/baby-storage", () => ({ BabyStorageService: {} }));
jest.mock("@/services/baby-sync-service", () => ({}));
jest.mock("@/services/guest-account-migration", () => ({}));
jest.mock("./sync-context", () => ({}));
jest.mock("./auth-context", () => ({}));

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

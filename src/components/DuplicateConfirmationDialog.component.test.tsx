import { Alert } from "react-native";
import type { TFunction } from "i18next";
import { showDuplicateConfirmation } from "./DuplicateConfirmationDialog";

describe("DuplicateConfirmationDialog overlap copy", () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it.each(["feeding", "pumping", "tummyTime", "sleep"] as const)(
    "shows %s overlap copy when the match reason is an overlapping session",
    (activityType) => {
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    const t = jest.fn((key: string) => key) as unknown as TFunction;

    showDuplicateConfirmation({
      activityType,
      existingEntryTime: "2026-08-07T09:00:00.000Z",
      matchReason: "overlapping_session",
      onConfirm: jest.fn(),
      onCancel: jest.fn(),
      t,
    });

    expect(alertSpy).toHaveBeenCalledWith(
      `duplicateDetection.${activityType}OverlapTitle`,
      `duplicateDetection.${activityType}OverlapMessage`,
      expect.arrayContaining([
        expect.objectContaining({ text: "duplicateDetection.continueAnyway" }),
      ])
    );
    }
  );
});

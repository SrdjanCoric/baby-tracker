import { describe, expect, it, vi } from "vitest";

vi.mock("react-native", () => ({ Platform: { OS: "ios" } }));
vi.mock("@/services/extension-storage", () => ({ loadExtensionStorage: vi.fn() }));

import { createEmptyWidgetData, updateSleepWidgetData } from "./widget-data-service";

describe("sleep extension data", () => {
  it("carries a pending morning confirmation without blocking active sleep transport", () => {
    const empty = createEmptyWidgetData("baby-1", "Sofi");
    const activities = updateSleepWidgetData(
      empty.activities,
      "2026-07-25T08:30:00.000Z",
      60,
      840,
      null,
      true,
      "night",
      120,
      "nap1",
      "2026-07-25T07:00:00.000Z",
      0,
      true
    );

    expect(activities.sleep).toEqual(expect.objectContaining({
      isActive: true,
      sleepType: "night",
      morningConfirmationPending: true,
    }));
  });
});

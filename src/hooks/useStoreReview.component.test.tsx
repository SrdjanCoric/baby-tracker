import React from "react";
import { act, render } from "@testing-library/react-native";

let mockFeedings: unknown[] = [];
const mockRecordFirstUse = jest.fn();
const mockShouldRequestReview = jest.fn();
const mockRequestReview = jest.fn();

jest.mock("../contexts/feeding-context", () => ({
  useFeeding: () => ({ feedings: mockFeedings }),
}));
jest.mock("../contexts/sleep-context", () => ({
  useSleep: () => ({ sleeps: [] }),
}));
jest.mock("../contexts/diaper-context", () => ({
  useDiaper: () => ({ diapers: [] }),
}));
jest.mock("../contexts/pumping-context", () => ({
  usePumping: () => ({ pumpings: [] }),
}));
jest.mock("../contexts/growth-context", () => ({
  useGrowth: () => ({ measurements: [] }),
}));
jest.mock("../contexts/tummyTime-context", () => ({
  useTummyTime: () => ({ tummyTimes: [] }),
}));
jest.mock("../contexts/health-context", () => ({
  useHealth: () => ({ healthEntries: [] }),
}));
jest.mock("../services/store-review-service", () => ({
  recordFirstUse: () => mockRecordFirstUse(),
  shouldRequestReview: (count: number) => mockShouldRequestReview(count),
  requestReview: () => mockRequestReview(),
}));

import { useStoreReview } from "./useStoreReview";

function StoreReviewHarness() {
  useStoreReview();
  return null;
}

describe("useStoreReview", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.clearAllMocks();
    mockFeedings = [];
    mockRecordFirstUse.mockResolvedValue(undefined);
    mockShouldRequestReview.mockResolvedValue(true);
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("logs and swallows a rejected automatic review request", async () => {
    const requestError = new Error("review request failed");
    mockRequestReview.mockRejectedValue(requestError);
    const consoleError = jest
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    const view = render(<StoreReviewHarness />);

    mockFeedings = [{}];
    view.rerender(<StoreReviewHarness />);

    await act(async () => {
      jest.advanceTimersByTime(2000);
      await Promise.resolve();
      await Promise.resolve();
    });

    expect(consoleError).toHaveBeenCalledWith(
      "[StoreReview] Automatic review request failed",
      requestError
    );
  });
});

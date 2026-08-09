jest.mock("@/services/tip-storage", () => ({
  getShownTipIds: jest.fn(async () => []),
  addShownTipIds: jest.fn(async () => undefined),
  resetShownTipIds: jest.fn(async () => undefined),
}));

import { selectDailyTips } from "./tip-selector";

describe("daily tip local calendar selection", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date(2026, 7, 8, 12));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("keeps the same tips throughout the caregiver's local day", async () => {
    const birthDate = new Date(2026, 3, 8, 12);
    const afterMidnight = new Date(2026, 7, 8, 0, 15);
    const beforeMidnight = new Date(2026, 7, 8, 23, 15);

    const earlyTips = await selectDailyTips("baby-1", birthDate, afterMidnight, "en");
    const lateTips = await selectDailyTips("baby-1", birthDate, beforeMidnight, "en");

    expect(earlyTips.map((tip) => tip.id)).toEqual(lateTips.map((tip) => tip.id));
  });
});

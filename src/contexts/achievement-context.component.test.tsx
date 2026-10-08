import React from "react";
import { act, render } from "@testing-library/react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AchievementProvider, useAchievements } from "./achievement-context";
import { getDetectedAchievementIds } from "@/services/achievement-storage";
import { SleepStorageService } from "@/services/sleep-storage";
import { TummyTimeStorageService } from "@/services/tummyTime-storage";
import { FeedingStorageService } from "@/services/feeding-storage";
import type { StoredSleepEntry } from "@/services/sleep-storage";
import type { StoredTummyTimeEntry } from "@/services/tummyTime-storage";
import type { StoredFeedingEntry } from "@/services/feeding-storage";

const mockBaby = { id: "baby-1", birthDate: "2026-07-08" };
let mockSleeps: StoredSleepEntry[] = [];
let mockTummyTimes: StoredTummyTimeEntry[] = [];
let mockFeedings: StoredFeedingEntry[] = [];

jest.mock("./baby-context", () => ({
  useBaby: () => ({ selectedBaby: mockBaby }),
}));
jest.mock("./sleep-context", () => ({
  useSleep: () => ({ sleeps: mockSleeps, isLoading: false }),
}));
jest.mock("./tummyTime-context", () => ({
  useTummyTime: () => ({ tummyTimes: mockTummyTimes, isLoading: false }),
}));
jest.mock("./feeding-context", () => ({
  useFeeding: () => ({ feedings: mockFeedings, isLoading: false }),
}));
jest.mock("./auth-context", () => ({ useAuth: () => ({ session: null }) }));
jest.mock("@/services/activity-sync-service", () => ({
  fetchAchievementsFromDatabase: jest.fn(),
  insertAchievementInDatabase: jest.fn(async () => {}),
}));

let achievements: ReturnType<typeof useAchievements>;
function Probe() {
  achievements = useAchievements();
  return null;
}
const tree = () => (
  <AchievementProvider>
    <Probe />
  </AchievementProvider>
);
const now = new Date("2026-10-08T12:00:00.000Z");
const ago = (minutes: number) => new Date(now.getTime() - minutes * 60000);

async function addSleep(
  minutes: number,
  endedAt = ago(60),
  type: "night" | "nap" = "night"
) {
  return SleepStorageService.addSleep({
    babyId: mockBaby.id,
    type,
    durationSeconds: minutes * 60,
    startedAt: new Date(endedAt.getTime() - minutes * 60000),
    endedAt,
  });
}

describe("achievement celebration persistence", () => {
  beforeEach(async () => {
    jest.useFakeTimers();
    jest.setSystemTime(now);
    await AsyncStorage.clear();
    mockSleeps = [];
    mockTummyTimes = [];
    mockFeedings = [];
  });
  afterEach(() => jest.useRealTimers());

  it("celebrates a 10.5-hour night once, persists lower tiers, and stays quiet after a nap and restart", async () => {
    const view = render(tree());
    await act(async () => {});
    mockSleeps = [await addSleep(630)];
    await act(async () => view.rerender(tree()));
    expect(achievements.pendingCelebration?.id).toBe("sleep_10h");
    expect(await getDetectedAchievementIds(mockBaby.id, false)).toEqual(
      new Set(["sleep_6h", "sleep_8h", "sleep_10h"])
    );

    act(() => achievements.dismissCelebration());
    mockSleeps = [...mockSleeps, await addSleep(30, now, "nap")];
    await act(async () => view.rerender(tree()));
    expect(achievements.pendingCelebration).toBeNull();
    view.unmount();
    render(tree());
    await act(async () => {});
    expect(achievements.pendingCelebration).toBeNull();
    expect(await getDetectedAchievementIds(mockBaby.id, false)).toEqual(
      new Set(["sleep_6h", "sleep_8h", "sleep_10h"])
    );
  });

  it("stores the lower tummy tiers silently and leaves the unreached 20-minute tier available", async () => {
    const view = render(tree());
    await act(async () => {});
    mockTummyTimes = [
      await TummyTimeStorageService.addTummyTime({
        babyId: mockBaby.id,
        startedAt: ago(16),
        endedAt: now,
        durationSeconds: 16 * 60,
      }),
    ];
    await act(async () => view.rerender(tree()));
    expect(achievements.pendingCelebration?.id).toBe("tummy_15min");
    expect(await getDetectedAchievementIds(mockBaby.id, false)).toEqual(
      new Set(["tummy_5min", "tummy_10min", "tummy_15min"])
    );
    act(() => achievements.dismissCelebration());
    mockTummyTimes = [
      ...mockTummyTimes,
      await TummyTimeStorageService.addTummyTime({
        babyId: mockBaby.id,
        startedAt: ago(20),
        endedAt: now,
        durationSeconds: 20 * 60,
      }),
    ];
    await act(async () => view.rerender(tree()));
    expect(achievements.pendingCelebration?.id).toBe("tummy_20min");
    expect((await getDetectedAchievementIds(mockBaby.id, false)).size).toBe(4);
  });

  it("silently earns back-entered activities and does not celebrate their tiers later in the session", async () => {
    const view = render(tree());
    await act(async () => {});
    mockSleeps = [await addSleep(420, ago(3 * 24 * 60))];
    mockTummyTimes = [
      await TummyTimeStorageService.addTummyTime({
        babyId: mockBaby.id,
        startedAt: ago(3 * 24 * 60 + 20),
        endedAt: ago(3 * 24 * 60),
        durationSeconds: 20 * 60,
      }),
    ];
    mockFeedings = [
      await FeedingStorageService.addFeeding({
        babyId: mockBaby.id,
        type: "solid",
        startedAt: ago(3 * 24 * 60),
      }),
    ];
    expect(mockSleeps[0].createdAt).toBe(now.toISOString());
    await act(async () => view.rerender(tree()));
    expect(achievements.pendingCelebration).toBeNull();
    expect(await getDetectedAchievementIds(mockBaby.id, false)).toEqual(
      new Set([
        "sleep_6h",
        "tummy_5min",
        "tummy_10min",
        "tummy_15min",
        "tummy_20min",
        "first_solid",
      ])
    );
    mockSleeps = [...mockSleeps, await addSleep(420)];
    mockTummyTimes = [
      ...mockTummyTimes,
      await TummyTimeStorageService.addTummyTime({
        babyId: mockBaby.id,
        startedAt: ago(10),
        endedAt: now,
        durationSeconds: 10 * 60,
      }),
    ];
    mockFeedings = [
      ...mockFeedings,
      await FeedingStorageService.addFeeding({
        babyId: mockBaby.id,
        type: "solid",
        startedAt: now,
      }),
    ];
    await act(async () => view.rerender(tree()));
    expect(achievements.pendingCelebration).toBeNull();
  });

  it("does not celebrate a recent 7-hour sleep after importing old 10.5-hour nights mid-session", async () => {
    const view = render(tree());
    await act(async () => {});
    mockSleeps = [
      await addSleep(630, ago(90 * 24 * 60)),
      await addSleep(630, ago(89 * 24 * 60)),
    ];
    await act(async () => view.rerender(tree()));
    expect(achievements.pendingCelebration).toBeNull();
    expect(await getDetectedAchievementIds(mockBaby.id, false)).toEqual(
      new Set(["sleep_6h", "sleep_8h", "sleep_10h"])
    );
    mockSleeps = [...mockSleeps, await addSleep(420)];
    await act(async () => view.rerender(tree()));
    expect(achievements.pendingCelebration).toBeNull();
  });

  it("still celebrates a new higher tier when recent and historical entries arrive together", async () => {
    const view = render(tree());
    await act(async () => {});
    mockSleeps = [await addSleep(420, ago(3 * 24 * 60)), await addSleep(630)];
    await act(async () => view.rerender(tree()));
    expect(achievements.pendingCelebration?.id).toBe("sleep_10h");
    expect(await getDetectedAchievementIds(mockBaby.id, false)).toEqual(
      new Set(["sleep_6h", "sleep_8h", "sleep_10h"])
    );
    act(() => achievements.dismissCelebration());
    mockSleeps = [...mockSleeps, await addSleep(30, now, "nap")];
    await act(async () => view.rerender(tree()));
    expect(achievements.pendingCelebration).toBeNull();
  });

  it("seeds every historically reached tier on startup without celebration", async () => {
    mockSleeps = [await addSleep(630, ago(3 * 24 * 60))];
    const view = render(tree());
    await act(async () => {});
    expect(achievements.pendingCelebration).toBeNull();
    mockSleeps = [...mockSleeps, await addSleep(630)];
    await act(async () => view.rerender(tree()));
    expect(achievements.pendingCelebration).toBeNull();
  });
});

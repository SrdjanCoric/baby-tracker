import { beforeEach, describe, expect, it, vi } from "vitest";
import { MilestonesStorageService } from "./milestones-storage";

const storage = new Map<string, string>();

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(async (key: string) => storage.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => {
      storage.set(key, value);
    }),
  },
}));

vi.mock("expo-crypto", () => ({
  randomUUID: () => "11111111-1111-4111-8111-111111111111",
}));

describe("milestone response persistence", () => {
  beforeEach(() => {
    storage.clear();
  });

  it("revives a cleared response under its stable identity after restart", async () => {
    const first = await MilestonesStorageService.setMilestoneState({
      babyId: "baby-1",
      milestoneId: "milestone-1",
      state: "yes",
    });
    await MilestonesStorageService.setMilestoneState({
      babyId: "baby-1",
      milestoneId: "milestone-1",
      state: "not_sure",
    });
    await MilestonesStorageService.clearMilestoneState("baby-1", "milestone-1");

    expect(await MilestonesStorageService.getResponses("baby-1")).toEqual([
      expect.objectContaining({ id: first.id, milestoneId: "milestone-1", deleted: true }),
    ]);

    await MilestonesStorageService.setMilestoneState({
      babyId: "baby-1",
      milestoneId: "milestone-1",
      state: "yes",
    });

    expect(await MilestonesStorageService.getResponses("baby-1")).toEqual([
      expect.objectContaining({
        id: first.id,
        milestoneId: "milestone-1",
        state: "yes",
        deleted: false,
      }),
    ]);
  });
});

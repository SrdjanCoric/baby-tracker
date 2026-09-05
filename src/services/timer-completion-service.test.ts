import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  acceptTimerCompletion,
  getTimerCompletion,
  markTimerCompletionDurable,
  resolveTimerIdentity,
} from "./timer-completion-service";

const storage = new Map<string, string>();

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn(async (key: string) => storage.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => storage.set(key, value)),
  },
}));

vi.mock("expo-crypto", () => ({
  CryptoDigestAlgorithm: { SHA256: "SHA-256" },
  randomUUID: vi.fn(),
  digestStringAsync: vi.fn(async (_algorithm: string, value: string) => {
    let hash = 2166136261;
    for (const character of value) {
      hash ^= character.charCodeAt(0);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16).padStart(8, "0").repeat(8);
  }),
}));

describe("timer completion service", () => {
  beforeEach(() => {
    storage.clear();
    vi.clearAllMocks();
  });

  it("derives the same compatibility identity from a legacy persisted timer", async () => {
    const first = await resolveTimerIdentity(
      "baby-1",
      "feeding",
      "2026-07-15T08:00:00.000Z"
    );
    const restored = await resolveTimerIdentity(
      "baby-1",
      "feeding",
      "2026-07-15T08:00:00.000Z"
    );

    expect(restored).toEqual(first);
    expect(first.timerInstanceId).not.toBe(first.activityId);
  });

  it("preserves the first accepted stop time when completion is retried", async () => {
    const identity = {
      timerInstanceId: "00000000-0000-4000-8000-000000000001",
      activityId: "00000000-0000-4000-8000-000000000002",
    };
    const first = await acceptTimerCompletion(
      "baby-1",
      "sleep",
      "2026-07-15T08:00:00.000Z",
      identity,
      new Date("2026-07-15T08:05:00.000Z")
    );
    const retried = await acceptTimerCompletion(
      "baby-1",
      "sleep",
      "2026-07-15T08:00:00.000Z",
      identity,
      new Date("2026-07-15T08:10:00.000Z")
    );

    expect(retried).toEqual(first);
    expect(retried.stoppedAt).toBe("2026-07-15T08:05:00.000Z");

    await markTimerCompletionDurable(first);
    await expect(getTimerCompletion("baby-1", "sleep", identity.timerInstanceId)).resolves.toEqual({
      ...first,
      status: "completed",
    });
  });

  it("converges independent stops of one timer instance on one activity id", async () => {
    const first = await acceptTimerCompletion(
      "baby-1",
      "sleep",
      "2026-07-15T08:00:00.000Z",
      {
        timerInstanceId: "00000000-0000-4000-8000-000000000001",
        activityId: "00000000-0000-4000-8000-000000000002",
      },
      new Date("2026-07-15T08:05:00.000Z")
    );
    storage.clear();
    const independent = await acceptTimerCompletion(
      "baby-1",
      "sleep",
      "2026-07-15T08:00:00.000Z",
      {
        timerInstanceId: "00000000-0000-4000-8000-000000000001",
        activityId: "00000000-0000-4000-8000-000000000099",
      },
      new Date("2026-07-15T08:06:00.000Z")
    );

    expect(independent.activityId).toBe(first.activityId);
    expect(first.activityId).not.toBe("00000000-0000-4000-8000-000000000002");
  });

  it("derives different activity ids for different timer instances", async () => {
    const first = await acceptTimerCompletion(
      "baby-1",
      "sleep",
      "2026-07-15T08:00:00.000Z",
      { timerInstanceId: "timer-1", activityId: "ignored-1" },
      new Date("2026-07-15T08:05:00.000Z")
    );
    const second = await acceptTimerCompletion(
      "baby-1",
      "sleep",
      "2026-07-15T09:00:00.000Z",
      { timerInstanceId: "timer-2", activityId: "ignored-2" },
      new Date("2026-07-15T09:05:00.000Z")
    );

    expect(second.activityId).not.toBe(first.activityId);
  });
});

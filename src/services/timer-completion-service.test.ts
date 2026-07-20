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
  digestStringAsync: vi.fn(async (_algorithm: string, value: string) =>
    (value.startsWith("timer:") ? "a" : "b").repeat(64)
  ),
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
});

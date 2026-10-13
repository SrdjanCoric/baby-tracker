import { describe, expect, it } from "vitest";
import type { TimerLockReconciliationState } from "./timer-lock-reconciliation";
import { isTimerStarter } from "./timer-starter";

describe("timer starter ownership", () => {
  it.each<
    [
      string,
      { startedBy: string } | null,
      TimerLockReconciliationState | undefined,
      string | undefined,
      boolean,
    ]
  >([
    ["my lock", { startedBy: "user-1" }, "owned", "user-1", true],
    [
      "their lock overrides local ownership",
      { startedBy: "user-2" },
      "owned",
      "user-1",
      false,
    ],
    [
      "lock without a user",
      { startedBy: "user-1" },
      "accountless",
      undefined,
      false,
    ],
    ["accountless without a user", null, "accountless", undefined, true],
    ["accountless with a user", null, "accountless", "user-1", false],
    ["owned", null, "owned", "user-1", true],
    ["offline", null, "offline", "user-1", true],
    ["owned without a user", null, "owned", undefined, false],
    ["offline without a user", null, "offline", undefined, false],
    ["reconciling", null, "reconciling", "user-1", false],
    ["conflicted", null, "conflicted", "user-1", false],
    ["unknown state", null, undefined, "user-1", false],
  ])("recognizes %s", (_name, lock, state, userId, expected) => {
    expect(isTimerStarter(lock, state, userId)).toBe(expected);
  });
});

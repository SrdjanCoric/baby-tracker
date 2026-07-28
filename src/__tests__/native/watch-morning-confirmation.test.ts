import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("../../../targets/watch/index.swift", import.meta.url),
  "utf8"
);

describe("Watch morning sleep confirmation handoff", () => {
  it("decodes the optional phone-owned confirmation signal and keeps sleep start available", () => {
    expect(source).toContain("var morningConfirmationPending: Bool?");
    expect(source).toContain('Text("Confirm in SofiBaby")');
    expect(source).toContain('connector.startTimer(activityType: "sleep", context: "auto")');

    const detailStart = source.indexOf("struct SleepDetailView");
    const detailEnd = source.indexOf("func formatSleepDuration", detailStart);
    const detail = source.slice(detailStart, detailEnd);
    const confirmationStart = detail.indexOf("if data.morningConfirmationPending == true");
    const timerBranch = detail.indexOf("if let timer = sleepTimer", confirmationStart);
    const confirmationBlock = detail.slice(confirmationStart, timerBranch);
    expect(confirmationBlock).not.toContain("return");
    expect(detail.indexOf('connector.startTimer(activityType: "sleep", context: "auto")'))
      .toBeGreaterThan(timerBranch);
  });
});

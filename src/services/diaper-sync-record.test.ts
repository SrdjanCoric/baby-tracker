import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildDiaperCreateRecord } from "./diaper-sync-record";
import { stampChanges } from "./sync/crdt";

describe("phone diaper sync record", () => {
  it("matches the shared Wear row fixture including field clocks", () => {
    let counter = 0;
    const record = buildDiaperCreateRecord({
      id: "11111111-1111-4111-8111-111111111111",
      babyId: "22222222-2222-4222-8222-222222222222",
      type: "dirty",
      stoolColor: "green",
      changedAt: "2026-08-22T08:15:30.123Z",
      loggedBy: "33333333-3333-4333-8333-333333333333",
      createdAt: "2026-08-22T08:15:30.123Z",
    });
    const stamped = stampChanges(null, record, () =>
      `2026-08-22T08:15:30.123Z-${(counter++).toString().padStart(4, "0")}-wear-test-device`
    );
    const fixture = JSON.parse(
      readFileSync(
        new URL(
          "../../plugins/with-wear-os/android/wear/src/test/resources/phone-diaper-row.json",
          import.meta.url
        ),
        "utf8"
      )
    );

    expect({ ...record, field_clocks: stamped.fieldClocks }).toEqual(fixture);
  });
});

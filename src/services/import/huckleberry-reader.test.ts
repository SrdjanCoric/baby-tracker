import { describe, expect, it } from "vitest";
import {
  HUCKLEBERRY_HEADER,
  parseLocalTime,
  readHuckleberry,
} from "./huckleberry-reader";

const csv = (rows: string[][]) =>
  [HUCKLEBERRY_HEADER, ...rows]
    .map((row) =>
      row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(",")
    )
    .join("\r\n");

describe("Huckleberry sleep reader", () => {
  it("reads quoted notes unchanged and derives completed sleep times", () => {
    const preview = readHuckleberry(
      csv([
        [
          "Sleep",
          "2024-01-12 12:00",
          "2024-01-12 13:30",
          "1:30",
          "",
          "",
          "",
          'a, "note"\nsecond line',
        ],
      ])
    );
    expect(preview.records).toHaveLength(1);
    expect(preview.records[0]).toMatchObject({
      kind: "sleep",
      input: {
        startedAt: new Date(2024, 0, 12, 12),
        endedAt: new Date(2024, 0, 12, 13, 30),
        durationSeconds: 5400,
        type: "nap",
        notes: 'a, "note"\nsecond line',
      },
    });
  });

  it("reports unsupported, running, unreadable, out-of-limit and future rows", () => {
    const preview = readHuckleberry(
      csv([
        ["Bath", "", "", "", "", "", "", ""],
        ["Sleep", "2024-01-12 12:00", "", "", "", "", "", ""],
        ["Sleep", "2024-02-30 12:00", "2024-02-30 13:00", "", "", "", "", ""],
        ["Sleep", "2024-01-12 12:00", "2024-01-12 11:00", "", "", "", "", ""],
        ["Sleep", "2024-01-12 12:00", "2024-01-13 13:00", "", "", "", "", ""],
        ["Sleep", "2099-01-12 12:00", "2099-01-12 13:00", "", "", "", "", ""],
      ])
    );
    expect(preview.skipped).toEqual({
      "unsupported:Bath": 1,
      stillRunning: 1,
      couldNotRead: 2,
      outsideLimits: 1,
      future: 1,
    });
  });
});

describe("Huckleberry activity mappings", () => {
  it.each([
    [
      "Feed",
      "",
      "",
      "Formula",
      "Bottle",
      "3 oz",
      "feeding",
      { type: "bottle", contentType: "formula", amountMl: 89 },
    ],
    [
      "Feed",
      "",
      "",
      "Mixed",
      "Bottle",
      "80 ml",
      "feeding",
      { type: "bottle", amountMl: 80 },
    ],
    [
      "Feed",
      "2024-01-12 12:30",
      "",
      "0:12R",
      "Breast",
      "0:18L",
      "feeding",
      {
        type: "breast",
        side: "both",
        leftDurationSeconds: 1080,
        rightDurationSeconds: 720,
        durationSeconds: 1800,
      },
    ],
    [
      "Solids",
      "",
      "",
      "pear, oats",
      "",
      "",
      "feeding",
      { type: "solid", foodType: "pear, oats" },
    ],
    [
      "Diaper",
      "",
      "mustard",
      "",
      "",
      "Both pee:large Diaper rash",
      "diaper",
      { type: "mixed", stoolColor: "yellow" },
    ],
    [
      "Growth",
      "",
      "",
      "12 lb",
      "2.1 ft.in",
      "16 in",
      "growth",
      {
        weightKg: expect.closeTo(5.44310844),
        heightCm: expect.closeTo(64.008),
        headCircumferenceCm: 40.64,
      },
    ],
    [
      "Pump",
      "",
      "0:15",
      "1 oz",
      "",
      "2 oz",
      "pumping",
      {
        side: "both",
        volumeMl: 89,
        durationSeconds: 900,
        endedAt: new Date(2024, 0, 12, 12, 15),
      },
    ],
    [
      "Meds",
      "",
      "",
      "2.5 ml",
      "Example medicine",
      "",
      "health",
      {
        type: "medication",
        medicationName: "Example medicine",
        dosageAmount: 2.5,
        dosageUnit: "ml",
      },
    ],
    [
      "Meds",
      "",
      "",
      "",
      "Example medicine",
      "",
      "health",
      { type: "medication", medicationName: "Example medicine" },
    ],
    [
      "Tummy time",
      "2024-01-12 12:04",
      "",
      "",
      "",
      "",
      "tummyTime",
      { durationSeconds: 240 },
    ],
  ])(
    "maps %s",
    (type, end, duration, condition, location, endCondition, kind, input) => {
      const result = readHuckleberry(
        csv([
          [
            type as string,
            "2024-01-12 12:00",
            end as string,
            duration as string,
            condition as string,
            location as string,
            endCondition as string,
            "unchanged",
          ],
        ])
      );
      expect(result.skipped).toEqual({});
      expect(result.records[0]).toMatchObject({
        kind,
        input: { ...(input as object), notes: "unchanged" },
      });
      if (type === "Feed" && condition === "Mixed")
        expect(result.records[0].input).not.toHaveProperty("contentType");
    }
  );

  it.each([
    [
      "Feed",
      "",
      "",
      "Breast Milk",
      "Bottle",
      "110 ml",
      "feeding",
      { type: "bottle", contentType: "breastMilk", amountMl: 110 },
    ],
    [
      "Feed",
      "2024-01-12 12:10",
      "",
      "0:10R",
      "Breast",
      "",
      "feeding",
      { side: "right", rightDurationSeconds: 600 },
    ],
    [
      "Feed",
      "2024-01-12 12:10",
      "",
      "",
      "Breast",
      "0:10L",
      "feeding",
      { side: "left", leftDurationSeconds: 600 },
    ],
    [
      "Diaper",
      "",
      "brown",
      "",
      "",
      "Poo",
      "diaper",
      { type: "dirty", stoolColor: "brown" },
    ],
    ["Diaper", "", "purple", "", "", "Pee:large", "diaper", { type: "wet" }],
    ["Growth", "", "", "5 kg", "", "", "growth", { weightKg: 5 }],
    [
      "Growth",
      "",
      "",
      "",
      "65 cm",
      "41 cm",
      "growth",
      { heightCm: 65, headCircumferenceCm: 41 },
    ],
    [
      "Pump",
      "",
      "",
      "",
      "",
      "70 ml",
      "pumping",
      { side: "right", volumeMl: 70 },
    ],
    [
      "Pump",
      "",
      "",
      "70 ml",
      "",
      "",
      "pumping",
      { side: "left", volumeMl: 70 },
    ],
    ...["mg", "drops", "tsp"].map((unit) => [
      "Meds",
      "",
      "",
      `2 ${unit}`,
      "Medicine",
      "",
      "health",
      { dosageAmount: 2, dosageUnit: unit },
    ]),
  ])(
    "maps optional fields for %s",
    (type, end, duration, condition, location, endCondition, kind, input) => {
      const preview = readHuckleberry(
        csv([
          [
            type as string,
            "2024-01-12 12:00",
            end as string,
            duration as string,
            condition as string,
            location as string,
            endCondition as string,
            "",
          ],
        ])
      );
      expect(preview.skipped).toEqual({});
      expect(preview.records[0]).toMatchObject({ kind, input });
      if (type === "Pump")
        expect(preview.records[0].input).not.toHaveProperty("endedAt");
      if (type === "Diaper" && duration === "purple")
        expect(preview.records[0].input).not.toHaveProperty("stoolColor");
    }
  );

  it.each([
    ["Feed", "", "", "Formula", "Bottle", "", "couldNotRead"],
    ["Feed", "", "", "Formula", "Bottle", "600 ml", "outsideLimits"],
    ["Feed", "", "", "Formula", "Bottle", "0 ml", "outsideLimits"],
    ["Feed", "", "", "Formula", "Bottle", "50 cups", "couldNotRead"],
    ["Feed", "", "", "0:10R", "Breast", "", "stillRunning"],
    ["Feed", "2024-01-12 14:01", "", "0:10R", "Breast", "", "outsideLimits"],
    ["Feed", "2024-01-12 12:10", "", "0:75R", "Breast", "", "couldNotRead"],
    ["Solids", "", "", "", "", "", "couldNotRead"],
    ["Solids", "", "", "x".repeat(101), "", "", "outsideLimits"],
    ["Diaper", "", "", "", "", "rash", "couldNotRead"],
    ["Growth", "", "", "", "", "", "couldNotRead"],
    ["Growth", "", "", "31 kg", "", "", "outsideLimits"],
    ["Growth", "", "", "", "151 cm", "", "outsideLimits"],
    ["Growth", "", "", "", "", "61 cm", "outsideLimits"],
    ["Pump", "", "1:01", "100 ml", "", "", "outsideLimits"],
    ["Pump", "", "", "300 ml", "", "300 ml", "outsideLimits"],
    ["Pump", "", "", "", "", "", "couldNotRead"],
    ["Meds", "", "", "2 ml", "", "", "couldNotRead"],
    ["Tummy time", "", "", "", "", "", "stillRunning"],
    ["Tummy time", "2024-01-12 14:01", "", "", "", "", "outsideLimits"],
    ["Sleep", "2024-01-12 12:00", "", "", "", "", "outsideLimits"],
  ])(
    "skips invalid %s rows",
    (type, end, duration, condition, location, endCondition, reason) => {
      expect(
        readHuckleberry(
          csv([
            [
              type,
              "2024-01-12 12:00",
              end,
              duration,
              condition,
              location,
              endCondition,
              "",
            ],
          ])
        ).skipped
      ).toEqual({ [reason]: 1 });
    }
  );

  it("keeps a medication name without inventing a dose for unsupported units", () => {
    const record = readHuckleberry(
      csv([
        ["Meds", "2024-01-12 12:00", "", "", "2 tablets", "Medicine", "", ""],
      ])
    ).records[0];
    expect(record.input).toMatchObject({ medicationName: "Medicine" });
    expect(record.input).not.toHaveProperty("dosageAmount");
    expect(record.input).not.toHaveProperty("dosageUnit");
  });
});

describe("file contract", () => {
  it("rejects another header, empty input, malformed quoting and over 20,000 rows", () => {
    for (const input of [
      "",
      HUCKLEBERRY_HEADER.join(","),
      "a,b\n1,2",
      `${HUCKLEBERRY_HEADER.join(",")}\n"unclosed`,
    ]) {
      expect(() => readHuckleberry(input)).toThrow("invalidFile");
    }
    const row = ["Bath", "", "", "", "", "", "", ""];
    expect(() =>
      readHuckleberry(csv(Array.from({ length: 20001 }, () => row)))
    ).toThrow("fileTooLarge");
    expect(
      readHuckleberry(csv(Array.from({ length: 20000 }, () => row))).skipped
    ).toEqual({ "unsupported:Bath": 20000 });
  });

  it("counts duplicate row content and reports the range and phone time zone", () => {
    const row = [
      "Sleep",
      "2024-01-12 12:00",
      "2024-01-12 13:00",
      "",
      "",
      "",
      "",
      "",
    ];
    const result = readHuckleberry(csv([row, row]));
    expect(result.records).toHaveLength(1);
    expect(result.skipped).toEqual({ duplicateInFile: 1 });
    expect(result.start).toEqual(new Date(2024, 0, 12, 12));
    expect(result.end).toEqual(new Date(2024, 0, 12, 13));
    expect(result.timeZone).toBe(
      Intl.DateTimeFormat().resolvedOptions().timeZone
    );
  });

  it("uses the first real minute after a DST gap and the first repeated hour", () => {
    const previous = process.env.TZ;
    process.env.TZ = "America/New_York";
    try {
      expect(parseLocalTime("2024-03-10 02:40")?.toISOString()).toBe(
        "2024-03-10T07:00:00.000Z"
      );
      expect(parseLocalTime("2024-11-03 01:30")?.toISOString()).toBe(
        "2024-11-03T05:30:00.000Z"
      );
    } finally {
      process.env.TZ = previous;
    }
  });
});

it("omits stool colour for wet diapers", () => {
  const result = readHuckleberry(
    csv([
      ["Diaper", "2024-01-12 12:00", "", "yellow", "", "", "Pee", "synthetic"],
    ])
  );
  expect(result.records[0].input).not.toHaveProperty("stoolColor");
});
it.each([
  ["0:31R", ""],
  ["0:20R", "0:20L"],
])(
  "rejects breast side durations exceeding the completed feeding (%s, %s)",
  (right, left) => {
    const result = readHuckleberry(
      csv([
        [
          "Feed",
          "2024-01-12 12:00",
          "2024-01-12 12:30",
          "",
          right,
          "Breast",
          left,
          "synthetic",
        ],
      ])
    );
    expect(result.records).toHaveLength(0);
    expect(result.skipped).toEqual({ outsideLimits: 1 });
  }
);

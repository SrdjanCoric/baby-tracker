import { describe, expect, it } from "vitest";
import { ImportFileError } from "./huckleberry-reader";
import { readNara } from "./nara-reader";

// Header names mirror the permitted reference export; all values are synthetic.
const REFERENCE_HEADER = [
  "Type",
  "Profile Name",
  "Start Date/time",
  "Start Date/time (Epoch)",
  "Created By Caregiver",
  "Last Updated By Caregiver",
  "Note",
  "Time Zone",
  "[Bottle Feed] Type",
  "[Bottle Feed] Breast Milk Volume",
  "[Bottle Feed] Breast Milk Volume Unit",
  "[Bottle Feed] Formula Name",
  "[Bottle Feed] Formula Volume",
  "[Bottle Feed] Formula Volume Unit",
  "[Bottle Feed] Volume",
  "[Bottle Feed] Volume Unit",
  "[Diaper] Type",
  "[Diaper] Detail",
  "[Diaper] Dirty Color",
  "[Diaper] Dirty Texture",
  "[Sleep] Duration (Seconds)",
  "[Sleep] End Date/time",
  "[Sleep] End Date/time (Epoch)",
  "[Growth] Head Size",
  "[Growth] Head Size Unit",
  "[Growth] Height",
  "[Growth] Height Unit",
  "[Growth] Weight",
  "[Growth] Weight Unit",
  "[Solid Feed] Food",
  "[Solid Feed] Meal",
  "[Routine] Routine",
  "[Baby First] Baby First",
  "[Vaccine] Vaccine",
  "[Milestone] Milestone",
  "[Profile] Birth Date",
  "[Profile] Birth Date (Adjusted)",
  "[Profile] Sex",
  "[Profile] Type",
  "_familyKey",
  "_profileKey",
  "_activityKey",
];
// Additional fields are from GrekMaR/nara-baby-exporter's published field matrix.
const FULL_HEADER = [
  ...REFERENCE_HEADER,
  ...["[Breastfeed]", "[Combo Feed]"].flatMap((prefix) =>
    [
      "Begin Side",
      "End Side",
      "Left Duration (Seconds)",
      "Right Duration (Seconds)",
    ].map((field) => `${prefix} ${field}`)
  ),
  ...[
    "Type",
    "Breast Milk Volume",
    "Breast Milk Volume Unit",
    "Formula Volume",
    "Formula Volume Unit",
    "Volume",
    "Volume Unit",
  ].map((field) => `[Combo Feed] ${field}`),
  ...[
    "Duration (Seconds)",
    "End Date/time",
    "End Date/time (Epoch)",
    "Left Volume",
    "Left Volume Unit",
    "Right Volume",
    "Right Volume Unit",
    "Total Volume",
    "Total Volume Unit",
  ].map((field) => `[Pump] ${field}`),
];
const epoch = new Date("2024-01-12T12:00:00.123Z").getTime();
function csv(rows: Record<string, string>[], header = REFERENCE_HEADER) {
  const quote = (value: string) => `"${value.replaceAll('"', '""')}"`;
  return [
    header.map(quote).join(","),
    ...rows.map((row) => header.map((key) => quote(row[key] ?? "")).join(",")),
  ].join("\r\n");
}
function row(type: string, fields: Record<string, string> = {}) {
  return {
    Type: type,
    "Start Date/time (Epoch)": String(epoch),
    _activityKey: "synthetic-key",
    "Time Zone": "Europe/Belgrade",
    Note: 'synthetic "note"\nwith trailing space ',
    ...fields,
  };
}

describe("Nara named columns and bottle feeds", () => {
  it("reads a 42-column export with no breast, combo, or pump columns and preserves epochs and notes", () => {
    expect(REFERENCE_HEADER).toHaveLength(42);
    const result = readNara(
      csv([
        row("Bottle Feed", {
          "[Bottle Feed] Type": "Formula",
          "[Bottle Feed] Formula Volume": "80",
          "[Bottle Feed] Formula Volume Unit": "ML",
        }),
      ])
    );
    expect(result.skipped).toEqual({});
    expect(result.records).toHaveLength(1);
    expect(result.records[0]).toMatchObject({
      kind: "feeding",
      input: {
        type: "bottle",
        contentType: "formula",
        amountMl: 80,
        startedAt: new Date(epoch),
        notes: 'synthetic "note"\nwith trailing space ',
      },
    });
    expect(result.timeZone).toBe("Europe/Belgrade");
    expect(result.start).toEqual(new Date(epoch));
  });
  it("finds reordered columns and allows a known bottle content with an empty amount", () => {
    const result = readNara(
      csv(
        [row("Bottle Feed", { "[Bottle Feed] Type": "Breast Milk" })],
        [...REFERENCE_HEADER].reverse()
      )
    );
    expect(result.records[0]).toMatchObject({
      input: { type: "bottle", contentType: "breastMilk" },
    });
    expect(result.records[0].input).not.toHaveProperty("amountMl");
  });
  it("converts generic FLOZ volume without assigning content", () => {
    const result = readNara(
      csv([
        row("Bottle Feed", {
          "[Bottle Feed] Volume": "3",
          "[Bottle Feed] Volume Unit": "FLOZ",
        }),
      ])
    );
    expect(result.records[0]).toMatchObject({ input: { amountMl: 89 } });
    expect(result.records[0].input).not.toHaveProperty("contentType");
  });
  it.each(["Formula", "Breast Milk", "Breast Milk Formula"])(
    "keeps a generic-only %s bottle untyped",
    (type) => {
      const result = readNara(
        csv([
          row("Bottle Feed", {
            "[Bottle Feed] Type": type,
            "[Bottle Feed] Volume": "80",
            "[Bottle Feed] Volume Unit": "ML",
          }),
        ])
      );
      expect(result.records[0]).toMatchObject({ input: { amountMl: 80 } });
      expect(result.records[0].input).not.toHaveProperty("contentType");
    }
  );
  it("requires the three identifying columns and at least one row", () => {
    for (const field of ["Type", "Start Date/time (Epoch)", "_activityKey"]) {
      expect(() =>
        readNara(
          csv(
            [row("Profile")],
            REFERENCE_HEADER.filter((key) => key !== field)
          )
        )
      ).toThrow(ImportFileError);
    }
    expect(() => readNara(csv([]))).toThrow(ImportFileError);
  });
});

describe("Nara skip reasons and file boundaries", () => {
  it.each([
    "Solid Feed",
    "Medical",
    "Routine",
    "Milestone",
    "Baby First",
    "Vaccine",
    "Profile",
    "Other",
  ])("checks unsupported %s before its missing identity and time", (type) => {
    const result = readNara(csv([{ Type: type }]));
    expect(result.skipped).toEqual({ [`unsupported:${type}`]: 1 });
    expect(result.records).toEqual([]);
  });
  it.each([
    { _activityKey: "" },
    { "Start Date/time (Epoch)": "" },
    { "Start Date/time (Epoch)": "not-a-number" },
    { "Start Date/time (Epoch)": "99999999999999999" },
    { "[Bottle Feed] Formula Volume": "oops" },
    { "[Bottle Feed] Formula Volume Unit": "CUP" },
    { "[Bottle Feed] Formula Volume Unit": "toString" },
  ])("skips an unreadable supported row", (fields) => {
    const result = readNara(
      csv([
        row("Bottle Feed", {
          "[Bottle Feed] Type": "Formula",
          "[Bottle Feed] Formula Volume": "80",
          "[Bottle Feed] Formula Volume Unit": "ML",
          ...fields,
        }),
      ])
    );
    expect(result.skipped).toEqual({ couldNotRead: 1 });
    expect(result.records).toEqual([]);
  });
  it.each(["Sleep", "Pump"])(
    "rejects an end before its start for %s",
    (type) => {
      const result = readNara(
        csv(
          [
            row(type, {
              [`[${type}] End Date/time (Epoch)`]: String(epoch - 1),
              "[Pump] Total Volume": "40",
              "[Pump] Total Volume Unit": "ML",
            }),
          ],
          FULL_HEADER
        )
      );
      expect(result.skipped).toEqual({ couldNotRead: 1 });
    }
  );
  it("distinguishes a running sleep, future row, and outside-limit volume", () => {
    const result = readNara(
      csv([
        row("Sleep"),
        row("Bottle Feed", {
          _activityKey: "future",
          "Start Date/time (Epoch)": String(epoch + 1),
          "[Bottle Feed] Type": "Formula",
        }),
        row("Bottle Feed", {
          _activityKey: "large",
          "[Bottle Feed] Type": "Formula",
          "[Bottle Feed] Formula Volume": "501",
          "[Bottle Feed] Formula Volume Unit": "ML",
        }),
      ]),
      { now: new Date(epoch) }
    );
    expect(result.skipped).toEqual({
      stillRunning: 1,
      future: 1,
      outsideLimits: 1,
    });
  });
  it("rejects an unknown diaper type and empty growth", () => {
    expect(
      readNara(
        csv([row("Diaper", { "[Diaper] Type": "toString" }), row("Growth")])
      ).skipped
    ).toEqual({ couldNotRead: 2 });
  });
  it("treats activity keys as identity, keeps identical records with distinct keys, and lists exported zones", () => {
    const fields = {
      "[Bottle Feed] Type": "Formula",
      "[Bottle Feed] Formula Volume": "80",
      "[Bottle Feed] Formula Volume Unit": "ML",
    };
    const result = readNara(
      csv([
        row("Bottle Feed", fields),
        row("Bottle Feed", { ...fields, Note: "changed export note" }),
        row("Bottle Feed", {
          ...fields,
          _activityKey: "distinct",
          "Time Zone": "America/New_York",
        }),
      ])
    );
    expect(result.records).toHaveLength(2);
    expect(result.skipped).toEqual({ duplicateInFile: 1 });
    expect(result.timeZone).toBe("Europe/Belgrade, America/New_York");
  });
  it("shares BOM, quoted CSV, malformed-row and row-count handling with Huckleberry", () => {
    const source = csv([
      row("Bottle Feed", { "[Bottle Feed] Type": "Formula" }),
    ]);
    expect(readNara(`\ufeff${source}`).records).toHaveLength(1);
    expect(
      readNara(
        "Type,Start Date/time (Epoch),_activityKey\nBottle Feed,1,key,extra"
      ).skipped
    ).toEqual({ couldNotRead: 1 });
    expect(() =>
      readNara('Type,Start Date/time (Epoch),_activityKey\n"unterminated')
    ).toThrow(ImportFileError);
    expect(() =>
      readNara(
        "Type,Start Date/time (Epoch),_activityKey\n" +
          "Profile,,\n".repeat(20001)
      )
    ).toThrowError(expect.objectContaining({ reason: "fileTooLarge" }));
    expect(
      readNara(
        "Type,Start Date/time (Epoch),_activityKey\n" +
          "Profile,,\n".repeat(20000)
      ).skipped
    ).toEqual({ "unsupported:Profile": 20000 });
  });
});

describe("Nara sleep, diaper and growth mapping", () => {
  it("classifies epoch-based sleeps by the configured day/night hours and includes their end in the range", () => {
    const start = new Date(2024, 0, 12, 18, 0, 0, 123);
    const end = new Date(start.getTime() + 3600000);
    const source = csv([
      row("Sleep", {
        "Start Date/time (Epoch)": String(start.getTime()),
        "[Sleep] End Date/time (Epoch)": String(end.getTime()),
        "Start Date/time": "this display time is ignored",
        "Time Zone": Intl.DateTimeFormat().resolvedOptions().timeZone,
        "[Sleep] Duration (Seconds)": "1",
      }),
    ]);
    const result = readNara(source, { dayStartHour: 7, dayEndHour: 18 });
    expect(result.records[0]).toMatchObject({
      kind: "sleep",
      input: {
        type: "night",
        startedAt: start,
        endedAt: end,
        durationSeconds: 3600,
        notes: row("Sleep").Note,
      },
    });
    expect(result.end).toEqual(end);
    expect(
      readNara(source, { dayStartHour: 7, dayEndHour: 20 }).records[0]
    ).toMatchObject({ input: { type: "nap" } });
  });
  it.each([
    ["Dirty Wet", "mixed"],
    ["Wet", "wet"],
    ["Dirty", "dirty"],
    ["Dry", "dry"],
  ])(
    "maps %s diapers to %s and selects the first recognised colour",
    (naraType, type) => {
      const result = readNara(
        csv([
          row("Diaper", {
            "[Diaper] Type": naraType,
            "[Diaper] Dirty Color": "UNKNOWN GREEN YELLOW",
          }),
        ])
      );
      expect(result.records[0]).toMatchObject({
        kind: "diaper",
        input: {
          type,
          changedAt: new Date(epoch),
          notes: row("Diaper").Note,
        },
      });
      if (type === "dirty" || type === "mixed")
        expect(result.records[0].input).toHaveProperty("stoolColor", "green");
      else expect(result.records[0].input).not.toHaveProperty("stoolColor");
    }
  );
  it("leaves an unrecognised diaper colour empty", () => {
    const result = readNara(
      csv([
        row("Diaper", {
          "[Diaper] Type": "Dirty",
          "[Diaper] Dirty Color": "UNKNOWN",
        }),
      ])
    );
    expect(result.records[0].input).not.toHaveProperty("stoolColor");
  });
  it.each([
    {
      "[Growth] Weight": "5",
      "[Growth] Weight Unit": "KG",
      "[Growth] Height": "65",
      "[Growth] Height Unit": "CM",
      "[Growth] Head Size": "40",
      "[Growth] Head Size Unit": "CM",
    },
    {
      "[Growth] Weight": "11",
      "[Growth] Weight Unit": "LB",
      "[Growth] Height": "25",
      "[Growth] Height Unit": "IN",
      "[Growth] Head Size": "16",
      "[Growth] Head Size Unit": "IN",
    },
  ])("converts growth measurements to kg and cm", (fields) => {
    const result = readNara(csv([row("Growth", fields)]));
    expect(result.records[0]).toMatchObject({
      kind: "growth",
      input: { measuredAt: new Date(epoch), notes: row("Growth").Note },
    });
    const input = result.records[0].input;
    expect("weightKg" in input && input.weightKg).toBeCloseTo(
      fields["[Growth] Weight Unit"] === "KG" ? 5 : 11 * 0.45359237
    );
    expect("heightCm" in input && input.heightCm).toBe(
      fields["[Growth] Height Unit"] === "CM" ? 65 : 63.5
    );
    expect("headCircumferenceCm" in input && input.headCircumferenceCm).toBe(
      fields["[Growth] Head Size Unit"] === "CM" ? 40 : 40.64
    );
  });
  it.each([
    ["Weight", "18.125", "lb", { weightKg: 8.221 }],
    ["Weight", "8.5", "LBS", { weightKg: 3.856 }],
    ["Weight", "5200", "G", { weightKg: 5.2 }],
    ["Height", "25.5", "inch", { heightCm: 64.77 }],
    ["Height", "655", "MM", { heightCm: 65.5 }],
    ["Head Size", "40.123", "cm", { headCircumferenceCm: 40.12 }],
  ])(
    "reads %s %s written as %s and rounds to stored precision",
    (field, value, unit, expected) => {
      const result = readNara(
        csv([
          row("Growth", {
            [`[Growth] ${field}`]: value,
            [`[Growth] ${field} Unit`]: unit,
          }),
        ])
      );
      expect(result.skipped).toEqual({});
      expect(result.records[0].input).toMatchObject(expected);
    }
  );
  it.each([
    ["fl oz", 89],
    ["FL_OZ", 89],
    ["floz", 89],
    ["ml", 3],
  ])("reads bottle volume unit %s", (unit, amountMl) => {
    const result = readNara(
      csv([
        row("Bottle Feed", {
          "[Bottle Feed] Volume": "3",
          "[Bottle Feed] Volume Unit": unit,
        }),
      ])
    );
    expect(result.records[0].input).toMatchObject({ amountMl });
  });
  it("still reports an unknown unit as unreadable", () => {
    const result = readNara(
      csv([
        row("Growth", {
          "[Growth] Weight": "5",
          "[Growth] Weight Unit": "STONE",
        }),
      ])
    );
    expect(result.skipped).toEqual({ couldNotRead: 1 });
  });
  it.each(["Weight", "Height", "Head Size"])(
    "imports a growth row containing only %s",
    (field) => {
      const result = readNara(
        csv([
          row("Growth", {
            [`[Growth] ${field}`]: field === "Weight" ? "5" : "40",
            [`[Growth] ${field} Unit`]: field === "Weight" ? "KG" : "CM",
          }),
        ])
      );
      expect(result.skipped).toEqual({});
      expect(result.records).toHaveLength(1);
    }
  );
});

describe("Nara breast, combo and pumping mapping", () => {
  it("imports a breast feed with only one side duration present", () => {
    const result = readNara(
      csv(
        [
          row("Breastfeed", {
            "[Breastfeed] Right Duration (Seconds)": "600",
            "[Breastfeed] Begin Side": "RIGHT.nonTimer",
          }),
        ],
        FULL_HEADER
      )
    );
    expect(result.records[0]).toMatchObject({
      input: {
        side: "right",
        durationSeconds: 600,
        leftDurationSeconds: 0,
        rightDurationSeconds: 600,
      },
    });
  });
  it.each([
    ["600", "0", "left"],
    ["0", "480", "right"],
    ["120", "240", "both"],
  ])(
    "derives breast side and end from %s left and %s right seconds",
    (left, right, side) => {
      const result = readNara(
        csv(
          [
            row("Breastfeed", {
              "[Breastfeed] Left Duration (Seconds)": left,
              "[Breastfeed] Right Duration (Seconds)": right,
              "[Breastfeed] Begin Side": "LEFT.nonTimer",
              "[Breastfeed] End Side": "RIGHT.nonTimer",
            }),
          ],
          FULL_HEADER
        )
      );
      const durationSeconds = Number(left) + Number(right);
      expect(result.records[0]).toMatchObject({
        kind: "feeding",
        input: {
          type: "breast",
          side,
          leftDurationSeconds: Number(left),
          rightDurationSeconds: Number(right),
          durationSeconds,
          endedAt: new Date(epoch + durationSeconds * 1000),
          notes: row("Breastfeed").Note,
        },
      });
    }
  );
  it("splits a mixed bottle into two records with separate identities", () => {
    const result = readNara(
      csv([
        row("Bottle Feed", {
          "[Bottle Feed] Type": "Breast Milk Formula",
          "[Bottle Feed] Breast Milk Volume": "40",
          "[Bottle Feed] Breast Milk Volume Unit": "ML",
          "[Bottle Feed] Formula Volume": "2",
          "[Bottle Feed] Formula Volume Unit": "FLOZ",
        }),
      ])
    );
    expect(result.records).toHaveLength(2);
    expect(result.records[0]).toMatchObject({
      input: { contentType: "breastMilk", amountMl: 40 },
    });
    expect(result.records[1]).toMatchObject({
      input: { contentType: "formula", amountMl: 59 },
    });
    expect(result.records[0].content).not.toBe(result.records[1].content);
  });
  it.each(["Formula", "Breast Milk", "Breast Milk Formula", "generic"])(
    "maps a Combo Feed with %s bottles from its own columns",
    (type) => {
      const fields: Record<string, string> = {
        "[Combo Feed] Left Duration (Seconds)": "120",
        "[Combo Feed] Right Duration (Seconds)": "240",
        "[Combo Feed] Type": type,
        "[Combo Feed] Breast Milk Volume": "40",
        "[Combo Feed] Breast Milk Volume Unit": "ML",
        "[Combo Feed] Formula Volume": "50",
        "[Combo Feed] Formula Volume Unit": "ML",
        "[Bottle Feed] Formula Volume": "450",
        "[Bottle Feed] Formula Volume Unit": "ML",
      };
      if (type === "generic") {
        delete fields["[Combo Feed] Breast Milk Volume"];
        delete fields["[Combo Feed] Formula Volume"];
        fields["[Combo Feed] Volume"] = "60";
        fields["[Combo Feed] Volume Unit"] = "ML";
      }
      const result = readNara(csv([row("Combo Feed", fields)], FULL_HEADER));
      expect(result.skipped).toEqual({});
      expect(result.records).toHaveLength(
        type === "Breast Milk Formula" ? 3 : 2
      );
      expect(result.records[0]).toMatchObject({
        input: { type: "breast", durationSeconds: 360, side: "both" },
      });
      expect(
        result.records
          .slice(1)
          .map((record) => "amountMl" in record.input && record.input.amountMl)
      ).toEqual(
        type === "Breast Milk Formula"
          ? [40, 50]
          : [type === "Formula" ? 50 : type === "Breast Milk" ? 40 : 60]
      );
      expect(new Set(result.records.map((record) => record.content)).size).toBe(
        result.records.length
      );
      for (const record of result.records)
        expect(record.input.notes).toBe(row("Combo Feed").Note);
    }
  );
  it.each([
    { left: "20", right: "30", total: "99", side: "both", expected: 50 },
    { left: "20", right: "", total: "", side: "left", expected: 20 },
    { left: "", right: "30", total: "", side: "right", expected: 30 },
    { left: "0", right: "30", total: "", side: "right", expected: 30 },
    { left: "", right: "", total: "3", side: "both", expected: 89 },
  ])(
    "maps pump volumes and side: $side",
    ({ left, right, total, side, expected }) => {
      const result = readNara(
        csv(
          [
            row("Pump", {
              "[Pump] Left Volume": left,
              "[Pump] Left Volume Unit": "ML",
              "[Pump] Right Volume": right,
              "[Pump] Right Volume Unit": "ML",
              "[Pump] Total Volume": total,
              "[Pump] Total Volume Unit": left || right ? "ML" : "FLOZ",
              "[Pump] Duration (Seconds)": "600",
            }),
          ],
          FULL_HEADER
        )
      );
      expect(result.records[0]).toMatchObject({
        kind: "pumping",
        input: {
          volumeMl: expected,
          side,
          durationSeconds: 600,
          endedAt: new Date(epoch + 600000),
          notes: row("Pump").Note,
        },
      });
    }
  );
  it("uses pump end epoch ahead of a stale duration and floors stored seconds", () => {
    const result = readNara(
      csv(
        [
          row("Pump", {
            "[Pump] Total Volume": "40",
            "[Pump] Total Volume Unit": "ML",
            "[Pump] End Date/time (Epoch)": String(epoch + 600123),
            "[Pump] Duration (Seconds)": "1",
          }),
        ],
        FULL_HEADER
      )
    );
    expect(result.records[0]).toMatchObject({
      input: { endedAt: new Date(epoch + 600123), durationSeconds: 600 },
    });
  });
  it("rounds the combined pumping volume after converting both sides from FLOZ", () => {
    const result = readNara(
      csv(
        [
          row("Pump", {
            "[Pump] Left Volume": "0.25",
            "[Pump] Left Volume Unit": "FLOZ",
            "[Pump] Right Volume": "0.25",
            "[Pump] Right Volume Unit": "FLOZ",
            "[Pump] Duration (Seconds)": "600",
          }),
        ],
        FULL_HEADER
      )
    );
    expect(result.records[0]).toMatchObject({
      input: { volumeMl: 15, side: "both" },
    });
  });
  it("keeps a volume-only pumping row without inventing a duration", () => {
    const result = readNara(
      csv(
        [
          row("Pump", {
            "[Pump] Total Volume": "40",
            "[Pump] Total Volume Unit": "ML",
          }),
        ],
        FULL_HEADER
      )
    );
    expect(result.records[0]).toMatchObject({
      input: { volumeMl: 40, side: "both" },
    });
    expect(result.records[0].input).not.toHaveProperty("endedAt");
    expect(result.records[0].input).not.toHaveProperty("durationSeconds");
  });
});

it("floors every Nara duration while preserving exact end epochs", () => {
  const result = readNara(
    csv(
      [
        row("Sleep", {
          _activityKey: "sleep",
          "[Sleep] End Date/time (Epoch)": String(epoch + 600123),
        }),
        row("Pump", {
          _activityKey: "pump-end",
          "[Pump] Total Volume": "90",
          "[Pump] Total Volume Unit": "ML",
          "[Pump] End Date/time (Epoch)": String(epoch + 600123),
        }),
        row("Pump", {
          _activityKey: "pump-duration",
          "[Pump] Total Volume": "90",
          "[Pump] Total Volume Unit": "ML",
          "[Pump] Duration (Seconds)": "600.9",
        }),
        ...["Breastfeed", "Combo Feed"].map((type) =>
          row(type, {
            _activityKey: type,
            [`[${type}] Left Duration (Seconds)`]: "120.9",
            [`[${type}] Right Duration (Seconds)`]: "240.8",
            "[Combo Feed] Type": "Formula",
          })
        ),
      ],
      FULL_HEADER
    )
  );
  expect(result.skipped).toEqual({});
  expect(result.records).toHaveLength(6);
  for (const { input } of result.records) {
    for (const field of [
      "durationSeconds",
      "leftDurationSeconds",
      "rightDurationSeconds",
    ] as const) {
      if (field in input) expect(Number.isInteger(input[field])).toBe(true);
    }
  }
  expect(result.records[0].input).toMatchObject({
    durationSeconds: 600,
    endedAt: new Date(epoch + 600123),
  });
  expect(result.records[1].input).toMatchObject({
    durationSeconds: 600,
    endedAt: new Date(epoch + 600123),
  });
  expect(result.records[3].input).toMatchObject({
    durationSeconds: 360,
    leftDurationSeconds: 120,
    rightDurationSeconds: 240,
    endedAt: new Date(epoch + 361700),
  });
});

it("floors durations before checking the sleep minimum and maximum", () => {
  const result = readNara(
    csv([
      row("Sleep", {
        _activityKey: "short",
        "[Sleep] End Date/time (Epoch)": String(epoch + 59900),
      }),
      row("Sleep", {
        _activityKey: "max",
        "[Sleep] End Date/time (Epoch)": String(epoch + 86400900),
      }),
    ])
  );
  expect(result.skipped).toEqual({ outsideLimits: 1 });
  expect(result.records[0].input).toMatchObject({ durationSeconds: 86400 });
});

it("uses pump Total when both side volumes are zero", () => {
  const result = readNara(
    csv(
      [
        row("Pump", {
          "[Pump] Left Volume": "0",
          "[Pump] Left Volume Unit": "ML",
          "[Pump] Right Volume": "0",
          "[Pump] Right Volume Unit": "ML",
          "[Pump] Total Volume": "90",
          "[Pump] Total Volume Unit": "ML",
        }),
      ],
      FULL_HEADER
    )
  );
  expect(result.skipped).toEqual({});
  expect(result.records[0].input).toMatchObject({ volumeMl: 90, side: "both" });
});

it.each(["Formula", "Breast Milk"])(
  "imports a mixed bottle with only its %s volume",
  (type) => {
    const result = readNara(
      csv([
        row("Bottle Feed", {
          "[Bottle Feed] Type": "Breast Milk Formula",
          [`[Bottle Feed] ${type} Volume`]: "90",
          [`[Bottle Feed] ${type} Volume Unit`]: "ML",
        }),
      ])
    );
    expect(result.skipped).toEqual({});
    expect(result.records).toHaveLength(1);
    expect(result.records[0]).toMatchObject({
      content: JSON.stringify(["synthetic-key", "record"]),
      input: {
        amountMl: 90,
        contentType: type === "Formula" ? "formula" : "breastMilk",
      },
    });
  }
);

it("classifies sleeps using the exported time zone and its boundaries", () => {
  const start = Date.parse("2024-01-13T01:00:00Z");
  const source = (zone: string, hours = 1) =>
    csv([
      row("Sleep", {
        "Start Date/time (Epoch)": String(start),
        "[Sleep] End Date/time (Epoch)": String(start + hours * 3600000),
        "Time Zone": zone,
      }),
    ]);
  expect(
    readNara(source("America/Los_Angeles")).records[0].input
  ).toMatchObject({ type: "nap" });
  expect(readNara(source("America/Toronto")).records[0].input).toMatchObject({
    type: "night",
  });
  expect(
    readNara(source("America/Los_Angeles", 5)).records[0].input
  ).toMatchObject({ type: "night" });
  expect(
    readNara(source("America/Los_Angeles"), { dayStartHour: 6, dayEndHour: 6 })
      .records[0].input
  ).toMatchObject({ type: "night" });
  const fallback = readNara(source("")).records[0].input;
  expect(readNara(source("invalid/zone")).records[0].input).toEqual(fallback);
});

it("classifies zoned sleep across a skipped daylight-saving boundary", () => {
  const start = Date.parse("2024-03-10T06:30:00Z");
  const result = readNara(
    csv([
      row("Sleep", {
        "Start Date/time (Epoch)": String(start),
        "[Sleep] End Date/time (Epoch)": String(start + 7200000),
        "Time Zone": "America/New_York",
      }),
    ]),
    { dayStartHour: 2, dayEndHour: 19 }
  );
  expect(result.records[0].input).toMatchObject({
    type: "nap",
    durationSeconds: 7200,
  });
});

it("reports breast feeds with missing durations as unreadable and explicit zero as outside limits", () => {
  const missing = readNara(csv([row("Breastfeed")], FULL_HEADER));
  expect(missing.skipped).toEqual({ couldNotRead: 1 });
  const zero = readNara(
    csv(
      [row("Breastfeed", { "[Breastfeed] Left Duration (Seconds)": "0" })],
      FULL_HEADER
    )
  );
  expect(zero.skipped).toEqual({ outsideLimits: 1 });
});

it.each([true, false])(
  "uses the device zone when export zones are missing (column present: %s)",
  (columnPresent) => {
    const header = columnPresent
      ? REFERENCE_HEADER
      : REFERENCE_HEADER.filter((key) => key !== "Time Zone");
    const result = readNara(
      csv(
        [
          row("Bottle Feed", {
            "[Bottle Feed] Type": "Formula",
            "Time Zone": "",
          }),
        ],
        header
      )
    );
    expect(result.timeZone).toBe(
      Intl.DateTimeFormat().resolvedOptions().timeZone
    );
  }
);

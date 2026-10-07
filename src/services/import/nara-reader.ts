import {
  ImportFileError,
  parseCsv,
  type HuckleberryPreview,
  type HuckleberryRecord,
} from "./huckleberry-reader";
import {
  validateBottleAmount,
  validateManualFeedingDuration,
} from "@/validators/feeding";
import {
  validateManualPumpingDuration,
  validateManualPumpingVolume,
} from "@/validators/pumping";
import { validateManualSleepDuration } from "@/validators/sleep";
import {
  validateWeightKg,
  validateHeightCm,
  validateHeadCircumferenceCm,
} from "@/validators/growth";
import { classifySleepByTimeRange } from "@/utils/sleep-patterns";
import { isValidStoolColor } from "@/constants/activities";
import {
  LENGTH_CM,
  toStoredPrecision,
  unitFactor,
  VOLUME_ML,
  WEIGHT_KG,
} from "./import-units";

type Row = Record<string, string>;
type Options = { now?: Date; dayStartHour?: number; dayEndHour?: number };
class RowError extends Error {}
function required<T>(value: T | undefined): T {
  if (value === undefined || value === "") throw new RowError("couldNotRead");
  return value;
}
function number(value: string | undefined): number | undefined {
  if (value === undefined || value === "") return undefined;
  if (!/^\d+(?:\.\d+)?$/.test(value)) throw new RowError("couldNotRead");
  const result = Number(value);
  if (!Number.isFinite(result)) throw new RowError("couldNotRead");
  return result;
}
function epoch(value: string | undefined): Date | undefined {
  const ms = number(value);
  if (ms === undefined) return undefined;
  const date = new Date(ms);
  if (!Number.isFinite(date.getTime())) throw new RowError("couldNotRead");
  return date;
}
function withinLimits(...errors: (string | null)[]) {
  if (errors.some(Boolean)) throw new RowError("outsideLimits");
}
function quantity(
  row: Row,
  field: string,
  units: Record<string, number>
): number | undefined {
  const value = number(row[field]);
  if (value === undefined) return undefined;
  const factor = unitFactor(units, row[`${field} Unit`]);
  if (factor === undefined) throw new RowError("couldNotRead");
  return value * factor;
}
function volume(row: Row, field: string) {
  const value = quantity(row, field, VOLUME_ML);
  return value === undefined ? undefined : Math.round(value);
}
function identity(row: Row, part: string) {
  return JSON.stringify([row._activityKey, part]);
}
function bottles(
  row: Row,
  startedAt: Date,
  prefix: string
): HuckleberryRecord[] {
  const singlePart = prefix === "[Combo Feed]" ? "bottle" : "record";
  const type = row[`${prefix} Type`];
  const generic = volume(row, `${prefix} Volume`);
  const breast = volume(row, `${prefix} Breast Milk Volume`);
  const formula = volume(row, `${prefix} Formula Volume`);
  const make = (
    part: string,
    amountMl?: number,
    contentType?: "formula" | "breastMilk"
  ): HuckleberryRecord => {
    if (amountMl !== undefined)
      withinLimits(validateBottleAmount(amountMl, "bottle"));
    return {
      kind: "feeding",
      content: identity(row, part),
      input: {
        startedAt,
        notes: row.Note,
        type: "bottle",
        ...(amountMl === undefined ? {} : { amountMl }),
        ...(contentType ? { contentType } : {}),
      },
    };
  };
  if (generic !== undefined && breast === undefined && formula === undefined)
    return [make(singlePart, generic)];
  if (
    type === "Breast Milk Formula" &&
    breast !== undefined &&
    formula !== undefined
  ) {
    return [
      make("bottle:breastMilk", breast, "breastMilk"),
      make("bottle:formula", formula, "formula"),
    ];
  }
  if (type === "Breast Milk Formula") {
    if (formula !== undefined) return [make(singlePart, formula, "formula")];
    if (breast !== undefined) return [make(singlePart, breast, "breastMilk")];
  }
  if (type === "Formula") return [make(singlePart, formula, "formula")];
  if (type === "Breast Milk") return [make(singlePart, breast, "breastMilk")];
  if (generic !== undefined) return [make(singlePart, generic)];
  throw new RowError("couldNotRead");
}

function breast(row: Row, startedAt: Date, prefix: string): HuckleberryRecord {
  const left = number(row[`${prefix} Left Duration (Seconds)`]);
  const right = number(row[`${prefix} Right Duration (Seconds)`]);
  if (left === undefined && right === undefined)
    throw new RowError("couldNotRead");
  const leftDurationSeconds = Math.floor(left ?? 0);
  const rightDurationSeconds = Math.floor(right ?? 0);
  const durationSeconds = leftDurationSeconds + rightDurationSeconds;
  withinLimits(validateManualFeedingDuration(durationSeconds));
  return {
    kind: "feeding",
    content: identity(row, prefix === "[Combo Feed]" ? "breast" : "record"),
    input: {
      type: "breast",
      startedAt,
      notes: row.Note,
      endedAt: new Date(
        startedAt.getTime() + ((left ?? 0) + (right ?? 0)) * 1000
      ),
      durationSeconds,
      leftDurationSeconds,
      rightDurationSeconds,
      side:
        leftDurationSeconds > 0
          ? rightDurationSeconds > 0
            ? "both"
            : "left"
          : "right",
    },
  };
}

function mapRow(
  row: Row,
  startedAt: Date,
  options: Options
): HuckleberryRecord[] {
  const notes = row.Note;
  const content = identity(row, "record");
  switch (row.Type) {
    case "Breastfeed":
      return [breast(row, startedAt, "[Breastfeed]")];
    case "Bottle Feed":
      return bottles(row, startedAt, "[Bottle Feed]");
    case "Combo Feed":
      return [
        breast(row, startedAt, "[Combo Feed]"),
        ...bottles(row, startedAt, "[Combo Feed]"),
      ];
    case "Sleep": {
      const endedAt = epoch(row["[Sleep] End Date/time (Epoch)"]);
      if (!endedAt) throw new RowError("stillRunning");
      if (endedAt < startedAt) throw new RowError("couldNotRead");
      const durationSeconds = Math.floor(
        (endedAt.getTime() - startedAt.getTime()) / 1000
      );
      withinLimits(validateManualSleepDuration(durationSeconds));
      return [
        {
          kind: "sleep",
          content,
          ...(row["Time Zone"] ? { timeZone: row["Time Zone"] } : {}),
          input: {
            startedAt,
            endedAt,
            durationSeconds,
            notes,
            type: classifySleepByTimeRange(
              startedAt,
              endedAt,
              options.dayStartHour ?? 6,
              options.dayEndHour ?? 19,
              row["Time Zone"]
            ),
          },
        },
      ];
    }
    case "Diaper": {
      const types = {
        "Dirty Wet": "mixed",
        Wet: "wet",
        Dirty: "dirty",
        Dry: "dry",
      } as const;
      if (!Object.prototype.hasOwnProperty.call(types, row["[Diaper] Type"]))
        throw new RowError("couldNotRead");
      const type = types[row["[Diaper] Type"] as keyof typeof types];
      const stoolColor =
        type === "dirty" || type === "mixed"
          ? (row["[Diaper] Dirty Color"] ?? "")
              .split(" ")
              .map((word) => word.toLowerCase())
              .find(isValidStoolColor)
          : undefined;
      return [
        {
          kind: "diaper",
          content,
          input: {
            changedAt: startedAt,
            notes,
            type,
            ...(stoolColor ? { stoolColor } : {}),
          },
        },
      ];
    }
    case "Growth": {
      const weightKg = toStoredPrecision(
        quantity(row, "[Growth] Weight", WEIGHT_KG),
        3
      );
      const heightCm = toStoredPrecision(
        quantity(row, "[Growth] Height", LENGTH_CM),
        2
      );
      const headCircumferenceCm = toStoredPrecision(
        quantity(row, "[Growth] Head Size", LENGTH_CM),
        2
      );
      if (
        weightKg === undefined &&
        heightCm === undefined &&
        headCircumferenceCm === undefined
      )
        throw new RowError("couldNotRead");
      withinLimits(
        validateWeightKg(weightKg),
        validateHeightCm(heightCm),
        validateHeadCircumferenceCm(headCircumferenceCm)
      );
      return [
        {
          kind: "growth",
          content,
          input: {
            measuredAt: startedAt,
            notes,
            ...(weightKg === undefined ? {} : { weightKg }),
            ...(heightCm === undefined ? {} : { heightCm }),
            ...(headCircumferenceCm === undefined
              ? {}
              : { headCircumferenceCm }),
          },
        },
      ];
    }
    case "Pump": {
      const left = quantity(row, "[Pump] Left Volume", VOLUME_ML);
      const right = quantity(row, "[Pump] Right Volume", VOLUME_ML);
      const sides = (left ?? 0) + (right ?? 0);
      const amount =
        sides > 0
          ? sides
          : required(quantity(row, "[Pump] Total Volume", VOLUME_ML));
      const volumeMl = Math.round(amount);
      const end = epoch(row["[Pump] End Date/time (Epoch)"]);
      if (end && end < startedAt) throw new RowError("couldNotRead");
      const rawDurationSeconds = end
        ? (end.getTime() - startedAt.getTime()) / 1000
        : number(row["[Pump] Duration (Seconds)"]);
      const durationSeconds =
        rawDurationSeconds === undefined
          ? undefined
          : Math.floor(rawDurationSeconds);
      withinLimits(
        validateManualPumpingVolume(volumeMl),
        durationSeconds === undefined
          ? null
          : validateManualPumpingDuration(durationSeconds)
      );
      const endedAt =
        end ??
        (durationSeconds === undefined
          ? undefined
          : new Date(startedAt.getTime() + rawDurationSeconds! * 1000));
      return [
        {
          kind: "pumping",
          content,
          input: {
            startedAt,
            notes,
            volumeMl,
            side:
              (left ?? 0) > 0
                ? (right ?? 0) > 0
                  ? "both"
                  : "left"
                : (right ?? 0) > 0
                  ? "right"
                  : "both",
            ...(endedAt ? { endedAt, durationSeconds } : {}),
          },
        },
      ];
    }
    default:
      throw new RowError(`unsupported:${row.Type}`);
  }
}

export function readNara(
  csv: string,
  options: Options = {}
): HuckleberryPreview {
  const [header, ...rows] = parseCsv(csv);
  if (
    !header ||
    !rows.length ||
    !["Type", "Start Date/time (Epoch)", "_activityKey"].every((key) =>
      header.includes(key)
    )
  )
    throw new ImportFileError("invalidFile");
  const preview: HuckleberryPreview = {
    source: "nara",
    records: [],
    skipped: {},
    timeZone: "",
  };
  const zones = new Set<string>();
  const seen = new Set<string>();
  for (const cells of rows) {
    const row = Object.fromEntries(header.map((key, i) => [key, cells[i]]));
    try {
      if (
        ![
          "Breastfeed",
          "Bottle Feed",
          "Combo Feed",
          "Sleep",
          "Diaper",
          "Pump",
          "Growth",
        ].includes(row.Type)
      )
        throw new RowError(`unsupported:${row.Type}`);
      if (cells.length !== header.length) throw new RowError("couldNotRead");
      required(row._activityKey);
      const startedAt = required(epoch(row["Start Date/time (Epoch)"]));
      if (startedAt > (options.now ?? new Date())) throw new RowError("future");
      const records = mapRow(row, startedAt, options);
      if (seen.has(row._activityKey)) throw new RowError("duplicateInFile");
      seen.add(row._activityKey);
      preview.records.push(...records);
      if (row["Time Zone"]) zones.add(row["Time Zone"]);
      if (!preview.start || startedAt < preview.start)
        preview.start = startedAt;
      for (const record of records) {
        const end =
          "endedAt" in record.input
            ? (record.input.endedAt ?? startedAt)
            : startedAt;
        if (!preview.end || end > preview.end) preview.end = end;
      }
    } catch (error) {
      if (!(error instanceof RowError)) throw error;
      preview.skipped[error.message] =
        (preview.skipped[error.message] ?? 0) + 1;
    }
  }
  preview.timeZone =
    [...zones].join(", ") || Intl.DateTimeFormat().resolvedOptions().timeZone;
  return preview;
}

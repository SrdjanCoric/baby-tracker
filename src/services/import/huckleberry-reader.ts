import { classifySleepByTimeRange } from "@/utils/sleep-patterns";
import { validateManualSleepDuration } from "@/validators/sleep";
import {
  validateBottleAmount,
  validateFoodType,
  validateManualFeedingDuration,
} from "@/validators/feeding";
import {
  validateWeightKg,
  validateHeightCm,
  validateHeadCircumferenceCm,
} from "@/validators/growth";
import {
  validateManualPumpingDuration,
  validateManualPumpingVolume,
} from "@/validators/pumping";
import { validateManualTummyTimeDuration } from "@/validators/tummyTime";
import {
  DOSAGE_UNITS,
  isValidStoolColor,
  type DosageUnit,
} from "@/constants/activities";
import type { CreateSleepInput } from "../sleep-storage";
import type { CreateFeedingInput } from "../feeding-storage";
import type { CreateDiaperInput } from "../diaper-storage";
import type { CreateGrowthInput } from "../growth-storage";
import type { CreatePumpingInput } from "../pumping-storage";
import type { CreateHealthInput } from "../health-storage";
import type { CreateTummyTimeInput } from "../tummyTime-storage";

export const HUCKLEBERRY_HEADER = [
  "Type",
  "Start",
  "End",
  "Duration",
  "Start Condition",
  "Start Location",
  "End Condition",
  "Notes",
];

type RecordOf<K, I> = {
  kind: K;
  content: string;
  input: Omit<I, "babyId" | "id">;
};
export type HuckleberryRecord =
  | RecordOf<"sleep", CreateSleepInput>
  | RecordOf<"feeding", CreateFeedingInput>
  | RecordOf<"diaper", CreateDiaperInput>
  | RecordOf<"growth", CreateGrowthInput>
  | RecordOf<"pumping", CreatePumpingInput>
  | RecordOf<"health", CreateHealthInput>
  | RecordOf<"tummyTime", CreateTummyTimeInput>;

export interface HuckleberryPreview {
  records: HuckleberryRecord[];
  skipped: Record<string, number>;
  timeZone: string;
  start?: Date;
  end?: Date;
}

export class ImportFileError extends Error {
  constructor(public readonly reason: "invalidFile" | "fileTooLarge") {
    super(reason);
  }
}

function parseCsv(csv: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  let closed = false;
  for (let i = csv.charCodeAt(0) === 0xfeff ? 1 : 0; i < csv.length; i++) {
    const char = csv[i];
    if (quoted) {
      if (char !== '"') cell += char;
      else if (csv[i + 1] === '"') {
        cell += '"';
        i++;
      } else {
        quoted = false;
        closed = true;
      }
    } else if (char === '"' && cell === "" && !closed) {
      quoted = true;
    } else if (char === "," || char === "\n" || char === "\r") {
      row.push(cell);
      cell = "";
      closed = false;
      if (char !== ",") {
        if (row.some((value) => value !== "")) rows.push(row);
        row = [];
        if (char === "\r" && csv[i + 1] === "\n") i++;
        if (rows.length > 20001) throw new ImportFileError("fileTooLarge");
      }
    } else {
      if (closed || char === '"') throw new ImportFileError("invalidFile");
      cell += char;
    }
  }
  if (quoted) throw new ImportFileError("invalidFile");
  row.push(cell);
  if (row.some((value) => value !== "")) rows.push(row);
  if (rows.length > 20001) throw new ImportFileError("fileTooLarge");
  return rows;
}

export function parseLocalTime(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const [year, month, day, hour, minute] = match.slice(1).map(Number);
  const calendar = new Date(Date.UTC(year, month - 1, day, hour, minute));
  if (
    calendar.getUTCFullYear() !== year ||
    calendar.getUTCMonth() !== month - 1 ||
    calendar.getUTCDate() !== day ||
    hour > 23 ||
    minute > 59
  )
    return null;
  const date = new Date(year, month - 1, day, hour, minute);
  if (date.getHours() !== hour || date.getMinutes() !== minute) {
    // Date normalizes gaps by their size. Walk back to the first real minute after the gap.
    const wallTime = (d: Date) =>
      Date.UTC(
        d.getFullYear(),
        d.getMonth(),
        d.getDate(),
        d.getHours(),
        d.getMinutes()
      );
    while (wallTime(new Date(date.getTime() - 60000)) > calendar.getTime()) {
      date.setTime(date.getTime() - 60000);
    }
  }
  return date;
}

class RowError extends Error {
  constructor(public readonly reason: string) {
    super(reason);
  }
}

function required<T>(value: T | null | undefined): T {
  if (value === null || value === undefined || value === "")
    throw new RowError("couldNotRead");
  return value;
}

function withinLimits(...errors: (string | null)[]): void {
  if (errors.some(Boolean)) throw new RowError("outsideLimits");
}

function quantity(
  value: string,
  units: Record<string, number>
): number | undefined {
  if (!value) return undefined;
  const match = /^(\d+(?:\.\d+)?)\s*([a-z.]+)$/.exec(value.trim());
  if (!match || units[match[2]] === undefined)
    throw new RowError("couldNotRead");
  return Number(match[1]) * units[match[2]];
}

function minutes(value: string, suffix = ""): number | undefined {
  if (!value) return undefined;
  const match = new RegExp(`^(\\d+):([0-5]\\d)${suffix}$`).exec(value);
  if (!match) throw new RowError("couldNotRead");
  return Number(match[1]) * 3600 + Number(match[2]) * 60;
}

const VOLUME_UNITS = { ml: 1, oz: 29.5735 };
function volume(value: string): number | undefined {
  const amount = quantity(value, VOLUME_UNITS);
  return amount === undefined ? undefined : Math.round(amount);
}

function mapRow(
  row: string[],
  startedAt: Date,
  endedAt: Date | undefined,
  options: {
    dayStartHour?: number;
    dayEndHour?: number;
  }
): HuckleberryRecord {
  const [type, , , duration, condition, location, endCondition, notes] = row;
  const content = JSON.stringify(row);
  const base = { startedAt, notes };
  const completed = () => {
    if (!endedAt) throw new RowError("stillRunning");
    return {
      ...base,
      endedAt,
      durationSeconds: (endedAt.getTime() - startedAt.getTime()) / 1000,
    };
  };
  switch (type) {
    case "Sleep": {
      const input = completed();
      withinLimits(validateManualSleepDuration(input.durationSeconds));
      return {
        kind: "sleep",
        content,
        input: {
          ...input,
          type: classifySleepByTimeRange(
            startedAt,
            input.endedAt,
            options.dayStartHour ?? 6,
            options.dayEndHour ?? 19
          ),
        },
      };
    }
    case "Feed": {
      if (location === "Bottle") {
        const amountMl = required(volume(endCondition));
        withinLimits(validateBottleAmount(amountMl, "bottle"));
        if (!["Formula", "Breast Milk", "Mixed"].includes(condition))
          throw new RowError("couldNotRead");
        return {
          kind: "feeding",
          content,
          input: {
            ...base,
            type: "bottle",
            amountMl,
            ...(condition !== "Mixed"
              ? {
                  contentType:
                    condition === "Formula" ? "formula" : "breastMilk",
                }
              : {}),
          },
        };
      }
      if (location !== "Breast") throw new RowError("couldNotRead");
      const input = completed();
      const rightDurationSeconds = minutes(condition, "R");
      const leftDurationSeconds = minutes(endCondition, "L");
      if (
        rightDurationSeconds === undefined &&
        leftDurationSeconds === undefined
      )
        throw new RowError("couldNotRead");
      withinLimits(validateManualFeedingDuration(input.durationSeconds));
      if (
        (leftDurationSeconds ?? 0) + (rightDurationSeconds ?? 0) >
        input.durationSeconds
      )
        throw new RowError("outsideLimits");
      return {
        kind: "feeding",
        content,
        input: {
          ...input,
          type: "breast",
          leftDurationSeconds,
          rightDurationSeconds,
          side:
            leftDurationSeconds === undefined
              ? "right"
              : rightDurationSeconds === undefined
                ? "left"
                : "both",
        },
      };
    }
    case "Solids": {
      const foodType = required(condition);
      withinLimits(validateFoodType(foodType));
      return {
        kind: "feeding",
        content,
        input: { ...base, type: "solid", foodType },
      };
    }
    case "Diaper": {
      const match = /^(Pee|Poo|Both)(?:\b|:)/.exec(endCondition);
      if (!match) throw new RowError("couldNotRead");
      const colour = duration === "mustard" ? "yellow" : duration;
      return {
        kind: "diaper",
        content,
        input: {
          changedAt: startedAt,
          notes,
          type:
            match[1] === "Pee" ? "wet" : match[1] === "Poo" ? "dirty" : "mixed",
          ...(match[1] !== "Pee" && isValidStoolColor(colour)
            ? { stoolColor: colour }
            : {}),
        },
      };
    }
    case "Growth": {
      const weightKg = quantity(condition, { kg: 1, lb: 0.45359237 });
      const heightCm = quantity(location, { cm: 1, in: 2.54, "ft.in": 30.48 });
      const headCircumferenceCm = quantity(endCondition, { cm: 1, in: 2.54 });
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
      return {
        kind: "growth",
        content,
        input: {
          measuredAt: startedAt,
          notes,
          weightKg,
          heightCm,
          headCircumferenceCm,
        },
      };
    }
    case "Pump": {
      const left = quantity(condition, VOLUME_UNITS);
      const right = quantity(endCondition, VOLUME_UNITS);
      if (left === undefined && right === undefined)
        throw new RowError("couldNotRead");
      const volumeMl = Math.round((left ?? 0) + (right ?? 0));
      const durationSeconds = minutes(duration);
      withinLimits(
        validateManualPumpingVolume(volumeMl),
        durationSeconds === undefined
          ? null
          : validateManualPumpingDuration(durationSeconds)
      );
      return {
        kind: "pumping",
        content,
        input: {
          ...base,
          volumeMl,
          side:
            left === undefined
              ? "right"
              : right === undefined
                ? "left"
                : "both",
          ...(durationSeconds !== undefined
            ? {
                durationSeconds,
                endedAt: new Date(startedAt.getTime() + durationSeconds * 1000),
              }
            : {}),
        },
      };
    }
    case "Meds": {
      const medicationName = required(location);
      const match = /^(\d+(?:\.\d+)?)\s*(\S+)$/.exec(condition.trim());
      const dose =
        match && DOSAGE_UNITS.includes(match[2] as DosageUnit)
          ? {
              dosageAmount: Number(match[1]),
              dosageUnit: match[2] as DosageUnit,
            }
          : {};
      return {
        kind: "health",
        content,
        input: {
          loggedAt: startedAt,
          notes,
          type: "medication",
          medicationName,
          ...dose,
        },
      };
    }
    case "Tummy time": {
      const input = completed();
      withinLimits(validateManualTummyTimeDuration(input.durationSeconds));
      return { kind: "tummyTime", content, input };
    }
    default:
      throw new RowError(`unsupported:${type}`);
  }
}

export function readHuckleberry(
  csv: string,
  options: {
    now?: Date;
    dayStartHour?: number;
    dayEndHour?: number;
  } = {}
): HuckleberryPreview {
  const rows = parseCsv(csv);
  if (
    rows.length < 2 ||
    JSON.stringify(rows[0]) !== JSON.stringify(HUCKLEBERRY_HEADER)
  ) {
    throw new ImportFileError("invalidFile");
  }
  const preview: HuckleberryPreview = {
    records: [],
    skipped: {},
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  };
  const skip = (reason: string) => {
    preview.skipped[reason] = (preview.skipped[reason] ?? 0) + 1;
  };
  const seen = new Set<string>();
  for (const row of rows.slice(1)) {
    const [type, start, end] = row;
    if (
      ![
        "Sleep",
        "Feed",
        "Solids",
        "Diaper",
        "Growth",
        "Pump",
        "Meds",
        "Tummy time",
      ].includes(type)
    ) {
      skip(`unsupported:${type}`);
      continue;
    }
    const startedAt = parseLocalTime(start);
    if (row.length !== 8 || !startedAt) {
      skip("couldNotRead");
      continue;
    }
    if (startedAt > (options.now ?? new Date())) {
      skip("future");
      continue;
    }
    const endedAt = end ? parseLocalTime(end) : undefined;
    if (endedAt === null || (endedAt && endedAt < startedAt)) {
      skip("couldNotRead");
      continue;
    }
    let record: HuckleberryRecord;
    try {
      record = mapRow(row, startedAt, endedAt, options);
    } catch (error) {
      if (!(error instanceof RowError)) throw error;
      skip(error.reason);
      continue;
    }
    if (seen.has(record.content)) {
      skip("duplicateInFile");
      continue;
    }
    seen.add(record.content);
    preview.records.push(record);
    if (!preview.start || startedAt < preview.start) preview.start = startedAt;
    const rangeEnd =
      "endedAt" in record.input
        ? (record.input.endedAt ?? startedAt)
        : startedAt;
    if (!preview.end || rangeEnd > preview.end) preview.end = rangeEnd;
  }
  return preview;
}

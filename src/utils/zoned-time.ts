export interface WallTime {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

const formatters = new Map<string, Intl.DateTimeFormat | null>();

/** Reads wall-clock time in an IANA zone; undefined for an empty or invalid zone. */
export function zonedWallTime(
  timeZone?: string
): ((date: Date) => WallTime) | undefined {
  if (!timeZone) return undefined;
  if (!formatters.has(timeZone)) {
    try {
      formatters.set(
        timeZone,
        new Intl.DateTimeFormat("en", {
          timeZone,
          year: "numeric",
          month: "numeric",
          day: "numeric",
          hour: "numeric",
          minute: "numeric",
          second: "numeric",
          hourCycle: "h23",
        })
      );
    } catch {
      formatters.set(timeZone, null);
    }
  }
  const formatter = formatters.get(timeZone);
  if (!formatter) return undefined;
  return (date) => {
    const values = Object.fromEntries(
      formatter.formatToParts(date).map((part) => [part.type, part.value])
    );
    return {
      year: Number(values.year),
      month: Number(values.month),
      day: Number(values.day),
      hour: Number(values.hour),
      minute: Number(values.minute),
      second: Number(values.second),
    };
  };
}

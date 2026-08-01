export interface CompletedSleepDayWindow {
  keys: string[];
  start: Date;
  end: Date;
}

function localDateKey(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function getCompletedSleepDayWindow(
  days: number,
  now: Date,
  dayStartHour: number
): CompletedSleepDayWindow {
  const end = new Date(now);
  end.setHours(dayStartHour, 0, 0, 0);
  if (now < end) {
    end.setDate(end.getDate() - 1);
  }

  const start = new Date(end);
  start.setDate(start.getDate() - days);

  const keys = Array.from({ length: days }, (_, index) => {
    const date = new Date(start);
    date.setDate(date.getDate() + index);
    return localDateKey(date);
  });

  return { keys, start, end };
}

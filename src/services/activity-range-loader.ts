export interface UtcActivityRange {
  start: string;
  end: string;
}

export type ActivityRangeStatus = "unverified" | "loading" | "loaded" | "error";

type Listener = () => void;

interface InFlightRange {
  range: UtcActivityRange;
  promise: Promise<void>;
}

function intersects(left: UtcActivityRange, right: UtcActivityRange): boolean {
  return left.start < right.end && right.start < left.end;
}

function mergeRanges(ranges: UtcActivityRange[]): UtcActivityRange[] {
  const sorted = [...ranges].sort((left, right) => left.start.localeCompare(right.start));
  const merged: UtcActivityRange[] = [];

  for (const range of sorted) {
    const previous = merged.at(-1);
    if (!previous || previous.end < range.start) {
      merged.push({ ...range });
      continue;
    }
    if (range.end > previous.end) previous.end = range.end;
  }

  return merged;
}

function subtractRange(
  requested: UtcActivityRange,
  coverage: UtcActivityRange[]
): UtcActivityRange[] {
  let cursor = requested.start;
  const missing: UtcActivityRange[] = [];

  for (const covered of mergeRanges(coverage)) {
    if (covered.end <= cursor || covered.start >= requested.end) continue;
    if (covered.start > cursor) {
      missing.push({ start: cursor, end: covered.start });
    }
    if (covered.end > cursor) cursor = covered.end;
    if (cursor >= requested.end) break;
  }

  if (cursor < requested.end) missing.push({ start: cursor, end: requested.end });
  return missing;
}

export class ActivityRangeLoader<T> {
  private loaded: UtcActivityRange[] = [];
  private inFlight: InFlightRange[] = [];
  private failed: UtcActivityRange[] = [];
  private listeners = new Set<Listener>();
  private generation = 0;

  constructor(
    private readonly fetchRange: (range: UtcActivityRange) => Promise<T[]>,
    private readonly acceptEntries: (entries: T[]) => void
  ) {}

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  status(range: UtcActivityRange): ActivityRangeStatus {
    if (subtractRange(range, this.loaded).length === 0) return "loaded";
    if (this.failed.some((failed) => intersects(failed, range))) return "error";
    if (this.inFlight.some((pending) => intersects(pending.range, range))) return "loading";
    return "unverified";
  }

  async load(range: UtcActivityRange): Promise<void> {
    if (range.start >= range.end) throw new Error("Activity range must be half-open and non-empty");

    this.failed = this.failed.filter((failed) => !intersects(failed, range));
    const existingPromises = this.inFlight
      .filter((pending) => intersects(pending.range, range))
      .map((pending) => pending.promise);
    const coverage = [
      ...this.loaded,
      ...this.inFlight.map((pending) => pending.range),
    ];
    const missing = subtractRange(range, coverage);
    const generation = this.generation;
    const started = missing.map((missingRange) => this.start(missingRange, generation));
    this.emit();
    await Promise.all([...existingPromises, ...started]);
  }

  markLoaded(range: UtcActivityRange): void {
    this.loaded = mergeRanges([...this.loaded, range]);
    this.failed = this.failed.filter((failed) => !intersects(failed, range));
    this.emit();
  }

  deactivate(): void {
    this.generation += 1;
    this.inFlight = [];
    this.failed = [];
    this.emit();
  }

  reset(): void {
    this.generation += 1;
    this.loaded = [];
    this.inFlight = [];
    this.failed = [];
    this.emit();
  }

  private start(range: UtcActivityRange, generation: number): Promise<void> {
    const promise = this.fetchRange(range)
      .then((entries) => {
        if (generation !== this.generation) return;
        this.acceptEntries(entries);
        this.loaded = mergeRanges([...this.loaded, range]);
      })
      .catch((error: unknown) => {
        if (generation === this.generation) {
          this.failed = mergeRanges([...this.failed, range]);
        }
        throw error;
      })
      .finally(() => {
        if (generation === this.generation) {
          this.inFlight = this.inFlight.filter((pending) => pending.promise !== promise);
          this.emit();
        }
      });

    this.inFlight.push({ range, promise });
    return promise;
  }

  private emit(): void {
    for (const listener of this.listeners) listener();
  }
}

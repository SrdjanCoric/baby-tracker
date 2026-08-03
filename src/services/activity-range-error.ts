export class ActivityRangeLoadError extends Error {
  readonly cause: unknown;

  constructor(cause: unknown) {
    super(cause instanceof Error ? cause.message : "Failed to fetch activity range");
    this.name = "ActivityRangeLoadError";
    this.cause = cause;
  }
}

export async function ensureActivityRangesLoaded(
  loadRanges: () => Promise<void>
): Promise<void> {
  try {
    await loadRanges();
  } catch (error) {
    if (error instanceof ActivityRangeLoadError) throw error;
    throw new ActivityRangeLoadError(error);
  }
}

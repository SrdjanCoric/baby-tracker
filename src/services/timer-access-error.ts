export class TimerAccessUnavailableError extends Error {
  readonly code = "TIMER_ACCESS_UNAVAILABLE";
  constructor(
    readonly reason: "signed_out" | "revoked",
    readonly accountMismatch = false
  ) {
    super("Timer access is unavailable");
    this.name = "TimerAccessUnavailableError";
  }
}

export function isTimerAccessUnavailable(
  error: unknown
): error is TimerAccessUnavailableError {
  return error instanceof TimerAccessUnavailableError;
}

import {
  readExternalTimerCommands,
  type ExternalTimerCommand,
} from "./external-timer-command-service";

export type TimerStopActivityType =
  | "feeding"
  | "sleep"
  | "pumping"
  | "tummy_time";

export interface PendingTimerStop {
  id: string;
  activityType: string;
  stoppedAt: string;
  babyId: string;
  timerInstanceId: string;
  legacy?: boolean;
}

export interface RestoredTimer {
  isRunning: boolean;
  startTime: Date;
  timerInstanceId?: string;
}

export type PendingTimerStopResult = "waiting" | "consumed" | "stale";

function toPendingTimerStop(
  command: ExternalTimerCommand
): PendingTimerStop {
  return {
    id: command.id,
    activityType: command.activityType,
    stoppedAt: command.eventAt,
    babyId: command.babyId,
    timerInstanceId: command.timerInstanceId,
    legacy: command.legacy,
  };
}

export async function readPendingTimerStop(
  activityType?: TimerStopActivityType,
  babyId?: string
): Promise<PendingTimerStop | null> {
  const commands = await readExternalTimerCommands(babyId);
  const command = commands.find(
    (candidate) =>
      (!activityType || candidate.activityType === activityType) &&
      (!babyId || candidate.babyId === babyId)
  );
  return command ? toPendingTimerStop(command) : null;
}

export function isPendingStopForTimer(
  pending: PendingTimerStop | null,
  activityType: TimerStopActivityType,
  timerStartTime: Date,
  babyId?: string,
  timerInstanceId?: string
): boolean {
  if (
    !pending ||
    pending.activityType !== activityType ||
    pending.babyId !== babyId
  ) {
    return false;
  }

  if (
    !pending.legacy ||
    !pending.timerInstanceId.startsWith("legacy:")
  ) {
    return pending.timerInstanceId === timerInstanceId;
  }

  const stoppedAtMs = new Date(pending.stoppedAt).getTime();
  const startedAtMs = timerStartTime.getTime();
  return (
    Number.isFinite(stoppedAtMs) &&
    Number.isFinite(startedAtMs) &&
    startedAtMs <= stoppedAtMs
  );
}

export function isTimerRestoreObsolete(
  stopVersionAtStart: number,
  currentStopVersion: number,
  isStopping: boolean
): boolean {
  return isStopping || stopVersionAtStart !== currentStopVersion;
}

export async function processPendingTimerStop(
  pending: PendingTimerStop,
  timer: RestoredTimer | null | undefined,
  stop: (endTime: Date) => Promise<unknown>,
  babyId?: string
): Promise<PendingTimerStopResult> {
  if (pending.babyId !== babyId) return "waiting";
  if (!timer?.isRunning) return "waiting";

  const stoppedAt = new Date(pending.stoppedAt);
  if (
    !Number.isFinite(stoppedAt.getTime()) ||
    timer.startTime.getTime() > stoppedAt.getTime()
  ) {
    return "stale";
  }
  if (
    (!pending.legacy || !pending.timerInstanceId.startsWith("legacy:")) &&
    pending.timerInstanceId !== timer.timerInstanceId
  ) {
    return "stale";
  }

  await stop(stoppedAt);
  return "consumed";
}

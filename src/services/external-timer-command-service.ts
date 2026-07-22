import { loadExtensionStorage } from "@/services/extension-storage";

const APP_GROUP = "group.com.sofibaby.app";
const LEGACY_PENDING_STOP_KEY = "pendingWidgetStop";
const SELECTED_BABY_ID_KEY = "selectedBabyId";
export const EXTERNAL_TIMER_COMMAND_QUEUE_KEY = "externalTimerCommandQueue";
export const EXTERNAL_TIMER_COMMAND_QUEUE_VERSION = 1;

export type ExternalTimerCommandActivityType =
  | "feeding"
  | "sleep"
  | "pumping"
  | "tummy_time";

export type ExternalTimerCommandSource =
  | "widget"
  | "watch"
  | "routed"
  | "legacy";

export interface ExternalTimerCommand {
  id: string;
  action: "stop";
  activityType: ExternalTimerCommandActivityType;
  babyId: string;
  timerInstanceId: string;
  eventAt: string;
  source: ExternalTimerCommandSource;
  legacy?: boolean;
  payload?: {
    volumeMl?: number;
  };
}

interface ExternalTimerCommandQueue {
  version: typeof EXTERNAL_TIMER_COMMAND_QUEUE_VERSION;
  commands: ExternalTimerCommand[];
}

let mutationQueue: Promise<void> = Promise.resolve();
const listeners = new Set<() => void>();

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

function isExternalTimerCommand(value: unknown): value is ExternalTimerCommand {
  if (!value || typeof value !== "object") return false;
  const command = value as Partial<ExternalTimerCommand>;
  const validActivity =
    command.activityType === "feeding" ||
    command.activityType === "sleep" ||
    command.activityType === "pumping" ||
    command.activityType === "tummy_time";
  const validSource =
    command.source === "widget" ||
    command.source === "watch" ||
    command.source === "routed" ||
    command.source === "legacy";
  const eventTime = isNonEmptyString(command.eventAt)
    ? new Date(command.eventAt).getTime()
    : Number.NaN;

  return (
    isNonEmptyString(command.id) &&
    command.action === "stop" &&
    validActivity &&
    isNonEmptyString(command.babyId) &&
    isNonEmptyString(command.timerInstanceId) &&
    Number.isFinite(eventTime) &&
    validSource &&
    (command.payload?.volumeMl === undefined ||
      (typeof command.payload.volumeMl === "number" &&
        Number.isFinite(command.payload.volumeMl) &&
        command.payload.volumeMl >= 0))
  );
}

function parseQueue(raw: string | null): ExternalTimerCommandQueue {
  if (!raw) {
    return { version: EXTERNAL_TIMER_COMMAND_QUEUE_VERSION, commands: [] };
  }

  try {
    const parsed = JSON.parse(raw) as Partial<ExternalTimerCommandQueue>;
    if (
      parsed.version !== EXTERNAL_TIMER_COMMAND_QUEUE_VERSION ||
      !Array.isArray(parsed.commands)
    ) {
      return { version: EXTERNAL_TIMER_COMMAND_QUEUE_VERSION, commands: [] };
    }
    return {
      version: EXTERNAL_TIMER_COMMAND_QUEUE_VERSION,
      commands: parsed.commands.filter(isExternalTimerCommand),
    };
  } catch {
    return { version: EXTERNAL_TIMER_COMMAND_QUEUE_VERSION, commands: [] };
  }
}

export function createRoutedExternalTimerCommand(
  url: string,
  eventAt: string
): ExternalTimerCommand | null {
  const activity = /^sofibaby:\/\/([^/?#]+)/.exec(url)?.[1];
  const query = url.split("?", 2)[1]?.split("#", 1)[0];
  if (!query || !Number.isFinite(new Date(eventAt).getTime())) return null;
  const params = new Map<string, string>();
  try {
    for (const entry of query.split("&")) {
      const [key, value = ""] = entry.split("=", 2);
      params.set(decodeURIComponent(key), decodeURIComponent(value));
    }
  } catch {
    return null;
  }
  const babyId = params.get("babyId");
  const timerInstanceId = params.get("timerInstanceId");
  const commandId = params.get("commandId");
  const activityType = activity === "tummyTime" ? "tummy_time" : activity;
  if (
    params.get("action") !== "stop" ||
    !isNonEmptyString(babyId) ||
    !isNonEmptyString(timerInstanceId) ||
    !isNonEmptyString(commandId) ||
    (activityType !== "feeding" &&
      activityType !== "sleep" &&
      activityType !== "pumping" &&
      activityType !== "tummy_time")
  ) {
    return null;
  }
  return {
    id: commandId,
    action: "stop",
    activityType,
    babyId,
    timerInstanceId,
    eventAt,
    source: "routed",
  };
}

function parseLegacyStop(
  raw: string,
  selectedBabyId: string | null
): ExternalTimerCommand | null {
  try {
    const legacy = JSON.parse(raw) as {
      activityType?: unknown;
      stoppedAt?: unknown;
      babyId?: unknown;
    };
    const activityType = legacy.activityType;
    const validActivity =
      activityType === "feeding" ||
      activityType === "sleep" ||
      activityType === "pumping" ||
      activityType === "tummy_time";
    const babyId = isNonEmptyString(legacy.babyId)
      ? legacy.babyId
      : selectedBabyId;
    if (
      !validActivity ||
      !isNonEmptyString(legacy.stoppedAt) ||
      !Number.isFinite(new Date(legacy.stoppedAt).getTime()) ||
      !isNonEmptyString(babyId)
    ) {
      return null;
    }

    const compatibilityId = `legacy:${babyId}:${activityType}:${legacy.stoppedAt}`;
    return {
      id: compatibilityId,
      action: "stop",
      activityType,
      babyId,
      timerInstanceId: compatibilityId,
      eventAt: legacy.stoppedAt,
      source: "legacy",
      legacy: true,
    };
  } catch {
    return null;
  }
}

async function withMutationLock<T>(operation: () => Promise<T>): Promise<T> {
  const result = mutationQueue.then(operation, operation);
  mutationQueue = result.then(
    () => undefined,
    () => undefined
  );
  return result;
}

export async function readExternalTimerCommands(
  fallbackBabyId?: string
): Promise<ExternalTimerCommand[]> {
  return withMutationLock(async () => {
    const extensionStorage = await loadExtensionStorage();
    if (!extensionStorage) return [];
    const queue = parseQueue(
      await extensionStorage.get(EXTERNAL_TIMER_COMMAND_QUEUE_KEY, APP_GROUP)
    );
    const legacyRaw = await extensionStorage.get(
      LEGACY_PENDING_STOP_KEY,
      APP_GROUP
    );
    if (!legacyRaw) return queue.commands;

    const selectedBabyId =
      (await extensionStorage.get(SELECTED_BABY_ID_KEY, APP_GROUP)) ??
      fallbackBabyId ??
      null;
    const legacyCommand = parseLegacyStop(legacyRaw, selectedBabyId);
    if (
      legacyCommand &&
      !queue.commands.some((command) => command.id === legacyCommand.id)
    ) {
      queue.commands.push(legacyCommand);
      await extensionStorage.set(
        EXTERNAL_TIMER_COMMAND_QUEUE_KEY,
        JSON.stringify(queue),
        APP_GROUP
      );
    }
    await extensionStorage.set(LEGACY_PENDING_STOP_KEY, "", APP_GROUP);
    return queue.commands;
  });
}

export async function appendExternalTimerCommand(
  command: ExternalTimerCommand
): Promise<void> {
  if (!isExternalTimerCommand(command)) return;

  await withMutationLock(async () => {
    const extensionStorage = await loadExtensionStorage();
    if (!extensionStorage) return;
    const queue = parseQueue(
      await extensionStorage.get(EXTERNAL_TIMER_COMMAND_QUEUE_KEY, APP_GROUP)
    );
    if (queue.commands.some((queued) => queued.id === command.id)) return;
    queue.commands.push(command);
    await extensionStorage.set(
      EXTERNAL_TIMER_COMMAND_QUEUE_KEY,
      JSON.stringify(queue),
      APP_GROUP
    );
    listeners.forEach((listener) => listener());
  });
}

export function subscribeExternalTimerCommands(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export async function claimLegacyExternalTimerCommand(
  expected: ExternalTimerCommand,
  timerInstanceId: string
): Promise<ExternalTimerCommand> {
  if (!expected.legacy || !isNonEmptyString(timerInstanceId)) return expected;

  return withMutationLock(async () => {
    const extensionStorage = await loadExtensionStorage();
    if (!extensionStorage) return expected;
    const queue = parseQueue(
      await extensionStorage.get(EXTERNAL_TIMER_COMMAND_QUEUE_KEY, APP_GROUP)
    );
    const index = queue.commands.findIndex(
      (command) => command.id === expected.id
    );
    if (index === -1) return expected;
    const claimed = { ...queue.commands[index], timerInstanceId };
    queue.commands[index] = claimed;
    await extensionStorage.set(
      EXTERNAL_TIMER_COMMAND_QUEUE_KEY,
      JSON.stringify(queue),
      APP_GROUP
    );
    return claimed;
  });
}

export async function acknowledgeExternalTimerCommand(
  expected: ExternalTimerCommand
): Promise<void> {
  await withMutationLock(async () => {
    const extensionStorage = await loadExtensionStorage();
    if (!extensionStorage) return;
    const queue = parseQueue(
      await extensionStorage.get(EXTERNAL_TIMER_COMMAND_QUEUE_KEY, APP_GROUP)
    );
    const commands = queue.commands.filter(
      (command) => command.id !== expected.id
    );
    if (commands.length === queue.commands.length) return;
    await extensionStorage.set(
      EXTERNAL_TIMER_COMMAND_QUEUE_KEY,
      JSON.stringify({ ...queue, commands }),
      APP_GROUP
    );
  });
}

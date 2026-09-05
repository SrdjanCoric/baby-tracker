import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import type { TimerActivityType } from "./active-timer-service";
import { getUserScopedKey } from "./storage-prefix";

const COMPLETIONS_KEY_PREFIX = "@timer_completions:";
const MAX_COMPLETIONS_PER_TIMER_TYPE = 20;

export interface TimerIdentity {
  timerInstanceId: string;
  activityId: string;
}

export interface TimerCompletionRecord extends TimerIdentity {
  babyId: string;
  activityType: TimerActivityType;
  startedAt: string;
  stoppedAt: string;
  status: "pending" | "completed";
}

function getCompletionsKey(babyId: string, activityType: TimerActivityType): string {
  return getUserScopedKey(`${COMPLETIONS_KEY_PREFIX}${babyId}:${activityType}`);
}

async function deterministicUuid(value: string): Promise<string> {
  const hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, value);
  const variant = ((Number.parseInt(hash[16], 16) & 0x3) | 0x8).toString(16);
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-5${hash.slice(13, 16)}-${variant}${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

async function getCompletionRecords(
  babyId: string,
  activityType: TimerActivityType
): Promise<TimerCompletionRecord[]> {
  const raw = await AsyncStorage.getItem(getCompletionsKey(babyId, activityType));
  if (!raw) return [];

  try {
    return JSON.parse(raw) as TimerCompletionRecord[];
  } catch {
    return [];
  }
}

async function saveCompletionRecords(
  babyId: string,
  activityType: TimerActivityType,
  records: TimerCompletionRecord[]
): Promise<void> {
  await AsyncStorage.setItem(
    getCompletionsKey(babyId, activityType),
    JSON.stringify(records.slice(-MAX_COMPLETIONS_PER_TIMER_TYPE))
  );
}

export async function deriveTimerActivityId(timerInstanceId: string): Promise<string> {
  return deterministicUuid(`timer-activity:${timerInstanceId}`);
}

export async function createTimerIdentity(): Promise<TimerIdentity> {
  const timerInstanceId = Crypto.randomUUID();
  return {
    timerInstanceId,
    activityId: await deriveTimerActivityId(timerInstanceId),
  };
}

export async function resolveTimerIdentity(
  babyId: string,
  activityType: TimerActivityType,
  startedAt: string,
  timerData?: Partial<TimerIdentity>
): Promise<TimerIdentity> {
  if (typeof timerData?.timerInstanceId === "string") {
    return {
      timerInstanceId: timerData.timerInstanceId,
      activityId: await deriveTimerActivityId(timerData.timerInstanceId),
    };
  }

  const compatibilitySeed = `${babyId}:${activityType}:${startedAt}`;
  const timerInstanceId = await deterministicUuid(`timer:${compatibilitySeed}`);
  return {
    timerInstanceId,
    activityId: await deriveTimerActivityId(timerInstanceId),
  };
}

export async function acceptTimerCompletion(
  babyId: string,
  activityType: TimerActivityType,
  startedAt: string,
  identity: TimerIdentity,
  requestedStopTime: Date
): Promise<TimerCompletionRecord> {
  const records = await getCompletionRecords(babyId, activityType);
  const existing = records.find(record => record.timerInstanceId === identity.timerInstanceId);
  if (existing) return existing;

  const activityId = await deriveTimerActivityId(identity.timerInstanceId);

  const record: TimerCompletionRecord = {
    timerInstanceId: identity.timerInstanceId,
    activityId,
    babyId,
    activityType,
    startedAt,
    stoppedAt: requestedStopTime.toISOString(),
    status: "pending",
  };
  await saveCompletionRecords(babyId, activityType, [...records, record]);
  return record;
}

export async function markTimerCompletionDurable(
  completion: TimerCompletionRecord
): Promise<TimerCompletionRecord> {
  const records = await getCompletionRecords(completion.babyId, completion.activityType);
  const durableCompletion: TimerCompletionRecord = { ...completion, status: "completed" };
  const nextRecords = records.some(
    record => record.timerInstanceId === completion.timerInstanceId
  )
    ? records.map(record =>
        record.timerInstanceId === completion.timerInstanceId ? durableCompletion : record
      )
    : [...records, durableCompletion];
  await saveCompletionRecords(completion.babyId, completion.activityType, nextRecords);
  return durableCompletion;
}

export async function getTimerCompletion(
  babyId: string,
  activityType: TimerActivityType,
  timerInstanceId: string
): Promise<TimerCompletionRecord | null> {
  const records = await getCompletionRecords(babyId, activityType);
  return records.find(record => record.timerInstanceId === timerInstanceId) ?? null;
}

export async function isTimerCompletionSecured(
  babyId: string,
  activityType: TimerActivityType,
  identity: TimerIdentity,
  completedActivities: ReadonlyArray<{ id: string }>
): Promise<boolean> {
  if (completedActivities.some(activity => activity.id === identity.activityId)) return true;
  return (
    await getTimerCompletion(babyId, activityType, identity.timerInstanceId)
  )?.status === "completed";
}

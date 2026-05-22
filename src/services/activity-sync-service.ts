import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import { supabase } from "./supabase";
import { getUserScopedKey } from "./storage-prefix";
import { getSyncEngine } from "@/contexts/sync-context";
import type { SyncableTable } from "./sync/types";
import type { StoredFeedingEntry, CreateFeedingInput, UpdateFeedingInput } from "./feeding-storage";
import type { StoredDiaperEntry, CreateDiaperInput, UpdateDiaperInput } from "./diaper-storage";
import type { StoredSleepEntry, CreateSleepInput, UpdateSleepInput } from "./sleep-storage";
import type { StoredPumpingEntry, CreatePumpingInput, UpdatePumpingInput } from "./pumping-storage";
import type { StoredGrowthEntry, CreateGrowthInput, UpdateGrowthInput } from "./growth-storage";
import type { StoredTummyTimeEntry, CreateTummyTimeInput, UpdateTummyTimeInput } from "./tummyTime-storage";
import type { StoredMilestoneResponse, MilestoneState } from "./milestones-storage";
import type { StoredHealthEntry, CreateHealthInput, UpdateHealthInput } from "./health-storage";
import type { AchievementId } from "./achievement-detection";
import type { SyncEngine } from "./sync/sync-engine";

function getPendingCreateIds(engine: SyncEngine | null, table: SyncableTable): Set<string> {
  if (!engine) return new Set();
  return engine.getPendingEntityIds(table);
}

function mergeWithPendingLocal<T extends { id: string }>(
  serverEntries: T[],
  localEntries: T[],
  pendingIds: Set<string>
): T[] {
  if (pendingIds.size === 0) return serverEntries;
  const serverIds = new Set(serverEntries.map(e => e.id));
  const unsyncedLocal = localEntries.filter(
    l => !serverIds.has(l.id) && pendingIds.has(l.id)
  );
  if (unsyncedLocal.length === 0) return serverEntries;
  return [...serverEntries, ...unsyncedLocal];
}

const storageLocks = new Map<string, Promise<void>>();

function withStorageLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = storageLocks.get(key) ?? Promise.resolve();
  const next = prev.then(fn, fn);
  storageLocks.set(key, next.then(() => {}, () => {}));
  return next;
}

const KEYS = {
  feedings: "@feedings:",
  diapers: "@diapers:",
  sleep: "@sleeps:",
  pumping: "@pumpings:",
  growth: "@growth:",
  tummyTime: "@tummyTimes:",
  milestones: "@milestones:",
  health: "@health:",
  achievements: "@achievements:",
};

function generateId(): string {
  return Crypto.randomUUID();
}

function isValidUUID(id: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
}

function ensureUUID(id: string): string {
  if (isValidUUID(id)) {
    return id;
  }
  return generateId();
}

async function queueSyncOperation(operation: {
  type: 'CREATE' | 'UPDATE' | 'DELETE';
  table: SyncableTable;
  entityId: string;
  data: Record<string, unknown> | null;
}): Promise<void> {
  const engine = getSyncEngine();
  if (!engine) {
    await writeDirectlyToDatabase(operation);
    return;
  }

  const authContext = engine.getAuthContext();
  if (!authContext) {
    await writeDirectlyToDatabase(operation);
    return;
  }

  try {
    await engine.enqueueOperation({
      id: '',
      type: operation.type,
      table: operation.table,
      entityId: operation.entityId,
      data: operation.data,
      timestamp: new Date().toISOString(),
      retryCount: 0,
    });
    engine.sync().catch(() => {});
  } catch {
    await writeDirectlyToDatabase(operation);
  }
}

async function writeDirectlyToDatabase(operation: {
  type: 'CREATE' | 'UPDATE' | 'DELETE';
  table: string;
  entityId: string;
  data: Record<string, unknown> | null;
}): Promise<void> {
  const { table, type, entityId, data } = operation;

  try {
    switch (type) {
      case 'CREATE': {
        if (!data) throw new Error('CREATE requires data');
        const { error } = await supabase.from(table).insert(data);
        if (error && error.code !== '23505') {
          console.error(`[ActivitySync] Direct CREATE failed for ${table}:`, error.message);
        }
        break;
      }
      case 'UPDATE': {
        if (!data) throw new Error('UPDATE requires data');
        const { error } = await supabase.from(table).update(data).eq('id', entityId);
        if (error) {
          console.error(`[ActivitySync] Direct UPDATE failed for ${table}:`, error.message);
        }
        break;
      }
      case 'DELETE': {
        const { error } = await supabase.from(table).delete().eq('id', entityId);
        if (error) {
          console.error(`[ActivitySync] Direct DELETE failed for ${table}:`, error.message);
        }
        break;
      }
    }
  } catch (error) {
    console.error('[ActivitySync] Direct database operation failed:', error);
  }
}

// ============ FEEDINGS ============

export async function fetchFeedingsFromDatabase(babyId: string): Promise<StoredFeedingEntry[]> {
  const { data, error } = await supabase
    .from("feedings")
    .select("*")
    .eq("baby_id", babyId)
    .order("started_at", { ascending: false });

  if (error) {
    console.error("[ActivitySync] Failed to fetch feedings:", error.message);
    throw new Error("Failed to fetch feedings");
  }

  const serverFeedings: StoredFeedingEntry[] = (data || []).map(transformFeedingFromDb);
  const pendingIds = getPendingCreateIds(getSyncEngine(), 'feedings');
  const localData = await AsyncStorage.getItem(getUserScopedKey(`${KEYS.feedings}${babyId}`));
  const localFeedings: StoredFeedingEntry[] = localData ? JSON.parse(localData) : [];
  const feedings = mergeWithPendingLocal(serverFeedings, localFeedings, pendingIds);
  await AsyncStorage.setItem(getUserScopedKey(`${KEYS.feedings}${babyId}`), JSON.stringify(feedings));
  return feedings;
}

export async function createFeedingInDatabase(
  input: CreateFeedingInput,
  userId: string
): Promise<StoredFeedingEntry> {
  const now = new Date().toISOString();
  const id = generateId();

  const feeding: StoredFeedingEntry = {
    id,
    babyId: input.babyId,
    type: input.type,
    side: input.side,
    lastFinishedSide: input.lastFinishedSide,
    startedAt: input.startedAt.toISOString(),
    endedAt: input.endedAt?.toISOString(),
    durationSeconds: input.durationSeconds,
    leftDurationSeconds: input.leftDurationSeconds,
    rightDurationSeconds: input.rightDurationSeconds,
    amountMl: input.amountMl,
    contentType: input.contentType,
    foodType: input.foodType,
    amount: input.amount,
    reaction: input.reaction,
    notes: input.notes,
    loggedBy: userId,
    createdAt: now,
    updatedAt: now,
  };

  await updateLocalFeedings(input.babyId, (feedings) => [...feedings, feeding]);

  await queueSyncOperation({
    type: 'CREATE',
    table: 'feedings',
    entityId: id,
    data: {
      id,
      baby_id: input.babyId,
      type: input.type,
      side: input.side,
      last_finished_side: input.lastFinishedSide,
      started_at: input.startedAt.toISOString(),
      ended_at: input.endedAt?.toISOString(),
      duration_seconds: input.durationSeconds,
      left_duration_seconds: input.leftDurationSeconds,
      right_duration_seconds: input.rightDurationSeconds,
      amount_ml: input.amountMl,
      content_type: input.contentType,
      food_type: input.foodType,
      amount: input.amount,
      reaction: input.reaction,
      notes: input.notes,
      logged_by: userId,
      created_at: now,
      updated_at: now,
    },
  });

  return feeding;
}

export async function updateFeedingInDatabase(
  babyId: string,
  feedingId: string,
  input: UpdateFeedingInput
): Promise<StoredFeedingEntry | null> {
  const now = new Date().toISOString();

  const updateData: Record<string, unknown> = {
    updated_at: now,
  };
  if (input.endedAt !== undefined) updateData.ended_at = input.endedAt.toISOString();
  if (input.durationSeconds !== undefined) updateData.duration_seconds = input.durationSeconds;
  if (input.leftDurationSeconds !== undefined) updateData.left_duration_seconds = input.leftDurationSeconds;
  if (input.rightDurationSeconds !== undefined) updateData.right_duration_seconds = input.rightDurationSeconds;
  if (input.amountMl !== undefined) updateData.amount_ml = input.amountMl;
  if (input.contentType !== undefined) updateData.content_type = input.contentType;
  if (input.foodType !== undefined) updateData.food_type = input.foodType;
  if (input.amount !== undefined) updateData.amount = input.amount;
  if (input.reaction !== undefined) updateData.reaction = input.reaction;
  if (input.notes !== undefined) updateData.notes = input.notes;
  if (input.side !== undefined) updateData.side = input.side;

  let updatedFeeding: StoredFeedingEntry | null = null;

  await updateLocalFeedings(babyId, (feedings) =>
    feedings.map((f) => {
      if (f.id === feedingId) {
        updatedFeeding = {
          ...f,
          ...input,
          endedAt: input.endedAt?.toISOString() ?? f.endedAt,
          updatedAt: now,
        };
        return updatedFeeding;
      }
      return f;
    })
  );

  if (!updatedFeeding) return null;

  await queueSyncOperation({
    type: 'UPDATE',
    table: 'feedings',
    entityId: feedingId,
    data: updateData,
  });

  return updatedFeeding;
}

export async function deleteFeedingFromDatabase(babyId: string, feedingId: string): Promise<boolean> {
  await updateLocalFeedings(babyId, (feedings) => feedings.filter((f) => f.id !== feedingId));

  await queueSyncOperation({
    type: 'DELETE',
    table: 'feedings',
    entityId: feedingId,
    data: null,
  });

  return true;
}

function transformFeedingFromDb(data: Record<string, unknown>): StoredFeedingEntry {
  return {
    id: data.id as string,
    babyId: data.baby_id as string,
    type: data.type as StoredFeedingEntry["type"],
    side: data.side as StoredFeedingEntry["side"],
    lastFinishedSide: data.last_finished_side as StoredFeedingEntry["lastFinishedSide"],
    startedAt: data.started_at as string,
    endedAt: data.ended_at as string | undefined,
    durationSeconds: data.duration_seconds as number | undefined,
    leftDurationSeconds: data.left_duration_seconds as number | undefined,
    rightDurationSeconds: data.right_duration_seconds as number | undefined,
    amountMl: data.amount_ml as number | undefined,
    contentType: data.content_type as StoredFeedingEntry["contentType"],
    foodType: data.food_type as string | undefined,
    amount: data.amount as StoredFeedingEntry["amount"],
    reaction: data.reaction as StoredFeedingEntry["reaction"],
    notes: data.notes as string | undefined,
    loggedBy: data.logged_by as string | undefined,
    createdAt: (data.created_at as string) || new Date().toISOString(),
    updatedAt: (data.updated_at as string) || new Date().toISOString(),
  };
}

async function updateLocalFeedings(
  babyId: string,
  updater: (feedings: StoredFeedingEntry[]) => StoredFeedingEntry[]
): Promise<void> {
  const key = getUserScopedKey(`${KEYS.feedings}${babyId}`);
  await withStorageLock(key, async () => {
    const data = await AsyncStorage.getItem(key);
    const feedings = data ? (JSON.parse(data) as StoredFeedingEntry[]) : [];
    await AsyncStorage.setItem(key, JSON.stringify(updater(feedings)));
  });
}

// ============ DIAPERS ============

export async function fetchDiapersFromDatabase(babyId: string): Promise<StoredDiaperEntry[]> {
  const { data, error } = await supabase
    .from("diapers")
    .select("*")
    .eq("baby_id", babyId)
    .order("changed_at", { ascending: false });

  if (error) {
    console.error("[ActivitySync] Failed to fetch diapers:", error.message);
    throw new Error("Failed to fetch diapers");
  }

  const serverDiapers: StoredDiaperEntry[] = (data || []).map(transformDiaperFromDb);
  const pendingIds = getPendingCreateIds(getSyncEngine(), 'diapers');
  const localData = await AsyncStorage.getItem(getUserScopedKey(`${KEYS.diapers}${babyId}`));
  const localDiapers: StoredDiaperEntry[] = localData ? JSON.parse(localData) : [];
  const diapers = mergeWithPendingLocal(serverDiapers, localDiapers, pendingIds);
  await AsyncStorage.setItem(getUserScopedKey(`${KEYS.diapers}${babyId}`), JSON.stringify(diapers));
  return diapers;
}

export async function createDiaperInDatabase(
  input: CreateDiaperInput,
  userId: string
): Promise<StoredDiaperEntry> {
  const now = new Date().toISOString();
  const id = generateId();

  const diaper: StoredDiaperEntry = {
    id,
    babyId: input.babyId,
    type: input.type,
    stoolColor: input.stoolColor,
    changedAt: input.changedAt.toISOString(),
    notes: input.notes,
    loggedBy: userId,
    createdAt: now,
    updatedAt: now,
  };

  await updateLocalDiapers(input.babyId, (diapers) => [...diapers, diaper]);

  await queueSyncOperation({
    type: 'CREATE',
    table: 'diapers',
    entityId: id,
    data: {
      id,
      baby_id: input.babyId,
      type: input.type,
      stool_color: input.stoolColor,
      changed_at: input.changedAt.toISOString(),
      notes: input.notes,
      logged_by: userId,
      created_at: now,
    },
  });

  return diaper;
}

export async function updateDiaperInDatabase(
  babyId: string,
  diaperId: string,
  input: UpdateDiaperInput
): Promise<StoredDiaperEntry | null> {
  const now = new Date().toISOString();

  const updateData: Record<string, unknown> = {};
  if (input.type !== undefined) updateData.type = input.type;
  if (input.stoolColor !== undefined) updateData.stool_color = input.stoolColor;
  if (input.changedAt !== undefined) updateData.changed_at = input.changedAt.toISOString();
  if (input.notes !== undefined) updateData.notes = input.notes;

  let updatedDiaper: StoredDiaperEntry | null = null;

  await updateLocalDiapers(babyId, (diapers) =>
    diapers.map((d) => {
      if (d.id === diaperId) {
        updatedDiaper = {
          ...d,
          ...input,
          changedAt: input.changedAt?.toISOString() ?? d.changedAt,
          updatedAt: now,
        };
        return updatedDiaper;
      }
      return d;
    })
  );

  if (!updatedDiaper) return null;

  await queueSyncOperation({
    type: 'UPDATE',
    table: 'diapers',
    entityId: diaperId,
    data: updateData,
  });

  return updatedDiaper;
}

export async function deleteDiaperFromDatabase(babyId: string, diaperId: string): Promise<boolean> {
  await updateLocalDiapers(babyId, (diapers) => diapers.filter((d) => d.id !== diaperId));

  await queueSyncOperation({
    type: 'DELETE',
    table: 'diapers',
    entityId: diaperId,
    data: null,
  });

  return true;
}

function transformDiaperFromDb(data: Record<string, unknown>): StoredDiaperEntry {
  return {
    id: data.id as string,
    babyId: data.baby_id as string,
    type: data.type as StoredDiaperEntry["type"],
    stoolColor: data.stool_color as StoredDiaperEntry["stoolColor"],
    changedAt: data.changed_at as string,
    notes: data.notes as string | undefined,
    loggedBy: data.logged_by as string | undefined,
    createdAt: (data.created_at as string) || new Date().toISOString(),
    updatedAt: (data.created_at as string) || new Date().toISOString(),
  };
}

async function updateLocalDiapers(
  babyId: string,
  updater: (diapers: StoredDiaperEntry[]) => StoredDiaperEntry[]
): Promise<void> {
  const key = getUserScopedKey(`${KEYS.diapers}${babyId}`);
  await withStorageLock(key, async () => {
    const data = await AsyncStorage.getItem(key);
    const diapers = data ? (JSON.parse(data) as StoredDiaperEntry[]) : [];
    await AsyncStorage.setItem(key, JSON.stringify(updater(diapers)));
  });
}

// ============ SLEEP ============

export async function fetchSleepFromDatabase(babyId: string): Promise<StoredSleepEntry[]> {
  const { data, error } = await supabase
    .from("sleep_sessions")
    .select("*")
    .eq("baby_id", babyId)
    .order("started_at", { ascending: false });

  if (error) {
    console.error("[ActivitySync] Failed to fetch sleep sessions:", error.message);
    throw new Error("Failed to fetch sleep sessions");
  }

  const serverSessions: StoredSleepEntry[] = (data || []).map(transformSleepFromDb);
  const pendingIds = getPendingCreateIds(getSyncEngine(), 'sleep_sessions');
  const localData = await AsyncStorage.getItem(getUserScopedKey(`${KEYS.sleep}${babyId}`));
  const localSessions: StoredSleepEntry[] = localData ? JSON.parse(localData) : [];
  const sleepSessions = mergeWithPendingLocal(serverSessions, localSessions, pendingIds);
  const mergedIds = new Set(sleepSessions.map(s => s.id));
  const droppedRecent = localSessions.filter(l =>
    !mergedIds.has(l.id) && (Date.now() - new Date(l.createdAt).getTime()) < 120_000
  );
  if (droppedRecent.length > 0) {
    console.error("[ActivitySync] fetchSleep: DROPPING recent local entries!", {
      droppedIds: droppedRecent.map(d => d.id),
      pendingCount: pendingIds.size,
      serverCount: serverSessions.length,
      localCount: localSessions.length,
    });
  }
  await AsyncStorage.setItem(getUserScopedKey(`${KEYS.sleep}${babyId}`), JSON.stringify(sleepSessions));
  return sleepSessions;
}

export async function createSleepInDatabase(
  input: CreateSleepInput,
  userId: string
): Promise<StoredSleepEntry> {
  const now = new Date().toISOString();
  const id = generateId();

  const sleep: StoredSleepEntry = {
    id,
    babyId: input.babyId,
    type: input.type,
    startedAt: input.startedAt.toISOString(),
    endedAt: input.endedAt?.toISOString(),
    durationSeconds: input.durationSeconds,
    notes: input.notes,
    loggedBy: userId,
    createdAt: now,
    updatedAt: now,
  };

  await updateLocalSleep(input.babyId, (sessions) => [...sessions, sleep]);
  console.log("[ActivitySync] createSleep: local write done, id=%s", id);

  await queueSyncOperation({
    type: 'CREATE',
    table: 'sleep_sessions',
    entityId: id,
    data: {
      id,
      baby_id: input.babyId,
      type: input.type,
      started_at: input.startedAt.toISOString(),
      ended_at: input.endedAt?.toISOString(),
      duration_seconds: input.durationSeconds,
      notes: input.notes,
      logged_by: userId,
      created_at: now,
      updated_at: now,
    },
  });

  return sleep;
}

export async function updateSleepInDatabase(
  babyId: string,
  sleepId: string,
  input: UpdateSleepInput
): Promise<StoredSleepEntry | null> {
  const now = new Date().toISOString();

  const updateData: Record<string, unknown> = {
    updated_at: now,
  };
  if (input.endedAt !== undefined) updateData.ended_at = input.endedAt.toISOString();
  if (input.durationSeconds !== undefined) updateData.duration_seconds = input.durationSeconds;
  if (input.notes !== undefined) updateData.notes = input.notes;
  if (input.type !== undefined) updateData.type = input.type;

  let updatedSleep: StoredSleepEntry | null = null;

  await updateLocalSleep(babyId, (sessions) =>
    sessions.map((s) => {
      if (s.id === sleepId) {
        updatedSleep = {
          ...s,
          ...input,
          endedAt: input.endedAt?.toISOString() ?? s.endedAt,
          updatedAt: now,
        };
        return updatedSleep;
      }
      return s;
    })
  );

  if (!updatedSleep) return null;

  await queueSyncOperation({
    type: 'UPDATE',
    table: 'sleep_sessions',
    entityId: sleepId,
    data: updateData,
  });

  return updatedSleep;
}

export async function deleteSleepFromDatabase(babyId: string, sleepId: string): Promise<boolean> {
  await updateLocalSleep(babyId, (sessions) => sessions.filter((s) => s.id !== sleepId));

  await queueSyncOperation({
    type: 'DELETE',
    table: 'sleep_sessions',
    entityId: sleepId,
    data: null,
  });

  return true;
}

function transformSleepFromDb(data: Record<string, unknown>): StoredSleepEntry {
  return {
    id: data.id as string,
    babyId: data.baby_id as string,
    type: data.type as StoredSleepEntry["type"],
    startedAt: data.started_at as string,
    endedAt: data.ended_at as string | undefined,
    durationSeconds: data.duration_seconds as number | undefined,
    notes: data.notes as string | undefined,
    loggedBy: data.logged_by as string | undefined,
    createdAt: (data.created_at as string) || new Date().toISOString(),
    updatedAt: (data.updated_at as string) || new Date().toISOString(),
  };
}

async function updateLocalSleep(
  babyId: string,
  updater: (sessions: StoredSleepEntry[]) => StoredSleepEntry[]
): Promise<void> {
  const key = getUserScopedKey(`${KEYS.sleep}${babyId}`);
  await withStorageLock(key, async () => {
    const data = await AsyncStorage.getItem(key);
    const sessions = data ? (JSON.parse(data) as StoredSleepEntry[]) : [];
    await AsyncStorage.setItem(key, JSON.stringify(updater(sessions)));
  });
}

// ============ PUMPING ============

export async function fetchPumpingFromDatabase(babyId: string): Promise<StoredPumpingEntry[]> {
  const { data, error } = await supabase
    .from("pumping_sessions")
    .select("*")
    .eq("baby_id", babyId)
    .order("started_at", { ascending: false });

  if (error) {
    console.error("[ActivitySync] Failed to fetch pumping sessions:", error.message);
    throw new Error("Failed to fetch pumping sessions");
  }

  const serverSessions: StoredPumpingEntry[] = (data || []).map(transformPumpingFromDb);
  const pendingIds = getPendingCreateIds(getSyncEngine(), 'pumping_sessions');
  const localData = await AsyncStorage.getItem(getUserScopedKey(`${KEYS.pumping}${babyId}`));
  const localSessions: StoredPumpingEntry[] = localData ? JSON.parse(localData) : [];
  const pumpingSessions = mergeWithPendingLocal(serverSessions, localSessions, pendingIds);
  await AsyncStorage.setItem(getUserScopedKey(`${KEYS.pumping}${babyId}`), JSON.stringify(pumpingSessions));
  return pumpingSessions;
}

export async function createPumpingInDatabase(
  input: CreatePumpingInput,
  userId: string
): Promise<StoredPumpingEntry> {
  const now = new Date().toISOString();
  const id = generateId();

  const pumping: StoredPumpingEntry = {
    id,
    babyId: input.babyId,
    side: input.side,
    startedAt: input.startedAt.toISOString(),
    endedAt: input.endedAt?.toISOString(),
    durationSeconds: input.durationSeconds,
    volumeMl: input.volumeMl,
    notes: input.notes,
    loggedBy: userId,
    createdAt: now,
    updatedAt: now,
  };

  await updateLocalPumping(input.babyId, (sessions) => [...sessions, pumping]);

  await queueSyncOperation({
    type: 'CREATE',
    table: 'pumping_sessions',
    entityId: id,
    data: {
      id,
      baby_id: input.babyId,
      side: input.side,
      started_at: input.startedAt.toISOString(),
      ended_at: input.endedAt?.toISOString(),
      duration_seconds: input.durationSeconds,
      amount_ml: input.volumeMl,
      notes: input.notes,
      logged_by: userId,
      created_at: now,
    },
  });

  return pumping;
}

export async function updatePumpingInDatabase(
  babyId: string,
  pumpingId: string,
  input: UpdatePumpingInput
): Promise<StoredPumpingEntry | null> {
  const now = new Date().toISOString();

  const updateData: Record<string, unknown> = {};
  if (input.endedAt !== undefined) updateData.ended_at = input.endedAt.toISOString();
  if (input.durationSeconds !== undefined) updateData.duration_seconds = input.durationSeconds;
  if (input.volumeMl !== undefined) updateData.amount_ml = input.volumeMl;
  if (input.notes !== undefined) updateData.notes = input.notes;
  if (input.side !== undefined) updateData.side = input.side;

  let updatedPumping: StoredPumpingEntry | null = null;

  await updateLocalPumping(babyId, (sessions) =>
    sessions.map((p) => {
      if (p.id === pumpingId) {
        updatedPumping = {
          ...p,
          ...input,
          endedAt: input.endedAt?.toISOString() ?? p.endedAt,
          updatedAt: now,
        };
        return updatedPumping;
      }
      return p;
    })
  );

  if (!updatedPumping) return null;

  await queueSyncOperation({
    type: 'UPDATE',
    table: 'pumping_sessions',
    entityId: pumpingId,
    data: updateData,
  });

  return updatedPumping;
}

export async function deletePumpingFromDatabase(babyId: string, pumpingId: string): Promise<boolean> {
  await updateLocalPumping(babyId, (sessions) => sessions.filter((p) => p.id !== pumpingId));

  await queueSyncOperation({
    type: 'DELETE',
    table: 'pumping_sessions',
    entityId: pumpingId,
    data: null,
  });

  return true;
}

function transformPumpingFromDb(data: Record<string, unknown>): StoredPumpingEntry {
  return {
    id: data.id as string,
    babyId: data.baby_id as string,
    side: data.side as StoredPumpingEntry["side"],
    startedAt: data.started_at as string,
    endedAt: data.ended_at as string | undefined,
    durationSeconds: data.duration_seconds as number | undefined,
    volumeMl: data.amount_ml as number | undefined,
    notes: data.notes as string | undefined,
    loggedBy: data.logged_by as string | undefined,
    createdAt: (data.created_at as string) || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

async function updateLocalPumping(
  babyId: string,
  updater: (sessions: StoredPumpingEntry[]) => StoredPumpingEntry[]
): Promise<void> {
  const key = getUserScopedKey(`${KEYS.pumping}${babyId}`);
  await withStorageLock(key, async () => {
    const data = await AsyncStorage.getItem(key);
    const sessions = data ? (JSON.parse(data) as StoredPumpingEntry[]) : [];
    await AsyncStorage.setItem(key, JSON.stringify(updater(sessions)));
  });
}

// ============ GROWTH ============

export async function fetchGrowthFromDatabase(babyId: string): Promise<StoredGrowthEntry[]> {
  const { data, error } = await supabase
    .from("growth_measurements")
    .select("*")
    .eq("baby_id", babyId)
    .order("measured_at", { ascending: false });

  if (error) {
    console.error("[ActivitySync] Failed to fetch growth measurements:", error.message);
    throw new Error("Failed to fetch growth measurements");
  }

  const serverMeasurements: StoredGrowthEntry[] = (data || []).map(transformGrowthFromDb);
  const pendingIds = getPendingCreateIds(getSyncEngine(), 'growth_measurements');
  const localData = await AsyncStorage.getItem(getUserScopedKey(`${KEYS.growth}${babyId}`));
  const localMeasurements: StoredGrowthEntry[] = localData ? JSON.parse(localData) : [];
  const measurements = mergeWithPendingLocal(serverMeasurements, localMeasurements, pendingIds);
  await AsyncStorage.setItem(getUserScopedKey(`${KEYS.growth}${babyId}`), JSON.stringify(measurements));
  return measurements;
}

export async function createGrowthInDatabase(
  input: CreateGrowthInput,
  userId: string
): Promise<StoredGrowthEntry> {
  const now = new Date().toISOString();
  const id = generateId();

  const growth: StoredGrowthEntry = {
    id,
    babyId: input.babyId,
    measuredAt: input.measuredAt.toISOString(),
    weightKg: input.weightKg,
    heightCm: input.heightCm,
    headCircumferenceCm: input.headCircumferenceCm,
    notes: input.notes,
    loggedBy: userId,
    createdAt: now,
    updatedAt: now,
  };

  await updateLocalGrowth(input.babyId, (measurements) => [...measurements, growth]);

  await queueSyncOperation({
    type: 'CREATE',
    table: 'growth_measurements',
    entityId: id,
    data: {
      id,
      baby_id: input.babyId,
      measured_at: input.measuredAt.toISOString(),
      weight_kg: input.weightKg,
      height_cm: input.heightCm,
      head_cm: input.headCircumferenceCm,
      notes: input.notes,
      logged_by: userId,
      created_at: now,
    },
  });

  return growth;
}

export async function updateGrowthInDatabase(
  babyId: string,
  growthId: string,
  input: UpdateGrowthInput
): Promise<StoredGrowthEntry | null> {
  const now = new Date().toISOString();

  const updateData: Record<string, unknown> = {};
  if (input.measuredAt !== undefined) updateData.measured_at = input.measuredAt.toISOString();
  if (input.weightKg !== undefined) updateData.weight_kg = input.weightKg;
  if (input.heightCm !== undefined) updateData.height_cm = input.heightCm;
  if (input.headCircumferenceCm !== undefined) updateData.head_cm = input.headCircumferenceCm;
  if (input.notes !== undefined) updateData.notes = input.notes;

  let updatedGrowth: StoredGrowthEntry | null = null;

  await updateLocalGrowth(babyId, (measurements) =>
    measurements.map((g) => {
      if (g.id === growthId) {
        updatedGrowth = {
          ...g,
          ...input,
          measuredAt: input.measuredAt?.toISOString() ?? g.measuredAt,
          updatedAt: now,
        };
        return updatedGrowth;
      }
      return g;
    })
  );

  if (!updatedGrowth) return null;

  await queueSyncOperation({
    type: 'UPDATE',
    table: 'growth_measurements',
    entityId: growthId,
    data: updateData,
  });

  return updatedGrowth;
}

export async function deleteGrowthFromDatabase(babyId: string, growthId: string): Promise<boolean> {
  await updateLocalGrowth(babyId, (measurements) => measurements.filter((g) => g.id !== growthId));

  await queueSyncOperation({
    type: 'DELETE',
    table: 'growth_measurements',
    entityId: growthId,
    data: null,
  });

  return true;
}

function transformGrowthFromDb(data: Record<string, unknown>): StoredGrowthEntry {
  return {
    id: data.id as string,
    babyId: data.baby_id as string,
    measuredAt: data.measured_at as string,
    weightKg: data.weight_kg as number | undefined,
    heightCm: data.height_cm as number | undefined,
    headCircumferenceCm: data.head_cm as number | undefined,
    notes: data.notes as string | undefined,
    loggedBy: data.logged_by as string | undefined,
    createdAt: (data.created_at as string) || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

async function updateLocalGrowth(
  babyId: string,
  updater: (measurements: StoredGrowthEntry[]) => StoredGrowthEntry[]
): Promise<void> {
  const key = getUserScopedKey(`${KEYS.growth}${babyId}`);
  await withStorageLock(key, async () => {
    const data = await AsyncStorage.getItem(key);
    const measurements = data ? (JSON.parse(data) as StoredGrowthEntry[]) : [];
    await AsyncStorage.setItem(key, JSON.stringify(updater(measurements)));
  });
}

// ============ TUMMY TIME ============

export async function fetchTummyTimeFromDatabase(babyId: string): Promise<StoredTummyTimeEntry[]> {
  const { data, error } = await supabase
    .from("tummy_time_sessions")
    .select("*")
    .eq("baby_id", babyId)
    .order("started_at", { ascending: false });

  if (error) {
    console.error("[ActivitySync] Failed to fetch tummy time sessions:", error.message);
    throw new Error("Failed to fetch tummy time sessions");
  }

  const serverSessions: StoredTummyTimeEntry[] = (data || []).map(transformTummyTimeFromDb);
  const pendingIds = getPendingCreateIds(getSyncEngine(), 'tummy_time_sessions');
  const localData = await AsyncStorage.getItem(getUserScopedKey(`${KEYS.tummyTime}${babyId}`));
  const localSessions: StoredTummyTimeEntry[] = localData ? JSON.parse(localData) : [];
  const sessions = mergeWithPendingLocal(serverSessions, localSessions, pendingIds);
  await AsyncStorage.setItem(getUserScopedKey(`${KEYS.tummyTime}${babyId}`), JSON.stringify(sessions));
  return sessions;
}

export async function createTummyTimeInDatabase(
  input: CreateTummyTimeInput,
  userId: string
): Promise<StoredTummyTimeEntry> {
  const now = new Date().toISOString();
  const id = generateId();

  const tummyTime: StoredTummyTimeEntry = {
    id,
    babyId: input.babyId,
    startedAt: input.startedAt.toISOString(),
    endedAt: input.endedAt?.toISOString(),
    durationSeconds: input.durationSeconds,
    notes: input.notes,
    loggedBy: userId,
    createdAt: now,
    updatedAt: now,
  };

  await updateLocalTummyTime(input.babyId, (sessions) => [...sessions, tummyTime]);

  await queueSyncOperation({
    type: 'CREATE',
    table: 'tummy_time_sessions',
    entityId: id,
    data: {
      id,
      baby_id: input.babyId,
      started_at: input.startedAt.toISOString(),
      ended_at: input.endedAt?.toISOString(),
      duration_seconds: input.durationSeconds,
      notes: input.notes,
      logged_by: userId,
      created_at: now,
    },
  });

  return tummyTime;
}

export async function updateTummyTimeInDatabase(
  babyId: string,
  tummyTimeId: string,
  input: UpdateTummyTimeInput
): Promise<StoredTummyTimeEntry | null> {
  const now = new Date().toISOString();

  const updateData: Record<string, unknown> = {};
  if (input.endedAt !== undefined) updateData.ended_at = input.endedAt.toISOString();
  if (input.durationSeconds !== undefined) updateData.duration_seconds = input.durationSeconds;
  if (input.notes !== undefined) updateData.notes = input.notes;

  let updatedTummyTime: StoredTummyTimeEntry | null = null;

  await updateLocalTummyTime(babyId, (sessions) =>
    sessions.map((t) => {
      if (t.id === tummyTimeId) {
        updatedTummyTime = {
          ...t,
          ...input,
          endedAt: input.endedAt?.toISOString() ?? t.endedAt,
          updatedAt: now,
        };
        return updatedTummyTime;
      }
      return t;
    })
  );

  if (!updatedTummyTime) return null;

  await queueSyncOperation({
    type: 'UPDATE',
    table: 'tummy_time_sessions',
    entityId: tummyTimeId,
    data: updateData,
  });

  return updatedTummyTime;
}

export async function deleteTummyTimeFromDatabase(babyId: string, tummyTimeId: string): Promise<boolean> {
  await updateLocalTummyTime(babyId, (sessions) => sessions.filter((t) => t.id !== tummyTimeId));

  await queueSyncOperation({
    type: 'DELETE',
    table: 'tummy_time_sessions',
    entityId: tummyTimeId,
    data: null,
  });

  return true;
}

function transformTummyTimeFromDb(data: Record<string, unknown>): StoredTummyTimeEntry {
  return {
    id: data.id as string,
    babyId: data.baby_id as string,
    startedAt: data.started_at as string,
    endedAt: data.ended_at as string | undefined,
    durationSeconds: data.duration_seconds as number | undefined,
    notes: data.notes as string | undefined,
    loggedBy: data.logged_by as string | undefined,
    createdAt: (data.created_at as string) || new Date().toISOString(),
    updatedAt: (data.created_at as string) || new Date().toISOString(),
  };
}

async function updateLocalTummyTime(
  babyId: string,
  updater: (sessions: StoredTummyTimeEntry[]) => StoredTummyTimeEntry[]
): Promise<void> {
  const key = getUserScopedKey(`${KEYS.tummyTime}${babyId}`);
  await withStorageLock(key, async () => {
    const data = await AsyncStorage.getItem(key);
    const sessions = data ? (JSON.parse(data) as StoredTummyTimeEntry[]) : [];
    await AsyncStorage.setItem(key, JSON.stringify(updater(sessions)));
  });
}

// ============ MILESTONES ============

export async function fetchMilestoneResponsesFromDatabase(babyId: string): Promise<StoredMilestoneResponse[]> {
  const { data, error } = await supabase
    .from("milestone_responses")
    .select("*")
    .eq("baby_id", babyId);

  if (error) {
    console.error("[ActivitySync] Failed to fetch milestone responses:", error.message);
    throw new Error("Failed to fetch milestone responses");
  }

  const responses: StoredMilestoneResponse[] = (data || []).map(transformMilestoneResponseFromDb);
  await AsyncStorage.setItem(getUserScopedKey(`${KEYS.milestones}${babyId}`), JSON.stringify(responses));
  return responses;
}

export async function upsertMilestoneResponseInDatabase(
  input: {
    babyId: string;
    milestoneId: string;
    state: MilestoneState;
    respondedBy?: string;
  },
  existingId?: string
): Promise<StoredMilestoneResponse> {
  const now = new Date().toISOString();
  const id = existingId || generateId();

  const response: StoredMilestoneResponse = {
    id,
    babyId: input.babyId,
    milestoneId: input.milestoneId,
    state: input.state,
    respondedAt: now,
    respondedBy: input.respondedBy,
    createdAt: now,
    updatedAt: now,
  };

  await updateLocalMilestoneResponses(input.babyId, (responses) => {
    const existing = responses.find((r) => r.milestoneId === input.milestoneId);
    if (existing) {
      return responses.map((r) =>
        r.milestoneId === input.milestoneId
          ? { ...r, state: input.state, respondedAt: now, updatedAt: now, respondedBy: input.respondedBy ?? r.respondedBy }
          : r
      );
    }
    return [...responses, response];
  });

  const dbData: Record<string, unknown> = {
    id,
    baby_id: input.babyId,
    milestone_id: input.milestoneId,
    state: input.state,
    responded_at: now,
    responded_by: input.respondedBy,
    created_at: now,
    updated_at: now,
  };

  if (existingId) {
    await queueSyncOperation({
      type: 'UPDATE',
      table: 'milestone_responses',
      entityId: id,
      data: {
        state: input.state,
        responded_at: now,
        updated_at: now,
      },
    });
  } else {
    await queueSyncOperation({
      type: 'CREATE',
      table: 'milestone_responses',
      entityId: id,
      data: dbData,
    });
  }

  return response;
}

export async function deleteMilestoneResponseFromDatabase(
  babyId: string,
  responseId: string,
  milestoneId: string
): Promise<boolean> {
  await updateLocalMilestoneResponses(babyId, (responses) =>
    responses.filter((r) => r.milestoneId !== milestoneId)
  );

  await queueSyncOperation({
    type: 'DELETE',
    table: 'milestone_responses',
    entityId: responseId,
    data: null,
  });

  return true;
}

function transformMilestoneResponseFromDb(data: Record<string, unknown>): StoredMilestoneResponse {
  return {
    id: data.id as string,
    babyId: data.baby_id as string,
    milestoneId: data.milestone_id as string,
    state: data.state as MilestoneState,
    respondedAt: data.responded_at as string,
    respondedBy: data.responded_by as string | undefined,
    createdAt: (data.created_at as string) || new Date().toISOString(),
    updatedAt: (data.updated_at as string) || new Date().toISOString(),
  };
}

async function updateLocalMilestoneResponses(
  babyId: string,
  updater: (responses: StoredMilestoneResponse[]) => StoredMilestoneResponse[]
): Promise<void> {
  const key = getUserScopedKey(`${KEYS.milestones}${babyId}`);
  await withStorageLock(key, async () => {
    const data = await AsyncStorage.getItem(key);
    const responses = data ? (JSON.parse(data) as StoredMilestoneResponse[]) : [];
    await AsyncStorage.setItem(key, JSON.stringify(updater(responses)));
  });
}

// ============ ACHIEVEMENTS ============

interface StoredAchievementRecord {
  id: AchievementId;
  detectedAt: string;
}

export async function fetchAchievementsFromDatabase(babyId: string): Promise<StoredAchievementRecord[]> {
  const { data, error } = await supabase
    .from("achievements")
    .select("*")
    .eq("baby_id", babyId);

  if (error) {
    console.error("[ActivitySync] Failed to fetch achievements:", error.message);
    return [];
  }

  const records: StoredAchievementRecord[] = (data || []).map((row: Record<string, unknown>) => ({
    id: row.achievement_id as AchievementId,
    detectedAt: row.detected_at as string,
  }));

  const key = getUserScopedKey(`${KEYS.achievements}${babyId}`);
  await AsyncStorage.setItem(key, JSON.stringify(records));
  return records;
}

export async function insertAchievementInDatabase(
  babyId: string,
  achievementId: AchievementId,
  detectedBy?: string
): Promise<void> {
  const id = generateId();
  const now = new Date().toISOString();

  await queueSyncOperation({
    type: 'CREATE',
    table: 'achievements',
    entityId: id,
    data: {
      id,
      baby_id: babyId,
      achievement_id: achievementId,
      detected_at: now,
      detected_by: detectedBy,
      created_at: now,
    },
  });
}

// ============ GUEST DATA MIGRATION ============

async function getGuestActivities<T>(keyPrefix: string, babyId: string): Promise<T[]> {
  const key = `${keyPrefix}${babyId}`;
  const data = await AsyncStorage.getItem(key);
  if (!data) return [];
  return JSON.parse(data) as T[];
}

async function clearGuestActivities(keyPrefix: string, babyId: string): Promise<void> {
  const key = `${keyPrefix}${babyId}`;
  await AsyncStorage.removeItem(key);
}

export async function syncGuestActivitiesToDatabase(
  userId: string,
  babyIdMap: Map<string, string>
): Promise<void> {
  const oldBabyIds = Array.from(babyIdMap.keys());

  if (oldBabyIds.length === 0) {
    const allKeys = await AsyncStorage.getAllKeys();
    const guestBabyIds = new Set<string>();

    for (const key of allKeys) {
      for (const prefix of Object.values(KEYS)) {
        if (key.startsWith(prefix)) {
          const remainder = key.slice(prefix.length);
          const isGuestKey = !remainder.includes(':');
          if (isGuestKey && remainder) {
            guestBabyIds.add(remainder);
          }
        }
      }
    }

    for (const babyId of guestBabyIds) {
      babyIdMap.set(babyId, babyId);
    }
  }

  for (const [oldBabyId, newBabyId] of babyIdMap.entries()) {
    await syncFeedingsForBaby(oldBabyId, newBabyId, userId);
    await syncDiapersForBaby(oldBabyId, newBabyId, userId);
    await syncSleepForBaby(oldBabyId, newBabyId, userId);
    await syncPumpingForBaby(oldBabyId, newBabyId, userId);
    await syncGrowthForBaby(oldBabyId, newBabyId, userId);
    await syncTummyTimeForBaby(oldBabyId, newBabyId, userId);
  }
}

async function syncFeedingsForBaby(oldBabyId: string, newBabyId: string, userId: string): Promise<void> {
  const feedings = await getGuestActivities<StoredFeedingEntry>(KEYS.feedings, oldBabyId);
  if (feedings.length === 0) return;

  const migratedFeedings: StoredFeedingEntry[] = [];

  for (const feeding of feedings) {
    const newId = ensureUUID(feeding.id);
    const dbRecord = {
      id: newId,
      baby_id: newBabyId,
      type: feeding.type,
      side: feeding.side,
      last_finished_side: feeding.lastFinishedSide,
      started_at: feeding.startedAt,
      ended_at: feeding.endedAt,
      duration_seconds: feeding.durationSeconds,
      left_duration_seconds: feeding.leftDurationSeconds,
      right_duration_seconds: feeding.rightDurationSeconds,
      amount_ml: feeding.amountMl,
      content_type: feeding.contentType,
      food_type: feeding.foodType,
      amount: feeding.amount,
      reaction: feeding.reaction,
      notes: feeding.notes,
      logged_by: userId,
      created_at: feeding.createdAt,
      updated_at: feeding.updatedAt,
    };

    const { error } = await supabase.from('feedings').upsert(dbRecord);
    if (error) {
      console.error('[ActivitySync] Failed to sync feeding:', feeding.id, error.message);
    }

    migratedFeedings.push({ ...feeding, id: newId, babyId: newBabyId });
  }

  await AsyncStorage.setItem(
    getUserScopedKey(`${KEYS.feedings}${newBabyId}`),
    JSON.stringify(migratedFeedings)
  );

  await clearGuestActivities(KEYS.feedings, oldBabyId);
}

async function syncDiapersForBaby(oldBabyId: string, newBabyId: string, userId: string): Promise<void> {
  const diapers = await getGuestActivities<StoredDiaperEntry>(KEYS.diapers, oldBabyId);
  if (diapers.length === 0) return;

  const migratedDiapers: StoredDiaperEntry[] = [];

  for (const diaper of diapers) {
    const newId = ensureUUID(diaper.id);
    const dbRecord = {
      id: newId,
      baby_id: newBabyId,
      type: diaper.type,
      stool_color: diaper.stoolColor,
      changed_at: diaper.changedAt,
      notes: diaper.notes,
      logged_by: userId,
      created_at: diaper.createdAt,
    };

    const { error } = await supabase.from('diapers').upsert(dbRecord);
    if (error) {
      console.error('[ActivitySync] Failed to sync diaper:', diaper.id, error.message);
    }

    migratedDiapers.push({ ...diaper, id: newId, babyId: newBabyId });
  }

  await AsyncStorage.setItem(
    getUserScopedKey(`${KEYS.diapers}${newBabyId}`),
    JSON.stringify(migratedDiapers)
  );

  await clearGuestActivities(KEYS.diapers, oldBabyId);
}

async function syncSleepForBaby(oldBabyId: string, newBabyId: string, userId: string): Promise<void> {
  const sleepSessions = await getGuestActivities<StoredSleepEntry>(KEYS.sleep, oldBabyId);
  if (sleepSessions.length === 0) return;

  const migratedSleep: StoredSleepEntry[] = [];

  for (const sleep of sleepSessions) {
    const newId = ensureUUID(sleep.id);
    const dbRecord = {
      id: newId,
      baby_id: newBabyId,
      type: sleep.type,
      started_at: sleep.startedAt,
      ended_at: sleep.endedAt,
      duration_seconds: sleep.durationSeconds,
      notes: sleep.notes,
      logged_by: userId,
      created_at: sleep.createdAt,
      updated_at: sleep.updatedAt,
    };

    const { error } = await supabase.from('sleep_sessions').upsert(dbRecord);
    if (error) {
      console.error('[ActivitySync] Failed to sync sleep:', sleep.id, error.message);
    }

    migratedSleep.push({ ...sleep, id: newId, babyId: newBabyId });
  }

  await AsyncStorage.setItem(
    getUserScopedKey(`${KEYS.sleep}${newBabyId}`),
    JSON.stringify(migratedSleep)
  );

  await clearGuestActivities(KEYS.sleep, oldBabyId);
}

async function syncPumpingForBaby(oldBabyId: string, newBabyId: string, userId: string): Promise<void> {
  const pumpingSessions = await getGuestActivities<StoredPumpingEntry>(KEYS.pumping, oldBabyId);
  if (pumpingSessions.length === 0) return;

  const migratedPumping: StoredPumpingEntry[] = [];

  for (const pumping of pumpingSessions) {
    const newId = ensureUUID(pumping.id);
    const dbRecord = {
      id: newId,
      baby_id: newBabyId,
      side: pumping.side,
      started_at: pumping.startedAt,
      ended_at: pumping.endedAt,
      duration_seconds: pumping.durationSeconds,
      amount_ml: pumping.volumeMl,
      notes: pumping.notes,
      logged_by: userId,
      created_at: pumping.createdAt,
    };

    const { error } = await supabase.from('pumping_sessions').upsert(dbRecord);
    if (error) {
      console.error('[ActivitySync] Failed to sync pumping:', pumping.id, error.message);
    }

    migratedPumping.push({ ...pumping, id: newId, babyId: newBabyId });
  }

  await AsyncStorage.setItem(
    getUserScopedKey(`${KEYS.pumping}${newBabyId}`),
    JSON.stringify(migratedPumping)
  );

  await clearGuestActivities(KEYS.pumping, oldBabyId);
}

async function syncGrowthForBaby(oldBabyId: string, newBabyId: string, userId: string): Promise<void> {
  const measurements = await getGuestActivities<StoredGrowthEntry>(KEYS.growth, oldBabyId);
  if (measurements.length === 0) return;

  const migratedGrowth: StoredGrowthEntry[] = [];

  for (const growth of measurements) {
    const newId = ensureUUID(growth.id);
    const dbRecord = {
      id: newId,
      baby_id: newBabyId,
      measured_at: growth.measuredAt,
      weight_kg: growth.weightKg,
      height_cm: growth.heightCm,
      head_cm: growth.headCircumferenceCm,
      notes: growth.notes,
      logged_by: userId,
      created_at: growth.createdAt,
    };

    const { error } = await supabase.from('growth_measurements').upsert(dbRecord);
    if (error) {
      console.error('[ActivitySync] Failed to sync growth:', growth.id, error.message);
    }

    migratedGrowth.push({ ...growth, id: newId, babyId: newBabyId });
  }

  await AsyncStorage.setItem(
    getUserScopedKey(`${KEYS.growth}${newBabyId}`),
    JSON.stringify(migratedGrowth)
  );

  await clearGuestActivities(KEYS.growth, oldBabyId);
}

async function syncTummyTimeForBaby(oldBabyId: string, newBabyId: string, userId: string): Promise<void> {
  const sessions = await getGuestActivities<StoredTummyTimeEntry>(KEYS.tummyTime, oldBabyId);
  if (sessions.length === 0) return;

  const migratedTummyTime: StoredTummyTimeEntry[] = [];

  for (const tummyTime of sessions) {
    const newId = ensureUUID(tummyTime.id);
    const dbRecord = {
      id: newId,
      baby_id: newBabyId,
      started_at: tummyTime.startedAt,
      ended_at: tummyTime.endedAt,
      duration_seconds: tummyTime.durationSeconds,
      notes: tummyTime.notes,
      logged_by: userId,
      created_at: tummyTime.createdAt,
    };

    const { error } = await supabase.from('tummy_time_sessions').upsert(dbRecord);
    if (error) {
      console.error('[ActivitySync] Failed to sync tummy time:', tummyTime.id, error.message);
    }

    migratedTummyTime.push({ ...tummyTime, id: newId, babyId: newBabyId });
  }

  await AsyncStorage.setItem(
    getUserScopedKey(`${KEYS.tummyTime}${newBabyId}`),
    JSON.stringify(migratedTummyTime)
  );

  await clearGuestActivities(KEYS.tummyTime, oldBabyId);
}

// ============ HEALTH ============

export async function fetchHealthFromDatabase(babyId: string): Promise<StoredHealthEntry[]> {
  const { data, error } = await supabase
    .from("health_entries")
    .select("*")
    .eq("baby_id", babyId)
    .order("logged_at", { ascending: false });

  if (error) {
    console.error("[ActivitySync] Failed to fetch health:", error.message);
    throw new Error("Failed to fetch health");
  }

  const serverEntries: StoredHealthEntry[] = (data || []).map(transformHealthFromDb);
  const pendingIds = getPendingCreateIds(getSyncEngine(), 'health_entries');
  const localData = await AsyncStorage.getItem(getUserScopedKey(`${KEYS.health}${babyId}`));
  const localEntries: StoredHealthEntry[] = localData ? JSON.parse(localData) : [];
  const entries = mergeWithPendingLocal(serverEntries, localEntries, pendingIds);
  await AsyncStorage.setItem(getUserScopedKey(`${KEYS.health}${babyId}`), JSON.stringify(entries));
  return entries;
}

export async function createHealthInDatabase(
  input: CreateHealthInput,
  userId: string
): Promise<StoredHealthEntry> {
  const now = new Date().toISOString();
  const id = generateId();

  const entry: StoredHealthEntry = {
    id,
    babyId: input.babyId,
    type: input.type,
    loggedAt: input.loggedAt.toISOString(),
    notes: input.notes,
    medicationName: input.medicationName,
    dosageAmount: input.dosageAmount,
    dosageUnit: input.dosageUnit,
    doseNumber: input.doseNumber,
    temperatureCelsius: input.temperatureCelsius,
    measurementMethod: input.measurementMethod,
    vaccineName: input.vaccineName,
    symptoms: input.symptoms,
    loggedBy: userId,
    createdAt: now,
    updatedAt: now,
  };

  await updateLocalHealth(input.babyId, (entries) => [...entries, entry]);

  await queueSyncOperation({
    type: 'CREATE',
    table: 'health_entries',
    entityId: id,
    data: {
      id,
      baby_id: input.babyId,
      type: input.type,
      logged_at: input.loggedAt.toISOString(),
      notes: input.notes,
      medication_name: input.medicationName,
      dosage_amount: input.dosageAmount,
      dosage_unit: input.dosageUnit,
      dose_number: input.doseNumber,
      temperature_celsius: input.temperatureCelsius,
      measurement_method: input.measurementMethod,
      vaccine_name: input.vaccineName,
      symptoms: input.symptoms,
      logged_by: userId,
      created_at: now,
      updated_at: now,
    },
  });

  return entry;
}

export async function updateHealthInDatabase(
  babyId: string,
  healthId: string,
  input: UpdateHealthInput
): Promise<StoredHealthEntry | null> {
  const now = new Date().toISOString();

  const fieldMap: Record<string, string> = {
    type: "type",
    notes: "notes",
    medicationName: "medication_name",
    dosageAmount: "dosage_amount",
    dosageUnit: "dosage_unit",
    doseNumber: "dose_number",
    temperatureCelsius: "temperature_celsius",
    measurementMethod: "measurement_method",
    vaccineName: "vaccine_name",
    symptoms: "symptoms",
  };

  const updateData: Record<string, unknown> = {};
  if (input.loggedAt !== undefined) updateData.logged_at = input.loggedAt?.toISOString() ?? null;

  for (const [jsField, dbField] of Object.entries(fieldMap)) {
    const value = (input as Record<string, unknown>)[jsField];
    if (value !== undefined) {
      updateData[dbField] = value;
    }
  }

  let updatedEntry: StoredHealthEntry | null = null;

  await updateLocalHealth(babyId, (entries) =>
    entries.map((h) => {
      if (h.id === healthId) {
        const updated: StoredHealthEntry = {
          ...h,
          type: input.type ?? h.type,
          loggedAt: input.loggedAt?.toISOString() ?? h.loggedAt,
          updatedAt: now,
        };

        const nullableFields = [
          "notes", "medicationName", "dosageAmount", "dosageUnit",
          "doseNumber", "temperatureCelsius", "measurementMethod",
          "vaccineName", "symptoms",
        ] as const;

        for (const field of nullableFields) {
          if ((input as unknown as Record<string, unknown>)[field] !== undefined) {
            if ((input as unknown as Record<string, unknown>)[field] === null) {
              delete (updated as unknown as Record<string, unknown>)[field];
            } else {
              (updated as unknown as Record<string, unknown>)[field] = (input as unknown as Record<string, unknown>)[field];
            }
          }
        }

        updatedEntry = updated;
        return updated;
      }
      return h;
    })
  );

  if (!updatedEntry) return null;

  await queueSyncOperation({
    type: 'UPDATE',
    table: 'health_entries',
    entityId: healthId,
    data: updateData,
  });

  return updatedEntry;
}

export async function deleteHealthFromDatabase(babyId: string, healthId: string): Promise<boolean> {
  await updateLocalHealth(babyId, (entries) => entries.filter((h) => h.id !== healthId));

  await queueSyncOperation({
    type: 'DELETE',
    table: 'health_entries',
    entityId: healthId,
    data: null,
  });

  return true;
}

function transformHealthFromDb(data: Record<string, unknown>): StoredHealthEntry {
  return {
    id: data.id as string,
    babyId: data.baby_id as string,
    type: data.type as StoredHealthEntry["type"],
    loggedAt: data.logged_at as string,
    notes: data.notes as string | undefined,
    medicationName: data.medication_name as string | undefined,
    dosageAmount: data.dosage_amount as number | undefined,
    dosageUnit: data.dosage_unit as StoredHealthEntry["dosageUnit"],
    doseNumber: data.dose_number as number | undefined,
    temperatureCelsius: data.temperature_celsius as number | undefined,
    measurementMethod: data.measurement_method as StoredHealthEntry["measurementMethod"],
    vaccineName: data.vaccine_name as string | undefined,
    symptoms: data.symptoms as StoredHealthEntry["symptoms"],
    loggedBy: data.logged_by as string | undefined,
    createdAt: (data.created_at as string) || new Date().toISOString(),
    updatedAt: (data.updated_at as string) || new Date().toISOString(),
  };
}

async function updateLocalHealth(
  babyId: string,
  updater: (entries: StoredHealthEntry[]) => StoredHealthEntry[]
): Promise<void> {
  const key = getUserScopedKey(`${KEYS.health}${babyId}`);
  await withStorageLock(key, async () => {
    const data = await AsyncStorage.getItem(key);
    const entries = data ? (JSON.parse(data) as StoredHealthEntry[]) : [];
    await AsyncStorage.setItem(key, JSON.stringify(updater(entries)));
  });
}

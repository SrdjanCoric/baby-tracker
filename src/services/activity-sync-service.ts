import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Crypto from "expo-crypto";
import { supabase } from "./supabase";
import {
  getStorageUserId,
  getUserScopedKey,
  getUserScopedKeyFor,
} from "./storage-prefix";
import { getSyncEngine } from "@/contexts/sync-context";
import type { LocalStorageMutation, OperationType, SyncableTable } from "./sync/types";
import { reconcilePulled } from "./sync/crdt-sync-instance";
import { compareClocks, type FieldClocks } from "./sync/crdt";
import { dropTombstoned } from "./sync/tombstone";
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

async function getPendingEntityOperations(
  engine: SyncEngine | null,
  table: SyncableTable
): Promise<Map<string, OperationType>> {
  if (!engine) return new Map();
  await engine.waitUntilReadyForPull();
  return engine.getPendingEntityOperations(table);
}

function mergeWithPendingLocal<T extends { id: string }>(
  serverEntries: T[],
  localEntries: T[],
  pendingOperations: Map<string, OperationType>
): T[] {
  if (pendingOperations.size === 0) return serverEntries;

  const localById = new Map(localEntries.map(entry => [entry.id, entry]));
  const merged: T[] = [];
  const mergedIds = new Set<string>();

  for (const serverEntry of serverEntries) {
    const pendingType = pendingOperations.get(serverEntry.id);
    if (pendingType === 'DELETE') continue;

    const entry = pendingType ? localById.get(serverEntry.id) ?? serverEntry : serverEntry;
    merged.push(entry);
    mergedIds.add(entry.id);
  }

  for (const localEntry of localEntries) {
    const pendingType = pendingOperations.get(localEntry.id);
    if (pendingType && pendingType !== 'DELETE' && !mergedIds.has(localEntry.id)) {
      merged.push(localEntry);
    }
  }

  return merged;
}

const storageLocks = new Map<string, Promise<void>>();

function withStorageLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const prev = storageLocks.get(key) ?? Promise.resolve();
  const next = prev.then(fn, fn);
  storageLocks.set(key, next.then(() => {}, () => {}));
  return next;
}

interface PulledCollectionSnapshot<T> {
  entries: T[];
  localEntries: T[];
  pendingOperations: Map<string, OperationType>;
}

interface ActivityPullScope {
  key: string;
  storageUserId: string | null;
  engine: SyncEngine | null;
  authContext: { householdId: string; userId: string } | null;
}

function captureActivityPullScope(baseKey: string): ActivityPullScope {
  const storageUserId = getStorageUserId();
  const engine = getSyncEngine();
  const authContext = engine?.getAuthContext() ?? null;
  return {
    key: getUserScopedKeyFor(baseKey, storageUserId),
    storageUserId,
    engine,
    authContext: authContext ? { ...authContext } : null,
  };
}

function assertActivityPullScope(scope: ActivityPullScope): void {
  const currentEngine = getSyncEngine();
  const currentAuthContext = currentEngine?.getAuthContext() ?? null;
  const sameAuthContext = scope.authContext === null
    ? currentAuthContext === null
    : currentAuthContext !== null
      && scope.authContext.householdId === currentAuthContext.householdId
      && scope.authContext.userId === currentAuthContext.userId;

  if (
    getStorageUserId() !== scope.storageUserId
    || currentEngine !== scope.engine
    || !sameAuthContext
  ) {
    throw new Error('Activity pull storage scope changed during reconciliation');
  }
}

async function commitPulledCollection<T extends { id: string }>(
  scope: ActivityPullScope,
  table: SyncableTable,
  serverEntries: T[],
  inspect?: (snapshot: PulledCollectionSnapshot<T>) => void
): Promise<T[]> {
  return withStorageLock(scope.key, async () => {
    assertActivityPullScope(scope);
    const pendingOperations = await getPendingEntityOperations(scope.engine, table);
    assertActivityPullScope(scope);
    const localData = await AsyncStorage.getItem(scope.key);
    assertActivityPullScope(scope);
    const localEntries: T[] = localData ? JSON.parse(localData) : [];
    const entries = mergeWithPendingLocal(serverEntries, localEntries, pendingOperations);
    inspect?.({ entries, localEntries, pendingOperations });
    assertActivityPullScope(scope);
    await AsyncStorage.setItem(scope.key, JSON.stringify(entries));
    assertActivityPullScope(scope);
    return entries;
  });
}

function greatestClock(clocks: FieldClocks): string | null {
  let greatest: string | null = null;
  for (const clock of Object.values(clocks)) {
    if (greatest === null || compareClocks(clock, greatest) > 0) {
      greatest = clock;
    }
  }
  return greatest;
}

function replaceLogicalMilestoneResponse(
  responses: StoredMilestoneResponse[],
  response: StoredMilestoneResponse
): StoredMilestoneResponse[] {
  return [
    ...responses.filter((item) => item.milestoneId !== response.milestoneId),
    response,
  ];
}

interface MilestoneIdentityReconciliation {
  responses: StoredMilestoneResponse[];
  retained: StoredMilestoneResponse;
  recoveryOperation: ActivityQueueOperation | null;
}

function reconcileMilestoneIdentity(
  scope: ActivityPullScope,
  responses: StoredMilestoneResponse[],
  localResponses: StoredMilestoneResponse[],
  pendingOperations: Map<string, OperationType>,
  canonical: StoredMilestoneResponse,
  canonicalClock: string | null
): MilestoneIdentityReconciliation {
  const alternate = localResponses.find((response) =>
    response.milestoneId === canonical.milestoneId
    && response.id !== canonical.id
    && !response.deleted
    && pendingOperations.get(response.id) === 'CREATE'
  );
  if (!alternate) {
    return {
      responses: replaceLogicalMilestoneResponse(responses, canonical),
      retained: canonical,
      recoveryOperation: null,
    };
  }

  const alternateClock = scope.engine
    ? greatestClock(
        scope.engine.getPendingEntityFieldClocks('milestone_responses', alternate.id)
      )
    : null;
  const alternateIsNewer = alternateClock && canonicalClock
    ? compareClocks(alternateClock, canonicalClock) > 0
    : Date.parse(alternate.updatedAt) > Date.parse(canonical.updatedAt);
  if (!alternateIsNewer) {
    return {
      responses: replaceLogicalMilestoneResponse(responses, canonical),
      retained: canonical,
      recoveryOperation: null,
    };
  }

  const recovered: StoredMilestoneResponse = {
    ...alternate,
    id: canonical.id,
    babyId: canonical.babyId,
    deleted: false,
    createdAt: canonical.createdAt,
  };
  return {
    responses: replaceLogicalMilestoneResponse(responses, recovered),
    retained: recovered,
    recoveryOperation: {
      type: 'UPDATE',
      table: 'milestone_responses',
      entityId: canonical.id,
      data: {
        baby_id: recovered.babyId,
        milestone_id: recovered.milestoneId,
        state: recovered.state,
        deleted: false,
        responded_at: recovered.respondedAt,
        responded_by: recovered.respondedBy,
        updated_at: recovered.updatedAt,
      },
    },
  };
}

async function commitPulledMilestoneResponses(
  scope: ActivityPullScope,
  serverResponses: StoredMilestoneResponse[],
  serverClocks: Map<string, string | null>
): Promise<StoredMilestoneResponse[]> {
  return withStorageLock(scope.key, async () => {
    assertActivityPullScope(scope);
    const pendingOperations = await getPendingEntityOperations(scope.engine, 'milestone_responses');
    assertActivityPullScope(scope);
    const localData = await AsyncStorage.getItem(scope.key);
    assertActivityPullScope(scope);
    const localResponses: StoredMilestoneResponse[] = localData ? JSON.parse(localData) : [];
    let responses = mergeWithPendingLocal(serverResponses, localResponses, pendingOperations);
    let previousValue = localData;
    let queuedRecovery = false;

    for (const canonical of serverResponses) {
      const reconciliation = reconcileMilestoneIdentity(
        scope,
        responses,
        localResponses,
        pendingOperations,
        canonical,
        serverClocks.get(canonical.id) ?? null
      );
      responses = reconciliation.responses;
      if (!reconciliation.recoveryOperation) continue;

      const nextValue = JSON.stringify(responses);
      await queueSyncOperation(reconciliation.recoveryOperation, 'required', {
        key: scope.key,
        previousValue,
        nextValue,
      });
      previousValue = nextValue;
      queuedRecovery = true;
      assertActivityPullScope(scope);
    }

    const finalValue = JSON.stringify(responses);
    if (!queuedRecovery || finalValue !== previousValue) {
      await AsyncStorage.setItem(scope.key, finalValue);
    }
    assertActivityPullScope(scope);
    return responses;
  });
}

type ActivityQueueOperation = {
  type: OperationType;
  table: SyncableTable;
  entityId: string;
  data: Record<string, unknown> | null;
};

type LocalMutationInput = Omit<LocalStorageMutation, 'state' | 'previousShadow'>;
type DurableQueueCommit = (mutation: LocalMutationInput) => Promise<void>;

async function updateLocalCollection<T>(
  key: string,
  updater: (entries: T[]) => T[],
  queueCommit?: DurableQueueCommit
): Promise<void> {
  await withStorageLock(key, async () => {
    const previousData = await AsyncStorage.getItem(key);
    const entries = previousData ? (JSON.parse(previousData) as T[]) : [];
    const nextData = JSON.stringify(updater(entries));

    if (!queueCommit) {
      await AsyncStorage.setItem(key, nextData);
      return;
    }

    await queueCommit({ key, previousValue: previousData, nextValue: nextData });
  });
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

async function ensureUUID(id: string, namespace: SyncableTable): Promise<string> {
  if (isValidUUID(id)) {
    return id;
  }

  const hash = await Crypto.digestStringAsync(
    Crypto.CryptoDigestAlgorithm.SHA256,
    `${namespace}:${id}`
  );
  const variant = ((Number.parseInt(hash[16], 16) & 0x3) | 0x8).toString(16);
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-5${hash.slice(13, 16)}-${variant}${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

async function queueSyncOperation(
  operation: ActivityQueueOperation,
  queueRequirement: 'when-authenticated' | 'required' = 'when-authenticated',
  localMutation?: LocalMutationInput
): Promise<void> {
  const engine = getSyncEngine();
  if (!engine?.getAuthContext()) {
    if (queueRequirement === 'required') {
        throw new Error('Authenticated sync queue is not ready');
    }
    if (localMutation) {
      await AsyncStorage.setItem(localMutation.key, localMutation.nextValue);
    }
    return;
  }

  try {
    const queuedOperation = {
      id: '',
      type: operation.type,
      table: operation.table,
      entityId: operation.entityId,
      data: operation.data,
      timestamp: new Date().toISOString(),
      retryCount: 0,
    };
    if (localMutation) {
      await engine.enqueueOperationWithLocalMutation(queuedOperation, localMutation);
    } else {
      await engine.enqueueOperation(queuedOperation);
    }
  } catch (error) {
    console.error(
      '[ActivitySync] Failed to persist activity operation in the sync queue:',
      error instanceof Error ? error.message : 'Unknown error'
    );
    throw error;
  }

  void engine.sync().catch(() => {
    // SyncEngine reports the failure and retains the operation for the next retry.
  });
}

function createDurableQueueCommit(
  operation: ActivityQueueOperation,
  queueRequirement: 'when-authenticated' | 'required' = 'when-authenticated'
): DurableQueueCommit {
  return (mutation) => queueSyncOperation(operation, queueRequirement, mutation);
}

function createConditionalDurableQueueCommit(
  operation: () => ActivityQueueOperation | null
): DurableQueueCommit {
  return async (mutation) => {
    const queuedOperation = operation();
    if (queuedOperation) {
      await queueSyncOperation(queuedOperation, 'when-authenticated', mutation);
    } else {
      await AsyncStorage.setItem(mutation.key, mutation.nextValue);
    }
  };
}

// ============ FEEDINGS ============

export async function fetchFeedingsFromDatabase(babyId: string): Promise<StoredFeedingEntry[]> {
  const scope = captureActivityPullScope(`${KEYS.feedings}${babyId}`);
  const { data, error } = await supabase
    .from("feedings")
    .select("*")
    .eq("baby_id", babyId)
    .order("started_at", { ascending: false });

  if (error) {
    console.error("[ActivitySync] Failed to fetch feedings:", error.message);
    throw new Error("Failed to fetch feedings");
  }

  const reconciled = await reconcilePulled("feedings", (data || []) as Record<string, unknown>[]);
  const serverFeedings: StoredFeedingEntry[] = dropTombstoned(reconciled).map(transformFeedingFromDb);
  return commitPulledCollection(scope, 'feedings', serverFeedings);
}

export async function createFeedingInDatabase(
  input: CreateFeedingInput,
  userId: string
): Promise<StoredFeedingEntry> {
  const now = new Date().toISOString();
  const id = input.id ?? generateId();

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

  let storedFeeding = feeding;
  let alreadyExists = false;
  await updateLocalFeedings(
    input.babyId,
    (feedings) => {
      const existing = feedings.find(item => item.id === id);
      if (existing) {
        alreadyExists = true;
        storedFeeding = existing;
        return feedings;
      }
      return [...feedings, feeding];
    },
    createConditionalDurableQueueCommit(() => alreadyExists
      ? null
      : ({
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
        }))
  );

  return storedFeeding;
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

  await updateLocalFeedings(
    babyId,
    (feedings) => feedings.map((f) => {
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
      }),
    createConditionalDurableQueueCommit(() => updatedFeeding
      ? ({
          type: 'UPDATE',
          table: 'feedings',
          entityId: feedingId,
          data: updateData,
        })
      : null)
  );

  if (!updatedFeeding) return null;

  return updatedFeeding;
}

export async function deleteFeedingFromDatabase(babyId: string, feedingId: string): Promise<boolean> {
  await updateLocalFeedings(
    babyId,
    (feedings) => feedings.filter((f) => f.id !== feedingId),
    createDurableQueueCommit({
      type: 'DELETE',
      table: 'feedings',
      entityId: feedingId,
      data: null,
    })
  );

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
  updater: (feedings: StoredFeedingEntry[]) => StoredFeedingEntry[],
  queueCommit?: DurableQueueCommit
): Promise<void> {
  const key = getUserScopedKey(`${KEYS.feedings}${babyId}`);
  await updateLocalCollection(key, updater, queueCommit);
}

// ============ DIAPERS ============

export async function fetchDiapersFromDatabase(babyId: string): Promise<StoredDiaperEntry[]> {
  const scope = captureActivityPullScope(`${KEYS.diapers}${babyId}`);
  const { data, error } = await supabase
    .from("diapers")
    .select("*")
    .eq("baby_id", babyId)
    .order("changed_at", { ascending: false });

  if (error) {
    console.error("[ActivitySync] Failed to fetch diapers:", error.message);
    throw new Error("Failed to fetch diapers");
  }

  const reconciled = await reconcilePulled("diapers", (data || []) as Record<string, unknown>[]);
  const serverDiapers: StoredDiaperEntry[] = dropTombstoned(reconciled).map(transformDiaperFromDb);
  return commitPulledCollection(scope, 'diapers', serverDiapers);
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

  await updateLocalDiapers(
    input.babyId,
    (diapers) => [...diapers, diaper],
    createDurableQueueCommit({
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
    })
  );

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

  await updateLocalDiapers(
    babyId,
    (diapers) => diapers.map((d) => {
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
      }),
    createConditionalDurableQueueCommit(() => updatedDiaper
      ? ({
          type: 'UPDATE',
          table: 'diapers',
          entityId: diaperId,
          data: updateData,
        })
      : null)
  );

  if (!updatedDiaper) return null;

  return updatedDiaper;
}

export async function deleteDiaperFromDatabase(babyId: string, diaperId: string): Promise<boolean> {
  await updateLocalDiapers(
    babyId,
    (diapers) => diapers.filter((d) => d.id !== diaperId),
    createDurableQueueCommit({
      type: 'DELETE',
      table: 'diapers',
      entityId: diaperId,
      data: null,
    })
  );

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
  updater: (diapers: StoredDiaperEntry[]) => StoredDiaperEntry[],
  queueCommit?: DurableQueueCommit
): Promise<void> {
  const key = getUserScopedKey(`${KEYS.diapers}${babyId}`);
  await updateLocalCollection(key, updater, queueCommit);
}

// ============ SLEEP ============

export async function fetchSleepFromDatabase(babyId: string): Promise<StoredSleepEntry[]> {
  const scope = captureActivityPullScope(`${KEYS.sleep}${babyId}`);
  const { data, error } = await supabase
    .from("sleep_sessions")
    .select("*")
    .eq("baby_id", babyId)
    .order("started_at", { ascending: false });

  if (error) {
    console.error("[ActivitySync] Failed to fetch sleep sessions:", error.message);
    throw new Error("Failed to fetch sleep sessions");
  }

  const reconciled = await reconcilePulled("sleep_sessions", (data || []) as Record<string, unknown>[]);
  const serverSessions: StoredSleepEntry[] = dropTombstoned(reconciled).map(transformSleepFromDb);
  return commitPulledCollection(
    scope,
    'sleep_sessions',
    serverSessions,
    ({ entries, localEntries, pendingOperations }) => {
      const mergedIds = new Set(entries.map(session => session.id));
      const droppedRecent = localEntries.filter(session =>
        !mergedIds.has(session.id)
        && (Date.now() - new Date(session.createdAt).getTime()) < 120_000
      );
      if (droppedRecent.length > 0) {
        console.error("[ActivitySync] fetchSleep: DROPPING recent local entries!", {
          droppedIds: droppedRecent.map(entry => entry.id),
          pendingCount: pendingOperations.size,
          serverCount: serverSessions.length,
          localCount: localEntries.length,
        });
      }
    }
  );
}

export async function createSleepInDatabase(
  input: CreateSleepInput,
  userId: string
): Promise<StoredSleepEntry> {
  const now = new Date().toISOString();
  const id = input.id ?? generateId();

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

  let storedSleep = sleep;
  let alreadyExists = false;
  await updateLocalSleep(
    input.babyId,
    (sessions) => {
      const existing = sessions.find(session => session.id === id);
      if (existing) {
        alreadyExists = true;
        storedSleep = existing;
        return sessions;
      }
      return [...sessions, sleep];
    },
    createConditionalDurableQueueCommit(() => alreadyExists
      ? null
      : ({
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
        }))
  );

  return storedSleep;
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

  await updateLocalSleep(
    babyId,
    (sessions) => sessions.map((s) => {
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
      }),
    createConditionalDurableQueueCommit(() => updatedSleep
      ? ({
          type: 'UPDATE',
          table: 'sleep_sessions',
          entityId: sleepId,
          data: updateData,
        })
      : null)
  );

  if (!updatedSleep) return null;

  return updatedSleep;
}

export async function deleteSleepFromDatabase(babyId: string, sleepId: string): Promise<boolean> {
  await updateLocalSleep(
    babyId,
    (sessions) => sessions.filter((s) => s.id !== sleepId),
    createDurableQueueCommit({
      type: 'DELETE',
      table: 'sleep_sessions',
      entityId: sleepId,
      data: null,
    })
  );

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
  updater: (sessions: StoredSleepEntry[]) => StoredSleepEntry[],
  queueCommit?: DurableQueueCommit
): Promise<void> {
  const key = getUserScopedKey(`${KEYS.sleep}${babyId}`);
  await updateLocalCollection(key, updater, queueCommit);
}

// ============ PUMPING ============

export async function fetchPumpingFromDatabase(babyId: string): Promise<StoredPumpingEntry[]> {
  const scope = captureActivityPullScope(`${KEYS.pumping}${babyId}`);
  const { data, error } = await supabase
    .from("pumping_sessions")
    .select("*")
    .eq("baby_id", babyId)
    .order("started_at", { ascending: false });

  if (error) {
    console.error("[ActivitySync] Failed to fetch pumping sessions:", error.message);
    throw new Error("Failed to fetch pumping sessions");
  }

  const reconciled = await reconcilePulled("pumping_sessions", (data || []) as Record<string, unknown>[]);
  const serverSessions: StoredPumpingEntry[] = dropTombstoned(reconciled).map(transformPumpingFromDb);
  return commitPulledCollection(scope, 'pumping_sessions', serverSessions);
}

export async function createPumpingInDatabase(
  input: CreatePumpingInput,
  userId: string
): Promise<StoredPumpingEntry> {
  const now = new Date().toISOString();
  const id = input.id ?? generateId();

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

  let storedPumping = pumping;
  let alreadyExists = false;
  await updateLocalPumping(
    input.babyId,
    (sessions) => {
      const existing = sessions.find(session => session.id === id);
      if (existing) {
        alreadyExists = true;
        storedPumping = existing;
        return sessions;
      }
      return [...sessions, pumping];
    },
    createConditionalDurableQueueCommit(() => alreadyExists
      ? null
      : ({
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
        }))
  );

  return storedPumping;
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

  await updateLocalPumping(
    babyId,
    (sessions) => sessions.map((p) => {
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
      }),
    createConditionalDurableQueueCommit(() => updatedPumping
      ? ({
          type: 'UPDATE',
          table: 'pumping_sessions',
          entityId: pumpingId,
          data: updateData,
        })
      : null)
  );

  if (!updatedPumping) return null;

  return updatedPumping;
}

export async function deletePumpingFromDatabase(babyId: string, pumpingId: string): Promise<boolean> {
  await updateLocalPumping(
    babyId,
    (sessions) => sessions.filter((p) => p.id !== pumpingId),
    createDurableQueueCommit({
      type: 'DELETE',
      table: 'pumping_sessions',
      entityId: pumpingId,
      data: null,
    })
  );

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
  updater: (sessions: StoredPumpingEntry[]) => StoredPumpingEntry[],
  queueCommit?: DurableQueueCommit
): Promise<void> {
  const key = getUserScopedKey(`${KEYS.pumping}${babyId}`);
  await updateLocalCollection(key, updater, queueCommit);
}

// ============ GROWTH ============

export async function fetchGrowthFromDatabase(babyId: string): Promise<StoredGrowthEntry[]> {
  const scope = captureActivityPullScope(`${KEYS.growth}${babyId}`);
  const { data, error } = await supabase
    .from("growth_measurements")
    .select("*")
    .eq("baby_id", babyId)
    .order("measured_at", { ascending: false });

  if (error) {
    console.error("[ActivitySync] Failed to fetch growth measurements:", error.message);
    throw new Error("Failed to fetch growth measurements");
  }

  const reconciled = await reconcilePulled("growth_measurements", (data || []) as Record<string, unknown>[]);
  const serverMeasurements: StoredGrowthEntry[] = dropTombstoned(reconciled).map(transformGrowthFromDb);
  return commitPulledCollection(scope, 'growth_measurements', serverMeasurements);
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

  await updateLocalGrowth(
    input.babyId,
    (measurements) => [...measurements, growth],
    createDurableQueueCommit({
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
    })
  );

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

  await updateLocalGrowth(
    babyId,
    (measurements) => measurements.map((g) => {
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
      }),
    createConditionalDurableQueueCommit(() => updatedGrowth
      ? ({
          type: 'UPDATE',
          table: 'growth_measurements',
          entityId: growthId,
          data: updateData,
        })
      : null)
  );

  if (!updatedGrowth) return null;

  return updatedGrowth;
}

export async function deleteGrowthFromDatabase(babyId: string, growthId: string): Promise<boolean> {
  await updateLocalGrowth(
    babyId,
    (measurements) => measurements.filter((g) => g.id !== growthId),
    createDurableQueueCommit({
      type: 'DELETE',
      table: 'growth_measurements',
      entityId: growthId,
      data: null,
    })
  );

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
  updater: (measurements: StoredGrowthEntry[]) => StoredGrowthEntry[],
  queueCommit?: DurableQueueCommit
): Promise<void> {
  const key = getUserScopedKey(`${KEYS.growth}${babyId}`);
  await updateLocalCollection(key, updater, queueCommit);
}

// ============ TUMMY TIME ============

export async function fetchTummyTimeFromDatabase(babyId: string): Promise<StoredTummyTimeEntry[]> {
  const scope = captureActivityPullScope(`${KEYS.tummyTime}${babyId}`);
  const { data, error } = await supabase
    .from("tummy_time_sessions")
    .select("*")
    .eq("baby_id", babyId)
    .order("started_at", { ascending: false });

  if (error) {
    console.error("[ActivitySync] Failed to fetch tummy time sessions:", error.message);
    throw new Error("Failed to fetch tummy time sessions");
  }

  const reconciled = await reconcilePulled("tummy_time_sessions", (data || []) as Record<string, unknown>[]);
  const serverSessions: StoredTummyTimeEntry[] = dropTombstoned(reconciled).map(transformTummyTimeFromDb);
  return commitPulledCollection(scope, 'tummy_time_sessions', serverSessions);
}

export async function createTummyTimeInDatabase(
  input: CreateTummyTimeInput,
  userId: string
): Promise<StoredTummyTimeEntry> {
  const now = new Date().toISOString();
  const id = input.id ?? generateId();

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

  let storedTummyTime = tummyTime;
  let alreadyExists = false;
  await updateLocalTummyTime(
    input.babyId,
    (sessions) => {
      const existing = sessions.find(session => session.id === id);
      if (existing) {
        alreadyExists = true;
        storedTummyTime = existing;
        return sessions;
      }
      return [...sessions, tummyTime];
    },
    createConditionalDurableQueueCommit(() => alreadyExists
      ? null
      : ({
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
        }))
  );

  return storedTummyTime;
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

  await updateLocalTummyTime(
    babyId,
    (sessions) => sessions.map((t) => {
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
      }),
    createConditionalDurableQueueCommit(() => updatedTummyTime
      ? ({
          type: 'UPDATE',
          table: 'tummy_time_sessions',
          entityId: tummyTimeId,
          data: updateData,
        })
      : null)
  );

  if (!updatedTummyTime) return null;

  return updatedTummyTime;
}

export async function deleteTummyTimeFromDatabase(babyId: string, tummyTimeId: string): Promise<boolean> {
  await updateLocalTummyTime(
    babyId,
    (sessions) => sessions.filter((t) => t.id !== tummyTimeId),
    createDurableQueueCommit({
      type: 'DELETE',
      table: 'tummy_time_sessions',
      entityId: tummyTimeId,
      data: null,
    })
  );

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
  updater: (sessions: StoredTummyTimeEntry[]) => StoredTummyTimeEntry[],
  queueCommit?: DurableQueueCommit
): Promise<void> {
  const key = getUserScopedKey(`${KEYS.tummyTime}${babyId}`);
  await updateLocalCollection(key, updater, queueCommit);
}

// ============ MILESTONES ============

export async function fetchMilestoneResponsesFromDatabase(babyId: string): Promise<StoredMilestoneResponse[]> {
  const scope = captureActivityPullScope(`${KEYS.milestones}${babyId}`);
  const { data, error } = await supabase
    .from("milestone_responses")
    .select("*")
    .eq("baby_id", babyId);

  if (error) {
    console.error("[ActivitySync] Failed to fetch milestone responses:", error.message);
    throw new Error("Failed to fetch milestone responses");
  }

  const reconciled = await reconcilePulled("milestone_responses", (data || []) as Record<string, unknown>[]);
  const serverResponses = reconciled.map(transformMilestoneResponseFromDb);
  const serverClocks = new Map(reconciled.map((row) => {
    const clocks = row.field_clocks && typeof row.field_clocks === 'object'
      ? row.field_clocks as FieldClocks
      : {};
    return [row.id as string, greatestClock(clocks)] as const;
  }));
  return commitPulledMilestoneResponses(scope, serverResponses, serverClocks);
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
    deleted: false,
    respondedAt: now,
    respondedBy: input.respondedBy,
    createdAt: now,
    updatedAt: now,
  };

  let storedResponse = response;
  const dbData: Record<string, unknown> = {
    id,
    baby_id: input.babyId,
    milestone_id: input.milestoneId,
    state: input.state,
    deleted: false,
    responded_at: now,
    responded_by: input.respondedBy,
    created_at: now,
    updated_at: now,
  };

  await updateLocalMilestoneResponses(
    input.babyId,
    (responses) => {
      const existing = responses.find((r) => r.milestoneId === input.milestoneId);
      if (existing) {
        storedResponse = {
          ...existing,
          state: input.state,
          deleted: false,
          respondedAt: now,
          updatedAt: now,
          respondedBy: input.respondedBy ?? existing.respondedBy,
        };
        let replaced = false;
        return responses.flatMap((item) => {
          if (item.milestoneId !== input.milestoneId) return [item];
          if (replaced) return [];
          replaced = true;
          return [storedResponse];
        });
      }
      return [...responses, response];
    },
    createConditionalDurableQueueCommit(() => existingId
      ? ({
          type: 'UPDATE',
          table: 'milestone_responses',
          entityId: id,
          data: {
            state: input.state,
            deleted: false,
            responded_at: now,
            responded_by: input.respondedBy,
            updated_at: now,
          },
        })
      : ({
          type: 'CREATE',
          table: 'milestone_responses',
          entityId: id,
          data: dbData,
        }))
  );

  return storedResponse;
}

export async function deleteMilestoneResponseFromDatabase(
  babyId: string,
  responseId: string,
  milestoneId: string
): Promise<boolean> {
  await updateLocalMilestoneResponses(
    babyId,
    (responses) => responses.map((response) =>
      response.milestoneId === milestoneId
        ? { ...response, deleted: true }
        : response
    ),
    createDurableQueueCommit({
      type: 'DELETE',
      table: 'milestone_responses',
      entityId: responseId,
      data: null,
    })
  );

  return true;
}

function transformMilestoneResponseFromDb(data: Record<string, unknown>): StoredMilestoneResponse {
  return {
    id: data.id as string,
    babyId: data.baby_id as string,
    milestoneId: data.milestone_id as string,
    state: data.state as MilestoneState,
    deleted: data.deleted === true,
    respondedAt: data.responded_at as string,
    respondedBy: data.responded_by as string | undefined,
    createdAt: (data.created_at as string) || new Date().toISOString(),
    updatedAt: (data.updated_at as string) || new Date().toISOString(),
  };
}

export async function retainRemoteMilestoneResponse(
  row: Record<string, unknown>
): Promise<StoredMilestoneResponse> {
  const canonical = transformMilestoneResponseFromDb(row);
  const scope = captureActivityPullScope(`${KEYS.milestones}${canonical.babyId}`);
  return withStorageLock(scope.key, async () => {
    assertActivityPullScope(scope);
    const pendingOperations = await getPendingEntityOperations(
      scope.engine,
      'milestone_responses'
    );
    assertActivityPullScope(scope);
    const localData = await AsyncStorage.getItem(scope.key);
    const localResponses: StoredMilestoneResponse[] = localData ? JSON.parse(localData) : [];
    const clocks = row.field_clocks && typeof row.field_clocks === 'object'
      ? row.field_clocks as FieldClocks
      : {};
    const reconciliation = reconcileMilestoneIdentity(
      scope,
      localResponses,
      localResponses,
      pendingOperations,
      canonical,
      greatestClock(clocks)
    );
    const nextValue = JSON.stringify(reconciliation.responses);

    if (reconciliation.recoveryOperation) {
      await queueSyncOperation(reconciliation.recoveryOperation, 'required', {
        key: scope.key,
        previousValue: localData,
        nextValue,
      });
    } else {
      await AsyncStorage.setItem(scope.key, nextValue);
    }
    assertActivityPullScope(scope);
    return reconciliation.retained;
  });
}

async function updateLocalMilestoneResponses(
  babyId: string,
  updater: (responses: StoredMilestoneResponse[]) => StoredMilestoneResponse[],
  queueCommit?: DurableQueueCommit
): Promise<void> {
  const key = getUserScopedKey(`${KEYS.milestones}${babyId}`);
  await updateLocalCollection(key, updater, queueCommit);
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
    const newId = await ensureUUID(feeding.id, 'feedings');
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

    await queueSyncOperation({
      type: 'CREATE',
      table: 'feedings',
      entityId: newId,
      data: dbRecord,
    }, 'required');

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
    const newId = await ensureUUID(diaper.id, 'diapers');
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

    await queueSyncOperation({
      type: 'CREATE',
      table: 'diapers',
      entityId: newId,
      data: dbRecord,
    }, 'required');

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
    const newId = await ensureUUID(sleep.id, 'sleep_sessions');
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

    await queueSyncOperation({
      type: 'CREATE',
      table: 'sleep_sessions',
      entityId: newId,
      data: dbRecord,
    }, 'required');

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
    const newId = await ensureUUID(pumping.id, 'pumping_sessions');
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

    await queueSyncOperation({
      type: 'CREATE',
      table: 'pumping_sessions',
      entityId: newId,
      data: dbRecord,
    }, 'required');

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
    const newId = await ensureUUID(growth.id, 'growth_measurements');
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

    await queueSyncOperation({
      type: 'CREATE',
      table: 'growth_measurements',
      entityId: newId,
      data: dbRecord,
    }, 'required');

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
    const newId = await ensureUUID(tummyTime.id, 'tummy_time_sessions');
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

    await queueSyncOperation({
      type: 'CREATE',
      table: 'tummy_time_sessions',
      entityId: newId,
      data: dbRecord,
    }, 'required');

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
  const scope = captureActivityPullScope(`${KEYS.health}${babyId}`);
  const { data, error } = await supabase
    .from("health_entries")
    .select("*")
    .eq("baby_id", babyId)
    .order("logged_at", { ascending: false });

  if (error) {
    console.error("[ActivitySync] Failed to fetch health:", error.message);
    throw new Error("Failed to fetch health");
  }

  const reconciled = await reconcilePulled("health_entries", (data || []) as Record<string, unknown>[]);
  const serverEntries: StoredHealthEntry[] = dropTombstoned(reconciled).map(transformHealthFromDb);
  return commitPulledCollection(scope, 'health_entries', serverEntries);
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

  await updateLocalHealth(
    input.babyId,
    (entries) => [...entries, entry],
    createDurableQueueCommit({
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
    })
  );

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

  await updateLocalHealth(
    babyId,
    (entries) => entries.map((h) => {
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
      }),
    createConditionalDurableQueueCommit(() => updatedEntry
      ? ({
          type: 'UPDATE',
          table: 'health_entries',
          entityId: healthId,
          data: updateData,
        })
      : null)
  );

  if (!updatedEntry) return null;

  return updatedEntry;
}

export async function deleteHealthFromDatabase(babyId: string, healthId: string): Promise<boolean> {
  await updateLocalHealth(
    babyId,
    (entries) => entries.filter((h) => h.id !== healthId),
    createDurableQueueCommit({
      type: 'DELETE',
      table: 'health_entries',
      entityId: healthId,
      data: null,
    })
  );

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
  updater: (entries: StoredHealthEntry[]) => StoredHealthEntry[],
  queueCommit?: DurableQueueCommit
): Promise<void> {
  const key = getUserScopedKey(`${KEYS.health}${babyId}`);
  await updateLocalCollection(key, updater, queueCommit);
}

import AsyncStorage from "@react-native-async-storage/async-storage";
import { sourceFingerprint, importId } from "./import-identities";
import type {
  HuckleberryPreview,
  HuckleberryRecord,
} from "./huckleberry-reader";
import {
  activityCollectionKey,
  createImportedActivityBatch,
  type ActivityRangeEntryMap,
  type TimelineActivityTable,
} from "../activity-sync-service";
import { getImportedIds, settleImportJournal } from "./import-journal";
import { withStorageLock } from "../activity-storage-lock";
import { getStorageUserId } from "../storage-prefix";
import { getCrdtSync } from "../sync/crdt-sync-instance";
import { DEFAULT_SYNC_CONFIG } from "../sync/types";
import { getSyncEngine } from "@/contexts/sync-context";
import { supabase } from "../supabase";
import { classifyImportedMorningSleep } from "@/utils/sleepPredictions";
import {
  getSleepAgeGroupForBaby,
  WAKE_WINDOW_PROGRESSIONS,
} from "@/utils/sleepGoals";
import { MORNING_CLASSIFICATION_VERSION } from "@/types/sleep";
import type { StoredSleepEntry } from "../sleep-storage";

export const IMPORT_TABLES: Record<
  HuckleberryRecord["kind"],
  TimelineActivityTable
> = {
  sleep: "sleep_sessions",
  feeding: "feedings",
  diaper: "diapers",
  growth: "growth_measurements",
  pumping: "pumping_sessions",
  health: "health_entries",
  tummyTime: "tummy_time_sessions",
};
type PreparedRecord = {
  id: string;
  fingerprint: string;
  legacyId: string;
  record: HuckleberryRecord;
};
export interface ImportPlan {
  preview: HuckleberryPreview;
  babyId: string;
  userId?: string;
  householdId?: string;
  storageUserId: string | null;
  records: PreparedRecord[];
  alreadyImported: number;
}

function assertScope(
  plan: Pick<ImportPlan, "storageUserId" | "userId" | "householdId">
): void {
  if (
    getStorageUserId() !== plan.storageUserId ||
    (plan.userId &&
      (getSyncEngine()?.getAuthContext()?.userId !== plan.userId ||
        getSyncEngine()?.getAuthContext()?.householdId !== plan.householdId))
  ) {
    throw new Error("Import account changed");
  }
}

export function assertImportReady(userId?: string): void {
  if (!userId) return;
  const engine = getSyncEngine();
  const state = engine?.getState();
  if (
    engine?.getAuthContext()?.userId !== userId ||
    !state?.isConnected ||
    state.pendingCount ||
    state.status === "syncing" ||
    state.status === "error"
  ) {
    throw new Error("connectAndSync");
  }
}

export async function prepareImport(
  preview: HuckleberryPreview,
  babyId: string,
  userId?: string
): Promise<ImportPlan> {
  assertImportReady(userId);
  const plan: ImportPlan = {
    preview,
    babyId,
    userId,
    householdId: userId
      ? getSyncEngine()?.getAuthContext()?.householdId
      : undefined,
    storageUserId: getStorageUserId(),
    records: [],
    alreadyImported: 0,
  };
  const candidates: PreparedRecord[] = [];
  for (const record of preview.records) {
    const fingerprint = await sourceFingerprint(record.content);
    const id = await importId(babyId, fingerprint, preview.source);
    candidates.push({
      id,
      fingerprint,
      legacyId:
        preview.source === "nara"
          ? id
          : await importId(babyId, record.content, preview.source),
      record,
    });
  }
  const crdt = await getCrdtSync();
  for (const table of Object.values(IMPORT_TABLES)) {
    const group = candidates.filter(
      (item) => IMPORT_TABLES[item.record.kind] === table
    );
    if (!group.length) continue;
    const key = activityCollectionKey(table, babyId);
    const known = await withStorageLock(key, async () => {
      assertScope(plan);
      await settleImportJournal(key);
      const ids = await getImportedIds(key);
      const raw = await AsyncStorage.getItem(key);
      const entries: { id: string }[] = raw ? JSON.parse(raw) : [];
      for (const entry of entries) ids.add(entry.id);
      return ids;
    });
    for (
      let offset = 0;
      offset < group.length;
      offset += DEFAULT_SYNC_CONFIG.batchSize
    ) {
      const batch = group.slice(offset, offset + DEFAULT_SYNC_CONFIG.batchSize);
      if (userId) {
        const result = await supabase
          .from(table)
          .select("id")
          .eq("baby_id", babyId)
          .in(
            "id",
            batch.flatMap((item) =>
              item.id === item.legacyId ? [item.id] : [item.id, item.legacyId]
            )
          );
        if (result.error) throw new Error("Import history unavailable");
        for (const entry of result.data ?? []) known.add(entry.id);
      }
      for (const item of batch) {
        if (
          known.has(item.id) ||
          known.has(item.legacyId) ||
          (await crdt.getShadow(table, item.id)) ||
          (item.legacyId !== item.id &&
            (await crdt.getShadow(table, item.legacyId)))
        )
          plan.alreadyImported++;
        else plan.records.push(item);
      }
      assertScope(plan);
    }
  }
  return plan;
}

export async function importRecords(
  plan: ImportPlan,
  onProgress?: (added: number, total: number) => void,
  shouldStop?: () => boolean,
  sleepOptions: {
    dayStartHour?: number;
    napContinuationMinutes?: number;
    birthDate?: string | Date;
  } = {}
): Promise<{ added: number; alreadyImported: number }> {
  assertScope(plan);
  assertImportReady(plan.userId);
  let added = 0;
  let alreadyImported = plan.alreadyImported;
  for (const table of Object.values(IMPORT_TABLES)) {
    const group = plan.records.filter(
      (item) => IMPORT_TABLES[item.record.kind] === table
    );
    if (table === "sleep_sessions")
      group.sort((a, b) =>
        a.record.kind === "sleep" && b.record.kind === "sleep"
          ? a.record.input.startedAt.getTime() -
            b.record.input.startedAt.getTime()
          : 0
      );
    for (
      let offset = 0;
      offset < group.length;
      offset += DEFAULT_SYNC_CONFIG.batchSize
    ) {
      if (shouldStop?.()) return { added, alreadyImported };
      assertScope(plan);
      const batch = group.slice(offset, offset + DEFAULT_SYNC_CONFIG.batchSize);
      const now = new Date().toISOString();
      const entries = batch.map(({ id, record }) => ({
        ...Object.fromEntries(
          Object.entries(record.input).map(([key, value]) => [
            key,
            value instanceof Date ? value.toISOString() : value,
          ])
        ),
        id,
        babyId: plan.babyId,
        ...(plan.userId ? { loggedBy: plan.userId } : {}),
        createdAt: now,
        updatedAt: now,
      })) as ActivityRangeEntryMap[typeof table][];
      if (table === "sleep_sessions") {
        const raw = await AsyncStorage.getItem(
          activityCollectionKey(table, plan.babyId)
        );
        const sleeps: StoredSleepEntry[] = raw ? JSON.parse(raw) : [];
        const zones = new Map(
          entries.map((entry, index) => [entry, batch[index].record.timeZone])
        );
        for (const entry of [...(entries as StoredSleepEntry[])].sort((a, b) =>
          a.startedAt.localeCompare(b.startedAt)
        )) {
          const ageGroup = sleepOptions.birthDate
            ? getSleepAgeGroupForBaby(
                new Date(sleepOptions.birthDate),
                new Date(entry.startedAt)
              )
            : null;
          const morning = classifyImportedMorningSleep(sleeps, entry, {
            dayStartHour: sleepOptions.dayStartHour ?? 6,
            continuationAllowanceMinutes:
              sleepOptions.napContinuationMinutes ?? 25,
            firstWakeWindowMinutes: ageGroup
              ? WAKE_WINDOW_PROGRESSIONS[ageGroup.label]?.windows[0]
              : undefined,
            referenceDate: new Date(entry.endedAt ?? entry.startedAt),
            timeZone: zones.get(entry),
          });
          // History is never left for the parent to confirm. Other sleeps stay unlabelled,
          // sent as explicit nulls so the server's version default cannot make them pending.
          entry.morningClassification = morning;
          entry.morningClassificationVersion = morning
            ? MORNING_CLASSIFICATION_VERSION
            : null;
          sleeps.push(entry);
        }
      }
      assertScope(plan);
      const saved = await createImportedActivityBatch(
        table,
        plan.babyId,
        entries,
        plan.userId,
        (count) => onProgress?.(added + count, plan.records.length)
      );
      added += saved;
      alreadyImported += batch.length - saved;
      onProgress?.(added, plan.records.length);
      if (plan.userId) {
        const engine = getSyncEngine();
        await engine?.sync();
        assertScope(plan);
        if (
          !engine ||
          engine.getPendingCount() ||
          !engine.getState().isConnected ||
          engine.getState().status === "error"
        )
          throw new Error("Import sync incomplete");
      }
    }
  }
  if (plan.userId) await getSyncEngine()?.sync();
  return { added, alreadyImported };
}

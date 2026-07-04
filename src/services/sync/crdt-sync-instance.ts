/**
 * App-facing wiring for {@link CrdtSync}: the AsyncStorage-backed shadow store and the
 * lazily-built process singleton. Kept separate from the pure `crdt-sync.ts` module so
 * the coordinator logic and its tests never import native modules.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { CrdtSync, reconcilePulledRows, type ShadowStore } from "./crdt-sync";
import type { ClockedRecord } from "./crdt";
import type { SyncableTable } from "./types";
import { AsyncStorageClockStorage } from "./crdt-storage";
import { getDeviceId } from "./device-id";

// One AsyncStorage key per record (`@crdt_shadow:<table>:<id>`) so a write touches only
// its own row rather than rewriting a single monolithic blob — O(1) per sync op.
export const SHADOW_KEY_PREFIX = "@crdt_shadow:";

export class AsyncStorageShadowStore implements ShadowStore {
  async get(key: string): Promise<ClockedRecord | null> {
    const raw = await AsyncStorage.getItem(`${SHADOW_KEY_PREFIX}${key}`);
    if (!raw) return null;
    try {
      const parsed = JSON.parse(raw) as unknown;
      // A valid shadow record is a plain object carrying a `fieldClocks` map. Reject
      // anything else (corruption, or foreign data) rather than feeding a malformed
      // record into `merge`.
      if (
        !parsed ||
        typeof parsed !== "object" ||
        typeof (parsed as { fieldClocks?: unknown }).fieldClocks !== "object" ||
        (parsed as { fieldClocks?: unknown }).fieldClocks === null
      ) {
        return null;
      }
      return parsed as ClockedRecord;
    } catch {
      await AsyncStorage.removeItem(`${SHADOW_KEY_PREFIX}${key}`);
      return null;
    }
  }

  async set(key: string, record: ClockedRecord): Promise<void> {
    await AsyncStorage.setItem(`${SHADOW_KEY_PREFIX}${key}`, JSON.stringify(record));
  }

  async delete(key: string): Promise<void> {
    await AsyncStorage.removeItem(`${SHADOW_KEY_PREFIX}${key}`);
  }
}

let singleton: CrdtSync | null = null;
let building: Promise<CrdtSync> | null = null;

/** Return the process-wide CRDT coordinator, building and hydrating it on first use. */
export async function getCrdtSync(): Promise<CrdtSync> {
  if (singleton) return singleton;
  if (building) return building;

  building = (async () => {
    const deviceId = await getDeviceId();
    const sync = new CrdtSync({
      deviceId,
      clockStorage: new AsyncStorageClockStorage(),
      shadowStore: new AsyncStorageShadowStore(),
    });
    await sync.ready();
    singleton = sync;
    return sync;
  })();

  try {
    return await building;
  } finally {
    building = null;
  }
}

export function __resetCrdtSyncForTests(): void {
  singleton = null;
  building = null;
}

/**
 * Reconcile server rows from a foreground pull against local CRDT state using the process
 * coordinator. Advances the HLC by every pulled clock and preserves newer local edits.
 */
export async function reconcilePulled(
  table: SyncableTable,
  rows: Record<string, unknown>[],
): Promise<Record<string, unknown>[]> {
  const crdt = await getCrdtSync();
  return reconcilePulledRows(crdt, table, rows);
}

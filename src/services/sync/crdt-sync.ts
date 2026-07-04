/**
 * CRDT sync coordinator: the bridge between the pure `crdt.ts` primitives and the live
 * sync path. It owns the device's HLC and a per-record "shadow" of the last clocked
 * value it has seen for each row, and exposes the three operations the sync layer needs:
 *
 *  - `stampWrite`  — on local create/edit: diff against the shadow, stamp fresh HLC
 *    clocks onto the changed fields, fold them into the shadow, and return the clocks so
 *    the caller can ship them to the `merge_record` RPC.
 *  - `reconcileRemote` — on an incoming Realtime row (or a foreground-pulled row): fold
 *    the remote clocks into the HLC, merge the row against the shadow, and return the
 *    merged row so a stale remote update can never regress a newer local field.
 *  - `forget` — drop a record's shadow (on delete).
 *
 * The shadow is stored in the wire/DB representation (snake_case columns + a
 * `field_clocks` map keyed by those same column names), exactly as sent to and received
 * from Supabase. It never key-converts data values, so it introduces no risk of dropping
 * or corrupting a field — the #1 concern the CRDT work exists to eliminate.
 */
import { HLC, merge, stampChanges, type ClockStorage, type ClockedRecord, type FieldClocks } from "./crdt";
import type { SyncableTable } from "./types";

/** The 9 tables that use CRDT conflict resolution. `milestones` is the DB table
 * `milestone_responses`; the others match their column-family names. */
export const CRDT_TABLES: readonly SyncableTable[] = [
  "feedings",
  "sleep_sessions",
  "diapers",
  "pumping_sessions",
  "growth_measurements",
  "tummy_time_sessions",
  "health_entries",
  "milestone_responses",
  "babies",
];

const CRDT_TABLE_SET: ReadonlySet<string> = new Set(CRDT_TABLES);

export function isCrdtTable(table: string): table is SyncableTable {
  return CRDT_TABLE_SET.has(table);
}

/** The DB column carrying the per-field HLC map. */
export const FIELD_CLOCKS_COLUMN = "field_clocks";

/** Per-record persistence of the last-seen clocked value. Key = `${table}:${id}`. */
export interface ShadowStore {
  get(key: string): Promise<ClockedRecord | null>;
  set(key: string, record: ClockedRecord): Promise<void>;
  delete(key: string): Promise<void>;
}

export interface CrdtSyncOptions {
  deviceId: string;
  clockStorage: ClockStorage;
  shadowStore: ShadowStore;
  clock?: () => number;
}

function shadowKey(table: string, entityId: string): string {
  return `${table}:${entityId}`;
}

/** Split a wire row into its data fields and its field-clock map. */
function toClockedRecord(row: Record<string, unknown>): ClockedRecord {
  const { [FIELD_CLOCKS_COLUMN]: clocks, ...data } = row;
  const fieldClocks = (clocks && typeof clocks === "object" ? clocks : {}) as FieldClocks;
  return { ...data, fieldClocks };
}

/** Re-assemble a clocked record into a wire row (data fields + `field_clocks`). */
function toWireRow(record: ClockedRecord): Record<string, unknown> {
  const { fieldClocks, ...data } = record;
  return { ...data, [FIELD_CLOCKS_COLUMN]: fieldClocks };
}

export class CrdtSync {
  private readonly hlc: HLC;
  private readonly shadowStore: ShadowStore;
  private hydrated: Promise<void> | null = null;

  constructor(options: CrdtSyncOptions) {
    this.hlc = new HLC({
      deviceId: options.deviceId,
      storage: options.clockStorage,
      clock: options.clock,
    });
    this.shadowStore = options.shadowStore;
  }

  /** Hydrate the HLC from persisted storage exactly once. */
  async ready(): Promise<void> {
    if (!this.hydrated) {
      this.hydrated = this.hlc.hydrate();
    }
    return this.hydrated;
  }

  /**
   * Stamp the changed fields of a local write and fold the result into the shadow.
   * `data` is the snake_case row (a full row on create, a partial on update). Returns
   * the field-clock map for exactly the fields carried in `data`, to send to the RPC.
   */
  async stampWrite(
    table: SyncableTable,
    entityId: string,
    data: Record<string, unknown>,
  ): Promise<FieldClocks> {
    await this.ready();
    const key = shadowKey(table, entityId);
    const prev = await this.shadowStore.get(key);

    const stamped = stampChanges(
      prev ? toClockedRecord(toWireRow(prev)) : null,
      data,
      () => this.hlc.tick(),
    );
    const stampedRecord: ClockedRecord = { ...data, fieldClocks: stamped.fieldClocks };

    const merged = prev ? merge(prev, stampedRecord) : stampedRecord;
    await this.shadowStore.set(key, merged);

    return stamped.fieldClocks;
  }

  /**
   * Merge an incoming remote row (Realtime event or foreground-pulled row) against the
   * local shadow. Feeds every remote clock into the HLC first so local causality advances
   * past what it has observed, then returns the merged wire row — the value a stale remote
   * update cannot regress below a newer local field.
   *
   * A shadow is kept only for records this device has itself edited (i.e. one already
   * exists). A record we only ever receive has no local edit to protect, so we advance the
   * HLC and pass the row through without minting a shadow — otherwise a full foreground
   * pull would write one shadow per historical row.
   */
  async reconcileRemote(
    table: SyncableTable,
    entityId: string,
    remoteRow: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    await this.ready();
    const remote = toClockedRecord(remoteRow);

    this.hlc.receiveMany(Object.values(remote.fieldClocks));

    const key = shadowKey(table, entityId);
    const prev = await this.shadowStore.get(key);
    if (!prev) {
      return toWireRow(remote);
    }

    const merged = merge(prev, remote);
    await this.shadowStore.set(key, merged);
    return toWireRow(merged);
  }

  /** Drop a record's shadow (on delete). */
  async forget(table: SyncableTable, entityId: string): Promise<void> {
    await this.shadowStore.delete(shadowKey(table, entityId));
  }

  /** Read the current shadow for a record (the last-seen clocked value), or null. */
  async getShadow(table: SyncableTable, entityId: string): Promise<ClockedRecord | null> {
    return this.shadowStore.get(shadowKey(table, entityId));
  }
}

/** A remote row change as emitted by the Realtime layer (or a foreground pull). */
export interface RemoteRowChange {
  table: string;
  eventType: "INSERT" | "UPDATE" | "DELETE";
  new?: Record<string, unknown> | null;
  old?: Record<string, unknown> | null;
}

/**
 * Reconcile an incoming remote change against local CRDT state before it is dispatched
 * to the contexts. For an in-scope INSERT/UPDATE the row is merged against the shadow so
 * a stale remote write cannot regress a newer local field; the returned change carries
 * the merged row in `new`. In-scope DELETEs drop the shadow. Out-of-scope changes (and
 * rows without an id) pass through untouched, so callers can use one code path.
 */
export async function reconcileRemoteChange(
  crdt: CrdtSync,
  change: RemoteRowChange,
): Promise<RemoteRowChange> {
  if (!isCrdtTable(change.table)) return change;

  if (change.eventType === "DELETE") {
    const id = change.old?.id;
    if (typeof id === "string") {
      await crdt.forget(change.table, id);
    }
    return change;
  }

  const row = change.new;
  const id = row?.id;
  if (!row || typeof id !== "string") return change;

  const merged = await crdt.reconcileRemote(change.table, id, row);
  return { ...change, new: merged };
}

/**
 * Reconcile a batch of rows fetched from the server (foreground pull / initial load)
 * against local CRDT state. Each row's clocks advance the HLC and, for records the device
 * has locally edited, merge against the shadow so a pulled row can't clobber a newer local
 * edit. Returns the rows to persist/display, in the same order. Rows without a string id
 * pass through untouched.
 */
export async function reconcilePulledRows(
  crdt: CrdtSync,
  table: SyncableTable,
  rows: Record<string, unknown>[],
): Promise<Record<string, unknown>[]> {
  const out: Record<string, unknown>[] = [];
  for (const row of rows) {
    const id = row.id;
    if (typeof id !== "string") {
      out.push(row);
      continue;
    }
    out.push(await crdt.reconcileRemote(table, id, row));
  }
  return out;
}

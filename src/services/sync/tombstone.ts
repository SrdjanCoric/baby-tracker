import type { RemoteChange } from "./real-time-sync";

/**
 * Translate a remote change into a delete decision. A CRDT tombstone arrives as an
 * INSERT/UPDATE row carrying `deleted: true`; a legacy hard delete (pre-tombstone clients)
 * arrives as a DELETE event. Both must remove the record from context state, so contexts can
 * treat either as a `REMOTE_DELETE`. Returns the id to remove, or null when the change carries
 * a live (non-deleted) row — an ordinary edit or an un-delete/restore.
 */
export function tombstonedId(change: RemoteChange): string | null {
  const row = change.new;
  if (row && row.deleted === true) {
    return typeof row.id === "string" ? row.id : null;
  }
  if (change.eventType === "DELETE") {
    const id = change.old?.id;
    return typeof id === "string" ? id : null;
  }
  return null;
}

/**
 * Drop tombstoned rows from a pulled result set. Applied to every read of the CRDT tables
 * **after** reconciliation (so tombstone clocks still fold into the local shadow) and before the
 * rows reach storage/UI, so a `deleted: true` row never surfaces.
 */
export function dropTombstoned<T extends { deleted?: unknown }>(rows: T[]): T[] {
  return rows.filter((row) => row.deleted !== true);
}

/**
 * Add-or-replace a record by id, returning a new array. A remote `REMOTE_UPDATE` must upsert
 * (not just replace in place) so that an un-delete/restore — which arrives as an UPDATE for a
 * record the receiver previously hid — re-adds the record instead of silently dropping it.
 */
export function upsertById<T extends { id: string }>(list: T[], item: T): T[] {
  const index = list.findIndex((entry) => entry.id === item.id);
  if (index === -1) return [...list, item];
  const next = list.slice();
  next[index] = item;
  return next;
}

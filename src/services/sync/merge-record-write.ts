/**
 * Direct (non-queued) write of an in-scope record through the server-side `merge_record`
 * RPC. Used by the write paths that bypass the sync engine's offline queue — the
 * activity-sync fallback, guest-migration upserts, and baby writes — so they too stamp
 * per-field HLC clocks and merge instead of clobbering.
 */
import { supabase } from "../supabase";
import { getCrdtSync } from "./crdt-sync-instance";
import type { SyncableTable } from "./types";

export async function mergeRecordWrite(
  table: SyncableTable,
  entityId: string,
  data: Record<string, unknown>,
): Promise<{ data: Record<string, unknown> | null; error: { message: string } | null }> {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) {
    return {
      data: null,
      error: { message: authError?.message ?? 'Authenticated user is required' },
    };
  }

  const crdt = await getCrdtSync();
  const clocks = await crdt.stampWrite(table, entityId, data);
  const { data: merged, error } = await supabase.rpc("merge_record", {
    p_table: table,
    p_record: { id: entityId, ...data },
    p_field_clocks: clocks,
    p_operation_id: `direct-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
    p_expected_user_id: authData.user.id,
  });
  return {
    data: (merged as Record<string, unknown> | null) ?? null,
    error: error ? { message: error.message } : null,
  };
}

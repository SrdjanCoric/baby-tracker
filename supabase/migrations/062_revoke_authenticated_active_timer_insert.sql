-- Timer acquisition is an atomic authorization decision made by acquire_timer_lock. Phone and
-- Watch clients, including the May 2026 request shapes, call that RPC and do not need direct table
-- INSERT. Keep SELECT for household timer visibility and the Watch fingerprint probe, keep DELETE
-- for owner-scoped stop paths, and expose UPDATE only for the mutable timer fields used by pause
-- and start-time edits. Lock identity remains owned by acquire_timer_lock.
--
-- Emergency rollback: restoring the previous capability requires only the following statement:
--
--   GRANT INSERT ON TABLE public.active_timers TO authenticated;
--
-- The existing INSERT row-level-security policy is deliberately retained so that this grant is a
-- complete rollback. Do not drop that policy as part of this migration.

BEGIN;

REVOKE INSERT ON TABLE public.active_timers FROM authenticated;
REVOKE UPDATE ON TABLE public.active_timers FROM authenticated;
GRANT UPDATE (started_at, timer_data) ON public.active_timers TO authenticated;

DO $$
BEGIN
  IF pg_catalog.has_table_privilege(
    'authenticated',
    'public.active_timers',
    'INSERT'
  ) THEN
    RAISE EXCEPTION 'authenticated still has direct active_timers INSERT';
  END IF;

  IF NOT pg_catalog.has_table_privilege(
    'authenticated',
    'public.active_timers',
    'SELECT'
  ) OR NOT pg_catalog.has_table_privilege(
    'authenticated',
    'public.active_timers',
    'DELETE'
  ) THEN
    RAISE EXCEPTION 'authenticated lost required active_timers SELECT or DELETE';
  END IF;

  IF NOT pg_catalog.has_column_privilege(
    'authenticated',
    'public.active_timers',
    'started_at',
    'UPDATE'
  ) OR NOT pg_catalog.has_column_privilege(
    'authenticated',
    'public.active_timers',
    'timer_data',
    'UPDATE'
  ) THEN
    RAISE EXCEPTION 'authenticated lost required mutable active_timers columns';
  END IF;

  IF pg_catalog.has_column_privilege(
    'authenticated',
    'public.active_timers',
    'baby_id',
    'UPDATE'
  ) OR pg_catalog.has_column_privilege(
    'authenticated',
    'public.active_timers',
    'activity_type',
    'UPDATE'
  ) OR pg_catalog.has_column_privilege(
    'authenticated',
    'public.active_timers',
    'started_by',
    'UPDATE'
  ) THEN
    RAISE EXCEPTION 'authenticated can mutate active_timers lock identity';
  END IF;

  IF NOT pg_catalog.has_function_privilege(
    'authenticated',
    'public.acquire_timer_lock(uuid, character varying, uuid, jsonb, timestamp with time zone)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'authenticated cannot execute acquire_timer_lock after INSERT revoke';
  END IF;
END
$$;

COMMIT;

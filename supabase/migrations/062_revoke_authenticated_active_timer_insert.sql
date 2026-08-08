-- Timer acquisition is an atomic authorization decision made by acquire_timer_lock. Phone and
-- Watch clients, including the May 2026 request shapes, call that RPC and do not need direct table
-- INSERT. Keep SELECT for household timer visibility and the Watch fingerprint probe, plus the
-- existing table-level UPDATE/DELETE capabilities used by current and legacy owner edit/stop paths.
-- A value-change guard prevents direct UPDATE from relocating an acquired lock to another baby,
-- activity type, or owner without rejecting backward-compatible full-row updates.
--
-- Emergency rollback for direct timer acquisition requires only the following statement:
--
--   GRANT INSERT ON TABLE public.active_timers TO authenticated;
--
-- The existing INSERT row-level-security policy is deliberately retained so that this grant is a
-- complete rollback for direct acquisition. The UPDATE guard does not affect INSERT.

BEGIN;

CREATE OR REPLACE FUNCTION public.guard_authenticated_active_timer_identity()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF current_user = 'authenticated'
    AND (
      NEW.baby_id IS DISTINCT FROM OLD.baby_id
      OR NEW.activity_type IS DISTINCT FROM OLD.activity_type
      OR NEW.started_by IS DISTINCT FROM OLD.started_by
    )
  THEN
    RAISE EXCEPTION 'authenticated callers cannot change active timer lock identity'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_authenticated_active_timer_identity()
FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS guard_authenticated_active_timer_identity
ON public.active_timers;
CREATE TRIGGER guard_authenticated_active_timer_identity
  BEFORE UPDATE ON public.active_timers
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_authenticated_active_timer_identity();

REVOKE INSERT ON TABLE public.active_timers FROM authenticated;
GRANT UPDATE ON TABLE public.active_timers TO authenticated;

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
    'UPDATE'
  ) OR NOT pg_catalog.has_table_privilege(
    'authenticated',
    'public.active_timers',
    'DELETE'
  ) THEN
    RAISE EXCEPTION 'authenticated lost required active_timers read or owner-write privilege';
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

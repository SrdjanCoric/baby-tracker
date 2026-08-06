-- Keep every active timer lock inside the same reclaimability horizon used by
-- cleanup_stale_timer_locks. Reject every future start, and do not reject unrelated updates to a
-- grandfathered stale lock.

CREATE OR REPLACE FUNCTION public.validate_active_timer_started_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.started_at IS DISTINCT FROM OLD.started_at THEN
    IF NEW.started_at > pg_catalog.now() THEN
      RAISE EXCEPTION 'active timer start cannot be in the future'
        USING ERRCODE = '22023';
    END IF;

    IF NEW.started_at < pg_catalog.now() - INTERVAL '12 hours' THEN
      RAISE EXCEPTION 'active timer start cannot be older than twelve hours'
        USING ERRCODE = '22023';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Repair locks written before this guard existed. A future lock cannot represent a valid running
-- timer and would otherwise remain unreclaimable.
DELETE FROM public.active_timers
WHERE started_at > pg_catalog.now();

DROP TRIGGER IF EXISTS validate_active_timer_started_at ON public.active_timers;
CREATE TRIGGER validate_active_timer_started_at
  BEFORE INSERT OR UPDATE ON public.active_timers
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_active_timer_started_at();

COMMENT ON FUNCTION public.validate_active_timer_started_at() IS
'Rejects future active-timer starts and starts older than the twelve-hour stale-lock cleanup horizon while allowing valid started-at corrections and unrelated updates to existing locks.';

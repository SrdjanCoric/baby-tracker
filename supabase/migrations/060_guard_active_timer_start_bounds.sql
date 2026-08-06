-- Keep every active timer lock inside the same reclaimability horizon used by
-- cleanup_stale_timer_locks. Normalize small positive client-clock skew to database time, reject
-- larger future values, and do not reject unrelated updates to a grandfathered stale lock.

CREATE OR REPLACE FUNCTION public.validate_active_timer_started_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.started_at IS DISTINCT FROM OLD.started_at THEN
    IF NEW.started_at > pg_catalog.now() + INTERVAL '5 minutes' THEN
      RAISE EXCEPTION 'active timer start cannot be in the future'
        USING ERRCODE = '22023';
    END IF;

    IF NEW.started_at > pg_catalog.now() THEN
      NEW.started_at := pg_catalog.now();
    END IF;

    IF NEW.started_at < pg_catalog.now() - INTERVAL '12 hours' THEN
      RAISE EXCEPTION 'active timer start cannot be older than twelve hours'
        USING ERRCODE = '22023';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

-- Repair locks written before this guard existed. A far-future lock cannot represent a valid
-- running timer and would otherwise remain unreclaimable; small client-clock skew is preserved by
-- normalizing it to the database clock, matching the trigger's behavior for new writes.
DELETE FROM public.active_timers
WHERE started_at > pg_catalog.now() + INTERVAL '5 minutes';

UPDATE public.active_timers
SET started_at = pg_catalog.now()
WHERE started_at > pg_catalog.now();

DROP TRIGGER IF EXISTS validate_active_timer_started_at ON public.active_timers;
CREATE TRIGGER validate_active_timer_started_at
  BEFORE INSERT OR UPDATE ON public.active_timers
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_active_timer_started_at();

COMMENT ON FUNCTION public.validate_active_timer_started_at() IS
'Normalizes up to five minutes of positive client-clock skew, rejects larger future starts and starts older than the twelve-hour stale-lock cleanup horizon, and allows unrelated updates to existing locks.';

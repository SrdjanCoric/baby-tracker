-- Keep every active timer lock inside the same reclaimability horizon used by
-- cleanup_stale_timer_locks. Normalize at most one second of positive client-clock skew, reject
-- anything further ahead, and do not reject unrelated updates to a grandfathered stale lock.

CREATE OR REPLACE FUNCTION public.validate_active_timer_started_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = ''
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.started_at IS DISTINCT FROM OLD.started_at THEN
    IF NEW.started_at > pg_catalog.now() + INTERVAL '1 second' THEN
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

-- Repair locks written before this guard existed. Discard values beyond the compatibility band,
-- then normalize the remaining positive skew to database time.
DELETE FROM public.active_timers
WHERE started_at > pg_catalog.now() + INTERVAL '1 second';

UPDATE public.active_timers
SET started_at = pg_catalog.now()
WHERE started_at > pg_catalog.now();

DROP TRIGGER IF EXISTS validate_active_timer_started_at ON public.active_timers;
CREATE TRIGGER validate_active_timer_started_at
  BEFORE INSERT OR UPDATE ON public.active_timers
  FOR EACH ROW
  EXECUTE FUNCTION public.validate_active_timer_started_at();

-- Return the timestamp persisted after BEFORE INSERT triggers run. This keeps legacy clients that
-- compare lock timestamps aligned with the normalized database row.
CREATE OR REPLACE FUNCTION public.acquire_timer_lock(
  p_baby_id UUID,
  p_activity_type VARCHAR(20),
  p_user_id UUID,
  p_timer_data JSONB DEFAULT NULL,
  p_started_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS TABLE (
  success BOOLEAN,
  lock_holder_id UUID,
  lock_holder_name VARCHAR(100),
  started_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_existing RECORD;
  v_started_at TIMESTAMPTZ := COALESCE(p_started_at, pg_catalog.now());
BEGIN
  IF v_caller_id IS NULL OR p_user_id IS DISTINCT FROM v_caller_id THEN
    RAISE EXCEPTION 'authenticated caller does not match timer user'
      USING ERRCODE = '42501';
  END IF;

  IF p_activity_type IS NULL OR p_activity_type NOT IN ('feeding', 'sleep', 'pumping', 'tummy_time') THEN
    RAISE EXCEPTION 'invalid timer activity type'
      USING ERRCODE = '22023';
  END IF;

  IF p_timer_data IS NOT NULL AND pg_catalog.jsonb_typeof(p_timer_data) <> 'object' THEN
    RAISE EXCEPTION 'timer data must be a JSON object'
      USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.babies AS baby
    JOIN public.users AS caregiver
      ON caregiver.household_id = baby.household_id
    WHERE baby.id = p_baby_id
      AND caregiver.id = v_caller_id
      AND baby.deleted = false
  ) THEN
    RAISE EXCEPTION 'caller cannot control timers for this baby'
      USING ERRCODE = '42501';
  END IF;

  SELECT timer.started_by, timer.started_at, caregiver.display_name
  INTO v_existing
  FROM public.active_timers AS timer
  JOIN public.users AS caregiver ON caregiver.id = timer.started_by
  WHERE timer.baby_id = p_baby_id
    AND timer.activity_type = p_activity_type;

  IF FOUND THEN
    RETURN QUERY
    SELECT false, v_existing.started_by, v_existing.display_name, v_existing.started_at;
    RETURN;
  END IF;

  BEGIN
    INSERT INTO public.active_timers AS inserted_timer (
      baby_id,
      activity_type,
      started_by,
      started_at,
      timer_data
    )
    VALUES (
      p_baby_id,
      p_activity_type,
      v_caller_id,
      v_started_at,
      p_timer_data
    )
    RETURNING inserted_timer.started_at INTO v_started_at;

    RETURN QUERY
    SELECT
      true,
      v_caller_id,
      caregiver.display_name,
      v_started_at
    FROM public.users AS caregiver
    WHERE caregiver.id = v_caller_id;
  EXCEPTION WHEN unique_violation THEN
    SELECT timer.started_by, timer.started_at, caregiver.display_name
    INTO v_existing
    FROM public.active_timers AS timer
    JOIN public.users AS caregiver ON caregiver.id = timer.started_by
    WHERE timer.baby_id = p_baby_id
      AND timer.activity_type = p_activity_type;

    RETURN QUERY
    SELECT false, v_existing.started_by, v_existing.display_name, v_existing.started_at;
  END;
END;
$$;

COMMENT ON FUNCTION public.validate_active_timer_started_at() IS
'Normalizes at most one second of positive client-clock skew, rejects larger future starts and starts older than the twelve-hour stale-lock cleanup horizon, and allows valid started-at corrections and unrelated updates to existing locks.';

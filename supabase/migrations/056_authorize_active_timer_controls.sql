-- NOTE: migration 060 replaces this function to return the started_at persisted after its
-- BEFORE INSERT trigger normalizes client-clock skew. Because 060 sorts later, it wins on every
-- fresh apply. Mirror any change made here into 060 as well, or it will be silently overwritten.
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
    INSERT INTO public.active_timers (
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
    );

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

REVOKE ALL ON FUNCTION public.acquire_timer_lock(UUID, VARCHAR, UUID, JSONB, TIMESTAMPTZ)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.acquire_timer_lock(UUID, VARCHAR, UUID, JSONB, TIMESTAMPTZ)
TO authenticated;

COMMENT ON FUNCTION public.acquire_timer_lock(UUID, VARCHAR, UUID, JSONB, TIMESTAMPTZ) IS
'Authenticated household members may acquire a timer for an active baby. p_user_id must equal auth.uid(); anonymous and impersonating callers are rejected.';

CREATE OR REPLACE FUNCTION public.release_timer_lock(
  p_baby_id UUID,
  p_activity_type VARCHAR(20),
  p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_lock_owner_id UUID;
BEGIN
  IF v_caller_id IS NULL OR p_user_id IS DISTINCT FROM v_caller_id THEN
    RAISE EXCEPTION 'authenticated caller does not match timer user'
      USING ERRCODE = '42501';
  END IF;

  IF p_activity_type IS NULL OR p_activity_type NOT IN ('feeding', 'sleep', 'pumping', 'tummy_time') THEN
    RAISE EXCEPTION 'invalid timer activity type'
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

  SELECT timer.started_by
  INTO v_lock_owner_id
  FROM public.active_timers AS timer
  WHERE timer.baby_id = p_baby_id
    AND timer.activity_type = p_activity_type;

  IF NOT FOUND THEN
    RETURN false;
  END IF;

  IF v_lock_owner_id IS DISTINCT FROM v_caller_id THEN
    RAISE EXCEPTION 'only the timer owner may release this timer'
      USING ERRCODE = '42501';
  END IF;

  DELETE FROM public.active_timers AS timer
  WHERE timer.baby_id = p_baby_id
    AND timer.activity_type = p_activity_type
    AND timer.started_by = v_caller_id;

  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.release_timer_lock(UUID, VARCHAR, UUID)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_timer_lock(UUID, VARCHAR, UUID)
TO authenticated;

COMMENT ON FUNCTION public.release_timer_lock(UUID, VARCHAR, UUID) IS
'Authenticated household members may release only a timer they started. p_user_id must equal auth.uid(); anonymous, impersonating, and non-owner callers are rejected.';

CREATE OR REPLACE FUNCTION public.toggle_timer_pause(
  p_baby_id UUID,
  p_activity_type TEXT,
  p_user_id UUID,
  p_timer_data JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller_id UUID := auth.uid();
  v_lock_owner_id UUID;
BEGIN
  IF v_caller_id IS NULL OR p_user_id IS DISTINCT FROM v_caller_id THEN
    RAISE EXCEPTION 'authenticated caller does not match timer user'
      USING ERRCODE = '42501';
  END IF;

  IF p_activity_type IS NULL OR p_activity_type NOT IN ('feeding', 'sleep', 'pumping', 'tummy_time') THEN
    RAISE EXCEPTION 'invalid timer activity type'
      USING ERRCODE = '22023';
  END IF;

  IF p_timer_data IS NULL
    OR pg_catalog.jsonb_typeof(p_timer_data) <> 'object'
    OR NOT p_timer_data ? 'isPaused'
    OR pg_catalog.jsonb_typeof(p_timer_data -> 'isPaused') <> 'boolean'
  THEN
    RAISE EXCEPTION 'timer data must contain a boolean isPaused state'
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

  SELECT timer.started_by
  INTO v_lock_owner_id
  FROM public.active_timers AS timer
  WHERE timer.baby_id = p_baby_id
    AND timer.activity_type = p_activity_type;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'active timer not found'
      USING ERRCODE = 'P0002';
  END IF;

  IF v_lock_owner_id IS DISTINCT FROM v_caller_id THEN
    RAISE EXCEPTION 'only the timer owner may change pause state'
      USING ERRCODE = '42501';
  END IF;

  UPDATE public.active_timers AS timer
  SET timer_data = CASE
        WHEN (p_timer_data ->> 'isPaused')::boolean
          THEN (COALESCE(timer.timer_data, '{}'::jsonb) - 'effectiveStartTime') || p_timer_data
        ELSE (COALESCE(timer.timer_data, '{}'::jsonb) - 'pausedAt') || p_timer_data
      END,
      updated_at = pg_catalog.now()
  WHERE timer.baby_id = p_baby_id
    AND timer.activity_type = p_activity_type
    AND timer.started_by = v_caller_id;
END;
$$;

REVOKE ALL ON FUNCTION public.toggle_timer_pause(UUID, TEXT, UUID, JSONB)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.toggle_timer_pause(UUID, TEXT, UUID, JSONB)
TO authenticated;

COMMENT ON FUNCTION public.toggle_timer_pause(UUID, TEXT, UUID, JSONB) IS
'Authenticated household members may pause or resume only a timer they started. p_user_id must equal auth.uid() and p_timer_data must contain a boolean isPaused state.';

CREATE OR REPLACE FUNCTION public.cleanup_stale_timer_locks()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM public.active_timers
  WHERE started_at < pg_catalog.now() - INTERVAL '12 hours';

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

REVOKE ALL ON FUNCTION public.cleanup_stale_timer_locks()
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.cleanup_stale_timer_locks()
TO service_role;

COMMENT ON FUNCTION public.cleanup_stale_timer_locks() IS
'Service-role maintenance only. Removes active timer locks older than twelve hours; it is not a user timer-control interface.';

REVOKE ALL ON TABLE public.active_timers FROM anon;
GRANT SELECT, UPDATE, DELETE ON TABLE public.active_timers TO authenticated;

GRANT SELECT ON TABLE public.babies, public.users, public.widget_push_tokens TO service_role;
GRANT DELETE ON TABLE public.widget_push_tokens TO service_role;

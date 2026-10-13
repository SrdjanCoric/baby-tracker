-- Keep the first non-sleep pause boundary and its frozen display on a repeated pause.
-- Same signature and return type as 073, so released apps call it unchanged.
BEGIN;

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
  v_data jsonb;
  v_started_at timestamptz;
  v_side_seconds integer;
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

  SELECT COALESCE(timer.timer_data, '{}'::jsonb), timer.started_at
  INTO v_data, v_started_at
  FROM public.active_timers AS timer
  WHERE timer.baby_id = p_baby_id AND timer.activity_type = p_activity_type
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'active timer not found' USING ERRCODE = 'P0002';
  END IF;

  IF (p_timer_data ->> 'isPaused')::boolean THEN
    IF p_activity_type <> 'sleep' THEN
      -- Duplicate pauses must retain both their first boundary and frozen display.
      IF COALESCE((v_data ->> 'isPaused')::boolean, false) THEN
        RETURN;
      END IF;
      p_timer_data := p_timer_data - 'pausedAt';
      IF NOT COALESCE((v_data ->> 'isPaused')::boolean, false) THEN
        p_timer_data := p_timer_data || pg_catalog.jsonb_build_object('pausedAt', pg_catalog.now());
      END IF;
    END IF;
    IF p_activity_type = 'feeding' AND NOT COALESCE((v_data ->> 'isPaused')::boolean, false) THEN
      v_side_seconds := GREATEST(0, pg_catalog.floor(extract(epoch FROM (
        COALESCE((p_timer_data ->> 'pausedAt')::timestamptz, pg_catalog.now())
        - COALESCE((v_data ->> 'currentSideStartedAt')::timestamptz, v_started_at))))::integer);
      v_data := v_data || pg_catalog.jsonb_build_object(
        'leftAccumulatedSeconds', COALESCE((v_data ->> 'leftAccumulatedSeconds')::integer, 0)
          + CASE WHEN v_data ->> 'side' IN ('left', 'both') THEN v_side_seconds ELSE 0 END,
        'rightAccumulatedSeconds', COALESCE((v_data ->> 'rightAccumulatedSeconds')::integer, 0)
          + CASE WHEN v_data ->> 'side' IN ('right', 'both') THEN v_side_seconds ELSE 0 END);
    END IF;
    v_data := (v_data - 'effectiveStartTime') || CASE
      WHEN p_activity_type = 'feeding'
        THEN p_timer_data - 'leftAccumulatedSeconds' - 'rightAccumulatedSeconds' - 'currentSideStartedAt' - 'totalPausedMs' - 'lastResumedAt'
      WHEN p_activity_type <> 'sleep' THEN p_timer_data - 'totalPausedMs' - 'lastResumedAt'
      ELSE p_timer_data
    END;
  ELSE
    IF p_activity_type <> 'sleep' AND COALESCE((v_data ->> 'isPaused')::boolean, false)
      AND v_data ->> 'pausedAt' IS NOT NULL THEN
      v_data := v_data || pg_catalog.jsonb_build_object('lastResumedAt', pg_catalog.now(), 'totalPausedMs',
        GREATEST(0, COALESCE((v_data ->> 'totalPausedMs')::numeric, 0))
        + GREATEST(0, extract(epoch FROM (pg_catalog.now() - (v_data ->> 'pausedAt')::timestamptz)) * 1000));
      IF p_activity_type = 'feeding' THEN
        v_data := v_data || pg_catalog.jsonb_build_object('currentSideStartedAt', pg_catalog.now());
      END IF;
    END IF;
    v_data := (v_data - 'pausedAt') || CASE
      WHEN p_activity_type = 'feeding'
        THEN p_timer_data - 'leftAccumulatedSeconds' - 'rightAccumulatedSeconds' - 'currentSideStartedAt' - 'totalPausedMs' - 'pausedAt' - 'lastResumedAt'
      WHEN p_activity_type <> 'sleep' THEN p_timer_data - 'totalPausedMs' - 'pausedAt' - 'lastResumedAt'
      ELSE p_timer_data
    END;
  END IF;

  UPDATE public.active_timers
  SET timer_data = v_data, updated_at = pg_catalog.now()
  WHERE baby_id = p_baby_id AND activity_type = p_activity_type;

END;
$$;

REVOKE ALL ON FUNCTION public.toggle_timer_pause(UUID, TEXT, UUID, JSONB)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.toggle_timer_pause(UUID, TEXT, UUID, JSONB)
TO authenticated;

COMMENT ON FUNCTION public.toggle_timer_pause(UUID, TEXT, UUID, JSONB) IS
'Authenticated household members may pause or resume a timer for their baby. p_user_id must equal auth.uid() and p_timer_data must contain a boolean isPaused state.';

COMMIT;

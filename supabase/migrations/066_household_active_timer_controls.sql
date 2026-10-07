-- Let any authenticated member of a baby's household pause, resume, or stop its active timer.
-- Timer acquisition and ownership attribution remain unchanged. Direct UPDATE keeps timer identity
-- immutable, and only the starter may edit started_at.

BEGIN;

DROP POLICY IF EXISTS "Users can update their own active timers" ON public.active_timers;
DROP POLICY IF EXISTS "Users can delete their own active timers" ON public.active_timers;

CREATE POLICY "Household members can update active timers"
  ON public.active_timers FOR UPDATE
  USING (
    EXISTS (
      SELECT 1
      FROM public.babies AS baby
      JOIN public.users AS caregiver
        ON caregiver.household_id = baby.household_id
      WHERE baby.id = active_timers.baby_id
        AND caregiver.id = auth.uid()
        AND baby.deleted = false
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.babies AS baby
      JOIN public.users AS caregiver
        ON caregiver.household_id = baby.household_id
      WHERE baby.id = active_timers.baby_id
        AND caregiver.id = auth.uid()
        AND baby.deleted = false
    )
  );

CREATE POLICY "Household members can delete active timers"
  ON public.active_timers FOR DELETE
  USING (
    EXISTS (
      SELECT 1
      FROM public.babies AS baby
      JOIN public.users AS caregiver
        ON caregiver.household_id = baby.household_id
      WHERE baby.id = active_timers.baby_id
        AND caregiver.id = auth.uid()
        AND baby.deleted = false
    )
  );

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

  IF current_user = 'authenticated'
    AND NEW.started_at IS DISTINCT FROM OLD.started_at
    AND auth.uid() IS DISTINCT FROM OLD.started_by
  THEN
    RAISE EXCEPTION 'only the timer starter may change its start time'
      USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.guard_authenticated_active_timer_identity()
FROM PUBLIC, anon, authenticated;

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

  DELETE FROM public.active_timers AS timer
  WHERE timer.baby_id = p_baby_id
    AND timer.activity_type = p_activity_type;

  RETURN FOUND;
END;
$$;

REVOKE ALL ON FUNCTION public.release_timer_lock(UUID, VARCHAR, UUID)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.release_timer_lock(UUID, VARCHAR, UUID)
TO authenticated;

COMMENT ON FUNCTION public.release_timer_lock(UUID, VARCHAR, UUID) IS
'Authenticated household members may release a timer for their baby. p_user_id must equal auth.uid(); anonymous, impersonating, and non-household callers are rejected.';

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

  UPDATE public.active_timers AS timer
  SET timer_data = CASE
        WHEN (p_timer_data ->> 'isPaused')::boolean
          THEN (COALESCE(timer.timer_data, '{}'::jsonb) - 'effectiveStartTime') || p_timer_data
        ELSE (COALESCE(timer.timer_data, '{}'::jsonb) - 'pausedAt') || p_timer_data
      END,
      updated_at = pg_catalog.now()
  WHERE timer.baby_id = p_baby_id
    AND timer.activity_type = p_activity_type;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'active timer not found'
      USING ERRCODE = 'P0002';
  END IF;
END;
$$;

REVOKE ALL ON FUNCTION public.toggle_timer_pause(UUID, TEXT, UUID, JSONB)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.toggle_timer_pause(UUID, TEXT, UUID, JSONB)
TO authenticated;

COMMENT ON FUNCTION public.toggle_timer_pause(UUID, TEXT, UUID, JSONB) IS
'Authenticated household members may pause or resume a timer for their baby. p_user_id must equal auth.uid() and p_timer_data must contain a boolean isPaused state.';

COMMIT;

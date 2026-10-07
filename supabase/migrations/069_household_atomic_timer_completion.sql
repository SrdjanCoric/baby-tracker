-- Household completion keeps the activity save and matching lock cleanup atomic.
BEGIN;

CREATE OR REPLACE FUNCTION public.merge_record_and_complete_timer(
  p_table text,
  p_record jsonb,
  p_field_clocks jsonb,
  p_operation_id text,
  p_expected_user_id uuid,
  p_timer_instance_id text DEFAULT NULL,
  p_timer_started_at timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_activity_type text;
  v_result jsonb;
  v_baby_id uuid := (p_record ->> 'baby_id')::uuid;
BEGIN
  v_activity_type := CASE p_table
    WHEN 'sleep_sessions' THEN 'sleep'
    WHEN 'feedings' THEN 'feeding'
    WHEN 'pumping_sessions' THEN 'pumping'
    WHEN 'tummy_time_sessions' THEN 'tummy_time'
  END;
  IF v_activity_type IS NULL THEN
    RAISE EXCEPTION 'timer completion: invalid activity table' USING ERRCODE = '22023';
  END IF;
  IF v_caller IS NULL OR v_caller IS DISTINCT FROM p_expected_user_id THEN
    RAISE EXCEPTION 'timer completion: authenticated user changed' USING ERRCODE = '42501';
  END IF;
  -- Replays must still be authorised before they can attempt lock cleanup.
  IF NOT EXISTS (
    SELECT 1 FROM public.babies b JOIN public.users u ON u.household_id = b.household_id
    WHERE b.id = v_baby_id AND u.id = v_caller
  ) THEN
    RAISE EXCEPTION 'timer completion: access denied' USING ERRCODE = '42501';
  END IF;

  v_result := public.merge_record(p_table, p_record, p_field_clocks, p_operation_id, p_expected_user_id);

  IF p_timer_instance_id IS NOT NULL THEN
    DELETE FROM public.active_timers t
    WHERE t.baby_id = v_baby_id
      AND t.activity_type = v_activity_type
      AND EXISTS (
        SELECT 1 FROM public.babies b JOIN public.users u ON u.household_id = b.household_id
        WHERE b.id = v_baby_id AND u.id = v_caller AND b.deleted = false
      )
      AND (
        (pg_catalog.jsonb_typeof(t.timer_data -> 'timerInstanceId') = 'string'
          AND t.timer_data ->> 'timerInstanceId' = p_timer_instance_id)
        OR (pg_catalog.jsonb_typeof(t.timer_data -> 'timerInstanceId') IS DISTINCT FROM 'string'
          AND pg_catalog.date_trunc('milliseconds', t.started_at)
            = pg_catalog.date_trunc('milliseconds', p_timer_started_at))
      );
  END IF;
  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION public.merge_record_and_complete_timer(text, jsonb, jsonb, text, uuid, text, timestamptz)
FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.merge_record_and_complete_timer(text, jsonb, jsonb, text, uuid, text, timestamptz)
TO authenticated;

COMMIT;

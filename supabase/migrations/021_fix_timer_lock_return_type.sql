-- Fix the return type mismatch in acquire_timer_lock function
-- The display_name column is VARCHAR(100), not TEXT

DROP FUNCTION IF EXISTS acquire_timer_lock(UUID, VARCHAR(20), UUID, JSONB);

CREATE OR REPLACE FUNCTION acquire_timer_lock(
  p_baby_id UUID,
  p_activity_type VARCHAR(20),
  p_user_id UUID,
  p_timer_data JSONB DEFAULT NULL
)
RETURNS TABLE (
  success BOOLEAN,
  lock_holder_id UUID,
  lock_holder_name VARCHAR(100),
  started_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing RECORD;
  v_household_id UUID;
BEGIN
  -- Verify user has access to this baby's household
  SELECT b.household_id INTO v_household_id
  FROM babies b
  JOIN users u ON b.household_id = u.household_id
  WHERE b.id = p_baby_id AND u.id = p_user_id;

  IF v_household_id IS NULL THEN
    RETURN QUERY SELECT false, NULL::UUID, NULL::VARCHAR(100), NULL::TIMESTAMPTZ;
    RETURN;
  END IF;

  -- Check for existing lock
  SELECT at.started_by, at.started_at, u.display_name
  INTO v_existing
  FROM active_timers at
  JOIN users u ON at.started_by = u.id
  WHERE at.baby_id = p_baby_id AND at.activity_type = p_activity_type;

  IF FOUND THEN
    -- Lock exists, return the holder info
    RETURN QUERY SELECT false, v_existing.started_by, v_existing.display_name, v_existing.started_at;
    RETURN;
  END IF;

  -- Try to insert the lock
  BEGIN
    INSERT INTO active_timers (baby_id, activity_type, started_by, timer_data)
    VALUES (p_baby_id, p_activity_type, p_user_id, p_timer_data);

    RETURN QUERY SELECT true, p_user_id, (SELECT display_name FROM users WHERE id = p_user_id), NOW();
  EXCEPTION WHEN unique_violation THEN
    -- Race condition: someone else got the lock
    SELECT at.started_by, at.started_at, u.display_name
    INTO v_existing
    FROM active_timers at
    JOIN users u ON at.started_by = u.id
    WHERE at.baby_id = p_baby_id AND at.activity_type = p_activity_type;

    RETURN QUERY SELECT false, v_existing.started_by, v_existing.display_name, v_existing.started_at;
  END;
END;
$$;

GRANT EXECUTE ON FUNCTION acquire_timer_lock TO authenticated;

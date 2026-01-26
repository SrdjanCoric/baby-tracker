-- Active timers table for household-wide timer exclusivity
-- Prevents multiple caregivers from starting the same activity type simultaneously

CREATE TABLE active_timers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  baby_id UUID REFERENCES babies(id) ON DELETE CASCADE NOT NULL,
  activity_type VARCHAR(20) NOT NULL CHECK (activity_type IN ('feeding', 'sleep', 'pumping', 'tummy_time')),
  started_by UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  timer_data JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(baby_id, activity_type)
);

CREATE INDEX idx_active_timers_baby_id ON active_timers(baby_id);
CREATE INDEX idx_active_timers_started_by ON active_timers(started_by);

ALTER TABLE active_timers ENABLE ROW LEVEL SECURITY;

-- Enable realtime for active_timers
ALTER TABLE active_timers REPLICA IDENTITY FULL;

-- RLS Policy: Users can see active timers for babies in their household
CREATE POLICY "Users can view active timers for household babies"
  ON active_timers FOR SELECT
  USING (
    baby_id IN (
      SELECT b.id FROM babies b
      JOIN users u ON b.household_id = u.household_id
      WHERE u.id = auth.uid()
    )
  );

-- RLS Policy: Users can insert active timers for babies in their household
CREATE POLICY "Users can insert active timers for household babies"
  ON active_timers FOR INSERT
  WITH CHECK (
    baby_id IN (
      SELECT b.id FROM babies b
      JOIN users u ON b.household_id = u.household_id
      WHERE u.id = auth.uid()
    )
    AND started_by = auth.uid()
  );

-- RLS Policy: Users can only delete their own active timers
CREATE POLICY "Users can delete their own active timers"
  ON active_timers FOR DELETE
  USING (started_by = auth.uid());

-- RLS Policy: Users can update their own active timers
CREATE POLICY "Users can update their own active timers"
  ON active_timers FOR UPDATE
  USING (started_by = auth.uid());

-- Function to acquire a timer lock atomically
CREATE OR REPLACE FUNCTION acquire_timer_lock(
  p_baby_id UUID,
  p_activity_type VARCHAR(20),
  p_user_id UUID,
  p_timer_data JSONB DEFAULT NULL
)
RETURNS TABLE (
  success BOOLEAN,
  lock_holder_id UUID,
  lock_holder_name TEXT,
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
    RETURN QUERY SELECT false, NULL::UUID, NULL::TEXT, NULL::TIMESTAMPTZ;
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

-- Function to release a timer lock
CREATE OR REPLACE FUNCTION release_timer_lock(
  p_baby_id UUID,
  p_activity_type VARCHAR(20),
  p_user_id UUID
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM active_timers
  WHERE baby_id = p_baby_id
    AND activity_type = p_activity_type
    AND started_by = p_user_id;

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted > 0;
END;
$$;

-- Function to clean up stale locks (e.g., from crashes)
-- Locks older than 12 hours are considered stale
CREATE OR REPLACE FUNCTION cleanup_stale_timer_locks()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_deleted INTEGER;
BEGIN
  DELETE FROM active_timers
  WHERE started_at < NOW() - INTERVAL '12 hours';

  GET DIAGNOSTICS v_deleted = ROW_COUNT;
  RETURN v_deleted;
END;
$$;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION acquire_timer_lock TO authenticated;
GRANT EXECUTE ON FUNCTION release_timer_lock TO authenticated;

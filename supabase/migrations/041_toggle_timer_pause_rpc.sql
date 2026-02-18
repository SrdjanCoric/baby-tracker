CREATE OR REPLACE FUNCTION toggle_timer_pause(
  p_baby_id UUID,
  p_activity_type TEXT,
  p_user_id UUID,
  p_timer_data JSONB
)
RETURNS VOID AS $$
  UPDATE active_timers
  SET timer_data = COALESCE(timer_data, '{}'::jsonb) || p_timer_data
  WHERE baby_id = p_baby_id
    AND activity_type = p_activity_type
    AND started_by = p_user_id;
$$ LANGUAGE sql SECURITY DEFINER;

-- Remove heads_up_minutes column from wake_window_preferences
ALTER TABLE wake_window_preferences DROP COLUMN IF EXISTS heads_up_minutes;

-- Recreate RPC function without heads_up_minutes in return type
DROP FUNCTION IF EXISTS public.get_due_wake_window_reminders();

CREATE OR REPLACE FUNCTION public.get_due_wake_window_reminders()
RETURNS TABLE (
  user_id UUID,
  baby_id UUID,
  baby_name TEXT,
  nap_count INTEGER,
  wake_window_slots JSONB,
  last_sleep_ended_at TIMESTAMPTZ,
  device_token TEXT,
  naps_since_night_sleep BIGINT
) LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  WITH last_night_sleep AS (
    SELECT ss.baby_id, MAX(ss.ended_at) AS ended_at
    FROM sleep_sessions ss
    WHERE ss.type = 'night' AND ss.ended_at IS NOT NULL
    GROUP BY ss.baby_id
  ),
  nap_counts AS (
    SELECT ss.baby_id, COUNT(*) AS cnt
    FROM sleep_sessions ss
    LEFT JOIN last_night_sleep lns ON lns.baby_id = ss.baby_id
    WHERE ss.type = 'nap'
      AND ss.ended_at IS NOT NULL
      AND ss.started_at >= COALESCE(lns.ended_at, CURRENT_DATE)
    GROUP BY ss.baby_id
  )
  SELECT
    wwp.user_id,
    wwp.baby_id,
    b.name AS baby_name,
    wwp.nap_count,
    wwp.wake_window_slots,
    b.last_sleep_ended_at,
    wpt.device_token,
    COALESCE(nc.cnt, 0) AS naps_since_night_sleep
  FROM wake_window_preferences wwp
  JOIN babies b ON b.id = wwp.baby_id
  JOIN widget_push_tokens wpt ON wpt.user_id = wwp.user_id
  LEFT JOIN nap_counts nc ON nc.baby_id = wwp.baby_id
  WHERE wwp.enabled = true
    AND b.last_sleep_ended_at IS NOT NULL
    AND (wwp.last_notified_at IS NULL OR wwp.last_notified_at < b.last_sleep_ended_at)
    AND NOT EXISTS (
      SELECT 1 FROM active_timers at
      WHERE at.baby_id = wwp.baby_id AND at.activity_type = 'sleep'
    );
$$;

-- Add is_sandbox flag to user_push_tokens so edge functions know
-- whether to use APNs sandbox or production endpoint per token.
-- Defaults to false (production), which is correct for all existing tokens.

ALTER TABLE user_push_tokens ADD COLUMN IF NOT EXISTS is_sandbox BOOLEAN NOT NULL DEFAULT false;

-- Recreate get_due_feeding_reminders to include is_sandbox
DROP FUNCTION IF EXISTS public.get_due_feeding_reminders();

CREATE FUNCTION public.get_due_feeding_reminders()
RETURNS TABLE (
  user_id UUID,
  baby_id UUID,
  interval_hours NUMERIC,
  baby_name TEXT,
  last_fed_at TIMESTAMPTZ,
  device_token TEXT,
  is_sandbox BOOLEAN
) LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT
    frp.user_id,
    frp.baby_id,
    frp.interval_hours,
    b.name AS baby_name,
    b.last_fed_at,
    upt.device_token,
    upt.is_sandbox
  FROM feeding_reminder_preferences frp
  JOIN babies b ON b.id = frp.baby_id
  JOIN user_push_tokens upt ON upt.user_id = frp.user_id
  WHERE frp.enabled = true
    AND b.last_fed_at IS NOT NULL
    AND b.last_fed_at + (interval '1 hour' * frp.interval_hours) <= NOW()
    AND (frp.last_notified_at IS NULL OR frp.last_notified_at < b.last_fed_at)
    AND upt.device_token IS NOT NULL;
$$;

-- Recreate get_due_wake_window_reminders to include is_sandbox
DROP FUNCTION IF EXISTS public.get_due_wake_window_reminders();

CREATE FUNCTION public.get_due_wake_window_reminders()
RETURNS TABLE (
  user_id UUID,
  baby_id UUID,
  baby_name TEXT,
  nap_count INTEGER,
  wake_window_slots JSONB,
  last_sleep_ended_at TIMESTAMPTZ,
  device_token TEXT,
  naps_since_night_sleep BIGINT,
  has_recent_night_sleep BOOLEAN,
  is_sandbox BOOLEAN
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
      AND ss.started_at >= CASE
        WHEN lns.ended_at > now() - interval '24 hours' THEN lns.ended_at
        ELSE CURRENT_DATE
      END
    GROUP BY ss.baby_id
  )
  SELECT
    wwp.user_id,
    wwp.baby_id,
    b.name AS baby_name,
    wwp.nap_count,
    wwp.wake_window_slots,
    b.last_sleep_ended_at,
    upt.device_token,
    COALESCE(nc.cnt, 0) AS naps_since_night_sleep,
    (lns.ended_at IS NOT NULL AND lns.ended_at > now() - interval '24 hours') AS has_recent_night_sleep,
    upt.is_sandbox
  FROM wake_window_preferences wwp
  JOIN babies b ON b.id = wwp.baby_id
  JOIN user_push_tokens upt ON upt.user_id = wwp.user_id AND upt.device_token IS NOT NULL
  LEFT JOIN nap_counts nc ON nc.baby_id = wwp.baby_id
  LEFT JOIN last_night_sleep lns ON lns.baby_id = wwp.baby_id
  WHERE wwp.enabled = true
    AND b.last_sleep_ended_at IS NOT NULL
    AND (wwp.last_notified_at IS NULL OR wwp.last_notified_at < b.last_sleep_ended_at)
    AND NOT EXISTS (
      SELECT 1 FROM active_timers at
      WHERE at.baby_id = wwp.baby_id AND at.activity_type = 'sleep'
    );
$$;

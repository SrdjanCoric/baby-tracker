ALTER TABLE public.sleep_sessions
  ADD COLUMN morning_classification TEXT;

ALTER TABLE public.sleep_sessions
  ADD COLUMN morning_classification_version SMALLINT;

ALTER TABLE public.sleep_sessions
  ADD CONSTRAINT sleep_sessions_morning_classification_allowed
  CHECK (
    morning_classification IS NULL OR morning_classification IN (
      'automatic',
      'unresolved',
      'confirmed_first_nap',
      'confirmed_night_continuation'
    )
  ),
  ADD CONSTRAINT sleep_sessions_morning_classification_version_allowed
  CHECK (
    morning_classification_version IS NULL OR morning_classification_version = 1
  ),
  ADD CONSTRAINT sleep_sessions_morning_classification_versioned
  CHECK (
    morning_classification IS NULL OR morning_classification_version = 1
  );

ALTER TABLE public.sleep_sessions
  ALTER COLUMN morning_classification_version SET DEFAULT 1;

ALTER TABLE public.wake_window_preferences
  ALTER COLUMN nap_continuation_minutes SET DEFAULT 25;

CREATE OR REPLACE FUNCTION public.get_due_wake_window_reminders()
RETURNS TABLE (
  baby_id UUID,
  baby_name TEXT,
  nap_count INTEGER,
  wake_window_slots JSONB,
  last_sleep_ended_at TIMESTAMPTZ,
  device_token TEXT,
  naps_since_night_sleep BIGINT,
  has_recent_night_sleep BOOLEAN,
  is_sandbox BOOLEAN,
  day_start_hour INTEGER,
  day_end_hour INTEGER,
  nap_continuation_minutes INTEGER,
  timezone TEXT
) LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  WITH last_night_sleep AS (
    SELECT ss.baby_id, MAX(ss.ended_at) AS ended_at
    FROM sleep_sessions ss
    WHERE ss.type = 'night' AND ss.ended_at IS NOT NULL AND ss.deleted = false
    GROUP BY ss.baby_id
  ),
  naps_raw AS (
    SELECT
      ss.baby_id,
      ss.started_at,
      ss.ended_at,
      LAG(ss.ended_at) OVER (PARTITION BY ss.baby_id ORDER BY ss.started_at) AS prev_ended_at
    FROM sleep_sessions ss
    LEFT JOIN last_night_sleep lns ON lns.baby_id = ss.baby_id
    WHERE ss.type = 'nap'
      AND ss.ended_at IS NOT NULL
      AND ss.deleted = false
      AND ss.started_at >= CASE
        WHEN lns.ended_at > now() - interval '24 hours' THEN lns.ended_at
        ELSE CURRENT_DATE
      END
  ),
  naps_grouped AS (
    SELECT
      nr.baby_id,
      nr.started_at,
      CASE
        WHEN nr.prev_ended_at IS NULL THEN 1
        WHEN EXTRACT(EPOCH FROM (nr.started_at - nr.prev_ended_at)) / 60.0
             > COALESCE(wwp.nap_continuation_minutes, 25)
        THEN 1
        ELSE 0
      END AS is_new_group
    FROM naps_raw nr
    JOIN wake_window_preferences wwp ON wwp.baby_id = nr.baby_id
  ),
  nap_counts AS (
    SELECT baby_id, SUM(is_new_group) AS cnt
    FROM naps_grouped
    GROUP BY baby_id
  )
  SELECT
    wwp.baby_id,
    b.name AS baby_name,
    wwp.nap_count,
    wwp.wake_window_slots,
    b.last_sleep_ended_at,
    upt.device_token,
    COALESCE(nc.cnt, 0) AS naps_since_night_sleep,
    (lns.ended_at IS NOT NULL AND lns.ended_at > now() - interval '24 hours') AS has_recent_night_sleep,
    upt.is_sandbox,
    COALESCE(wwp.day_start_hour, 6) AS day_start_hour,
    COALESCE(wwp.day_end_hour, 19) AS day_end_hour,
    COALESCE(wwp.nap_continuation_minutes, 25) AS nap_continuation_minutes,
    wwp.timezone
  FROM wake_window_preferences wwp
  JOIN babies b ON b.id = wwp.baby_id
  JOIN users u ON u.household_id = b.household_id
  JOIN user_push_tokens upt ON upt.user_id = u.id AND upt.device_token IS NOT NULL
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

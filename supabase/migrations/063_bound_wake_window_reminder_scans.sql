-- Bound wake-window reminder scans and index sleep_sessions lookups.
--
-- get_due_wake_window_reminders() runs from pg_cron every 5 minutes and
-- seq-scanned the entire sleep_sessions table twice per run (last_night_sleep
-- and naps_raw CTEs), so its cost grew with total recorded history across all
-- households. Both CTE results are only consumed for the trailing 24 hours:
-- last_night_sleep feeds `lns.ended_at > now() - interval '24 hours'` checks,
-- and naps_raw is already lower-bounded by that timestamp or CURRENT_DATE
-- (both within the last 48 hours). Adding explicit time bounds keeps results
-- identical while letting the planner use the new partial indexes.

CREATE INDEX IF NOT EXISTS idx_sleep_sessions_night_ended
  ON public.sleep_sessions (ended_at DESC)
  WHERE type = 'night' AND ended_at IS NOT NULL AND deleted = false;

CREATE INDEX IF NOT EXISTS idx_sleep_sessions_nap_started
  ON public.sleep_sessions (started_at)
  WHERE type = 'nap' AND ended_at IS NOT NULL AND deleted = false;

-- update_baby_last_sleep_ended_at() recomputes MAX(ended_at) for one baby on
-- every sleep insert/update/delete; (baby_id, ended_at DESC) answers that with
-- a single index probe instead of reading the baby's full history.
CREATE INDEX IF NOT EXISTS idx_sleep_sessions_baby_ended
  ON public.sleep_sessions (baby_id, ended_at DESC);

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
    -- A max older than 24 hours is never consumed: the naps_raw CASE falls
    -- back to CURRENT_DATE and has_recent_night_sleep evaluates false either
    -- way, so restricting the scan window changes nothing observable.
    SELECT ss.baby_id, MAX(ss.ended_at) AS ended_at
    FROM sleep_sessions ss
    WHERE ss.type = 'night'
      AND ss.ended_at IS NOT NULL
      AND ss.deleted = false
      AND ss.ended_at > now() - interval '24 hours'
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
      -- Redundant with the CASE bound below (both branches are within the
      -- last 24 hours), stated explicitly so the planner can range-scan
      -- idx_sleep_sessions_nap_started instead of reading all naps.
      AND ss.started_at >= now() - interval '48 hours'
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

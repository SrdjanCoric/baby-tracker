-- Convert wake_window_preferences from per-user-per-baby to per-baby.
-- Wake windows describe the baby's sleep physiology, not a caregiver preference.
-- All household caregivers should share the same settings.

-- Step 1: Deduplicate rows — keep most recently updated per baby
DELETE FROM wake_window_preferences wwp1
WHERE EXISTS (
  SELECT 1 FROM wake_window_preferences wwp2
  WHERE wwp2.baby_id = wwp1.baby_id AND wwp2.updated_at > wwp1.updated_at
);
DELETE FROM wake_window_preferences wwp1
WHERE ctid NOT IN (SELECT MIN(ctid) FROM wake_window_preferences GROUP BY baby_id);

-- Step 2: Drop old RLS policy (depends on user_id column, must happen before column drop)
DROP POLICY IF EXISTS "Users can manage own wake window preferences" ON wake_window_preferences;

-- Step 3: Change PK from (user_id, baby_id) to (baby_id)
ALTER TABLE wake_window_preferences DROP CONSTRAINT wake_window_preferences_pkey;
ALTER TABLE wake_window_preferences DROP COLUMN user_id;
ALTER TABLE wake_window_preferences ADD PRIMARY KEY (baby_id);

-- Step 4: New household-based RLS (matching feedings/sleep_sessions pattern)
CREATE POLICY "Users can view household wake window preferences" ON wake_window_preferences
  FOR SELECT USING (baby_id IN (
    SELECT b.id FROM babies b JOIN users u ON b.household_id = u.household_id WHERE u.id = auth.uid()
  ));

CREATE POLICY "Users can insert household wake window preferences" ON wake_window_preferences
  FOR INSERT WITH CHECK (baby_id IN (
    SELECT b.id FROM babies b JOIN users u ON b.household_id = u.household_id WHERE u.id = auth.uid()
  ));

CREATE POLICY "Users can update household wake window preferences" ON wake_window_preferences
  FOR UPDATE USING (baby_id IN (
    SELECT b.id FROM babies b JOIN users u ON b.household_id = u.household_id WHERE u.id = auth.uid()
  ));

CREATE POLICY "Users can delete household wake window preferences" ON wake_window_preferences
  FOR DELETE USING (baby_id IN (
    SELECT b.id FROM babies b JOIN users u ON b.household_id = u.household_id WHERE u.id = auth.uid()
  ));

-- Step 5: Recreate RPC — fan out notifications to ALL household members
DROP FUNCTION IF EXISTS public.get_due_wake_window_reminders();

CREATE FUNCTION public.get_due_wake_window_reminders()
RETURNS TABLE (
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

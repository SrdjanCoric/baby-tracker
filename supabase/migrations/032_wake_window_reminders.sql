-- Wake Window Reminders feature
-- Table to store per-user per-baby wake window preferences

CREATE TABLE wake_window_preferences (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  baby_id UUID NOT NULL REFERENCES babies(id) ON DELETE CASCADE,
  enabled BOOLEAN DEFAULT false,
  nap_count INTEGER DEFAULT 2,
  wake_window_slots JSONB DEFAULT '[]',
  source VARCHAR(20) DEFAULT 'age_based',
  last_notified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, baby_id)
);

ALTER TABLE wake_window_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own wake window preferences"
  ON wake_window_preferences FOR ALL USING (user_id = auth.uid());

-- Add last_sleep_ended_at to babies for efficient wake window calculation
ALTER TABLE babies ADD COLUMN last_sleep_ended_at TIMESTAMPTZ;

-- Backfill from existing sleep sessions
UPDATE babies b SET last_sleep_ended_at = (
  SELECT MAX(ended_at) FROM sleep_sessions WHERE baby_id = b.id AND ended_at IS NOT NULL
);

-- Trigger to keep last_sleep_ended_at up to date
CREATE OR REPLACE FUNCTION public.update_baby_last_sleep_ended_at()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  target_baby_id UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    target_baby_id := OLD.baby_id;
  ELSE
    target_baby_id := NEW.baby_id;
  END IF;

  IF TG_OP IN ('INSERT', 'UPDATE') AND NEW.ended_at IS NULL THEN
    RETURN NEW;
  END IF;

  UPDATE babies SET last_sleep_ended_at = (
    SELECT MAX(ended_at) FROM sleep_sessions
    WHERE baby_id = target_baby_id AND ended_at IS NOT NULL
  ) WHERE id = target_baby_id;

  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END;
$$;

CREATE TRIGGER on_sleep_update_last_ended
  AFTER INSERT OR UPDATE OF ended_at OR DELETE ON sleep_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_baby_last_sleep_ended_at();

-- RPC function to get due wake window reminders
CREATE OR REPLACE FUNCTION public.get_due_wake_window_reminders()
RETURNS TABLE (
  user_id UUID,
  baby_id UUID,
  baby_name TEXT,
  nap_count INTEGER,
  wake_window_slots JSONB,
  last_sleep_ended_at TIMESTAMPTZ,
  device_token TEXT,
  naps_since_night_sleep BIGINT,
  has_recent_night_sleep BOOLEAN
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
    wpt.device_token,
    COALESCE(nc.cnt, 0) AS naps_since_night_sleep,
    (lns.ended_at IS NOT NULL AND lns.ended_at > now() - interval '24 hours') AS has_recent_night_sleep
  FROM wake_window_preferences wwp
  JOIN babies b ON b.id = wwp.baby_id
  JOIN widget_push_tokens wpt ON wpt.user_id = wwp.user_id
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

-- pg_cron job to check wake window reminders every 5 minutes
SELECT cron.schedule(
  'check-wake-window-reminders',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.project_url', true) || '/functions/v1/check-wake-window-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{}'::jsonb
  );
  $$
);

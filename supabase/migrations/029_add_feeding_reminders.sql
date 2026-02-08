-- Add last_fed_at to babies
ALTER TABLE babies ADD COLUMN last_fed_at TIMESTAMPTZ;

-- Backfill from existing feedings
UPDATE babies b SET last_fed_at = (
  SELECT MAX(started_at) FROM feedings WHERE baby_id = b.id
);

-- Trigger: update last_fed_at on feeding INSERT
CREATE OR REPLACE FUNCTION public.update_baby_last_fed_at()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  UPDATE babies
  SET last_fed_at = GREATEST(COALESCE(last_fed_at, NEW.started_at), NEW.started_at)
  WHERE id = NEW.baby_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_feeding_insert_update_last_fed
  AFTER INSERT ON feedings
  FOR EACH ROW EXECUTE FUNCTION public.update_baby_last_fed_at();

-- Per-user feeding reminder preferences
CREATE TABLE feeding_reminder_preferences (
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  baby_id UUID NOT NULL REFERENCES babies(id) ON DELETE CASCADE,
  enabled BOOLEAN DEFAULT true,
  interval_hours NUMERIC NOT NULL DEFAULT 3,
  last_notified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, baby_id)
);

ALTER TABLE feeding_reminder_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own preferences"
  ON feeding_reminder_preferences FOR ALL
  USING (user_id = auth.uid());

-- RPC function for edge function to query due reminders
CREATE OR REPLACE FUNCTION public.get_due_feeding_reminders()
RETURNS TABLE (
  user_id UUID,
  baby_id UUID,
  interval_hours NUMERIC,
  baby_name TEXT,
  last_fed_at TIMESTAMPTZ,
  push_token TEXT
) LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT
    frp.user_id,
    frp.baby_id,
    frp.interval_hours,
    b.name AS baby_name,
    b.last_fed_at,
    upt.push_token
  FROM feeding_reminder_preferences frp
  JOIN babies b ON b.id = frp.baby_id
  JOIN user_push_tokens upt ON upt.user_id = frp.user_id
  WHERE frp.enabled = true
    AND b.last_fed_at IS NOT NULL
    AND b.last_fed_at + (interval '1 hour' * frp.interval_hours) <= NOW()
    AND (frp.last_notified_at IS NULL OR frp.last_notified_at < b.last_fed_at);
$$;

-- pg_cron job: check every 5 minutes
SELECT cron.schedule(
  'check-feeding-reminders',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := current_setting('app.settings.project_url', true) || '/functions/v1/check-feeding-reminders',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true)
    ),
    body := '{}'::jsonb
  );
  $$
);

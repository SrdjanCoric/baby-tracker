-- Drop old function (return type changed from push_token to device_token)
DROP FUNCTION IF EXISTS public.get_due_feeding_reminders();

-- Recreate using widget_push_tokens (direct APNs) instead of user_push_tokens (Expo Push API)
CREATE OR REPLACE FUNCTION public.get_due_feeding_reminders()
RETURNS TABLE (
  user_id UUID,
  baby_id UUID,
  interval_hours NUMERIC,
  baby_name TEXT,
  last_fed_at TIMESTAMPTZ,
  device_token TEXT
) LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT
    frp.user_id,
    frp.baby_id,
    frp.interval_hours,
    b.name AS baby_name,
    b.last_fed_at,
    wpt.device_token
  FROM feeding_reminder_preferences frp
  JOIN babies b ON b.id = frp.baby_id
  JOIN widget_push_tokens wpt ON wpt.user_id = frp.user_id
  WHERE frp.enabled = true
    AND b.last_fed_at IS NOT NULL
    AND b.last_fed_at + (interval '1 hour' * frp.interval_hours) <= NOW()
    AND (frp.last_notified_at IS NULL OR frp.last_notified_at < b.last_fed_at);
$$;

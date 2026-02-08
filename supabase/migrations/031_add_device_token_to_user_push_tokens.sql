-- Add native APNs device token column to user_push_tokens
-- This stores the main app's APNs token (from getDevicePushTokenAsync)
-- separate from the Expo push token (ExponentPushToken[...])
-- and separate from widget_push_tokens (widget extension APNs token)
ALTER TABLE user_push_tokens ADD COLUMN IF NOT EXISTS device_token TEXT;

-- Drop and recreate get_due_feeding_reminders to use user_push_tokens.device_token
DROP FUNCTION IF EXISTS public.get_due_feeding_reminders();

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
    upt.device_token
  FROM feeding_reminder_preferences frp
  JOIN babies b ON b.id = frp.baby_id
  JOIN user_push_tokens upt ON upt.user_id = frp.user_id
  WHERE frp.enabled = true
    AND b.last_fed_at IS NOT NULL
    AND b.last_fed_at + (interval '1 hour' * frp.interval_hours) <= NOW()
    AND (frp.last_notified_at IS NULL OR frp.last_notified_at < b.last_fed_at)
    AND upt.device_token IS NOT NULL;
$$;

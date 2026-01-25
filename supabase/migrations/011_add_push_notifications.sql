-- Migration: Add push notification support for household activity notifications
-- This migration adds:
-- 1. user_push_tokens table to store Expo push tokens
-- 2. activity_notifications_enabled column on users table
-- 3. Database triggers to notify edge function on activity inserts

-- ============================================
-- USER PUSH TOKENS TABLE
-- ============================================

CREATE TABLE user_push_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  push_token TEXT NOT NULL,
  device_type TEXT NOT NULL CHECK (device_type IN ('ios', 'android')),
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, push_token)
);

CREATE INDEX idx_push_tokens_user ON user_push_tokens(user_id);

-- Enable RLS
ALTER TABLE user_push_tokens ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own push tokens" ON user_push_tokens
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can insert own push tokens" ON user_push_tokens
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own push tokens" ON user_push_tokens
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete own push tokens" ON user_push_tokens
  FOR DELETE USING (user_id = auth.uid());

-- ============================================
-- ADD ACTIVITY NOTIFICATIONS COLUMN TO USERS
-- ============================================

ALTER TABLE users
ADD COLUMN activity_notifications_enabled BOOLEAN DEFAULT false;

-- ============================================
-- TRIGGERS TO CALL EDGE FUNCTION ON ACTIVITY INSERT
-- ============================================

-- Enable pg_net extension for HTTP calls (if not already enabled)
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Function to notify edge function when activity is logged
CREATE OR REPLACE FUNCTION notify_activity_logged()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  project_url TEXT;
  service_key TEXT;
BEGIN
  -- Get project URL from environment (set via Supabase dashboard)
  project_url := current_setting('app.settings.project_url', true);
  service_key := current_setting('app.settings.service_role_key', true);

  -- Only proceed if settings are configured
  IF project_url IS NOT NULL AND service_key IS NOT NULL THEN
    PERFORM extensions.http_post(
      url := project_url || '/functions/v1/send-activity-notification',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || service_key
      ),
      body := jsonb_build_object(
        'table', TG_TABLE_NAME,
        'record', row_to_json(NEW)
      )
    );
  END IF;

  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- Log error but don't fail the insert
    RAISE WARNING 'Failed to send activity notification: %', SQLERRM;
    RETURN NEW;
END;
$$;

-- Create triggers for each activity table
CREATE TRIGGER on_feeding_insert_notify
  AFTER INSERT ON feedings
  FOR EACH ROW EXECUTE FUNCTION notify_activity_logged();

CREATE TRIGGER on_sleep_insert_notify
  AFTER INSERT ON sleep_sessions
  FOR EACH ROW EXECUTE FUNCTION notify_activity_logged();

CREATE TRIGGER on_diaper_insert_notify
  AFTER INSERT ON diapers
  FOR EACH ROW EXECUTE FUNCTION notify_activity_logged();

CREATE TRIGGER on_pumping_insert_notify
  AFTER INSERT ON pumping_sessions
  FOR EACH ROW EXECUTE FUNCTION notify_activity_logged();

CREATE TRIGGER on_growth_insert_notify
  AFTER INSERT ON growth_measurements
  FOR EACH ROW EXECUTE FUNCTION notify_activity_logged();

CREATE TRIGGER on_tummy_time_insert_notify
  AFTER INSERT ON tummy_time_sessions
  FOR EACH ROW EXECUTE FUNCTION notify_activity_logged();

-- ============================================
-- HELPER FUNCTION FOR EDGE FUNCTION TO GET PUSH TOKENS
-- ============================================

CREATE OR REPLACE FUNCTION get_household_push_tokens(
  p_household_id UUID,
  p_exclude_user_id UUID
)
RETURNS TABLE(push_token TEXT, device_type TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT pt.push_token, pt.device_type
  FROM user_push_tokens pt
  JOIN users u ON pt.user_id = u.id
  WHERE u.household_id = p_household_id
    AND u.activity_notifications_enabled = true
    AND u.id != p_exclude_user_id;
END;
$$;

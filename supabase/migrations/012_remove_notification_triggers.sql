-- Migration: Remove notification triggers (replaced by Database Webhooks)
-- Database Webhooks are configured via Supabase Dashboard and are the recommended approach

-- Remove triggers
DROP TRIGGER IF EXISTS on_feeding_insert_notify ON feedings;
DROP TRIGGER IF EXISTS on_sleep_insert_notify ON sleep_sessions;
DROP TRIGGER IF EXISTS on_diaper_insert_notify ON diapers;
DROP TRIGGER IF EXISTS on_pumping_insert_notify ON pumping_sessions;
DROP TRIGGER IF EXISTS on_growth_insert_notify ON growth_measurements;
DROP TRIGGER IF EXISTS on_tummy_time_insert_notify ON tummy_time_sessions;

-- Remove the trigger function
DROP FUNCTION IF EXISTS notify_activity_logged();

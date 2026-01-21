-- Migration: Add logged_by attribution triggers and indexes
-- This migration ensures logged_by is properly populated and optimized for queries

-- ============================================
-- TRIGGERS TO AUTO-POPULATE logged_by ON INSERT
-- ============================================

-- Helper function to set logged_by to current user if not provided
CREATE OR REPLACE FUNCTION set_logged_by()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.logged_by IS NULL THEN
    NEW.logged_by := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

-- Apply trigger to feedings
DROP TRIGGER IF EXISTS set_feeding_logged_by ON feedings;
CREATE TRIGGER set_feeding_logged_by
  BEFORE INSERT ON feedings
  FOR EACH ROW
  EXECUTE FUNCTION set_logged_by();

-- Apply trigger to sleep_sessions
DROP TRIGGER IF EXISTS set_sleep_logged_by ON sleep_sessions;
CREATE TRIGGER set_sleep_logged_by
  BEFORE INSERT ON sleep_sessions
  FOR EACH ROW
  EXECUTE FUNCTION set_logged_by();

-- Apply trigger to diapers
DROP TRIGGER IF EXISTS set_diaper_logged_by ON diapers;
CREATE TRIGGER set_diaper_logged_by
  BEFORE INSERT ON diapers
  FOR EACH ROW
  EXECUTE FUNCTION set_logged_by();

-- Apply trigger to pumping_sessions
DROP TRIGGER IF EXISTS set_pumping_logged_by ON pumping_sessions;
CREATE TRIGGER set_pumping_logged_by
  BEFORE INSERT ON pumping_sessions
  FOR EACH ROW
  EXECUTE FUNCTION set_logged_by();

-- Apply trigger to growth_measurements
DROP TRIGGER IF EXISTS set_growth_logged_by ON growth_measurements;
CREATE TRIGGER set_growth_logged_by
  BEFORE INSERT ON growth_measurements
  FOR EACH ROW
  EXECUTE FUNCTION set_logged_by();

-- Apply trigger to tummy_time_sessions
DROP TRIGGER IF EXISTS set_tummy_time_logged_by ON tummy_time_sessions;
CREATE TRIGGER set_tummy_time_logged_by
  BEFORE INSERT ON tummy_time_sessions
  FOR EACH ROW
  EXECUTE FUNCTION set_logged_by();

-- ============================================
-- INDEXES FOR EFFICIENT CAREGIVER STATS QUERIES
-- ============================================

CREATE INDEX IF NOT EXISTS idx_feedings_logged_by ON feedings(logged_by);
CREATE INDEX IF NOT EXISTS idx_sleep_sessions_logged_by ON sleep_sessions(logged_by);
CREATE INDEX IF NOT EXISTS idx_diapers_logged_by ON diapers(logged_by);
CREATE INDEX IF NOT EXISTS idx_pumping_sessions_logged_by ON pumping_sessions(logged_by);
CREATE INDEX IF NOT EXISTS idx_growth_measurements_logged_by ON growth_measurements(logged_by);
CREATE INDEX IF NOT EXISTS idx_tummy_time_sessions_logged_by ON tummy_time_sessions(logged_by);

-- ============================================
-- RPC FUNCTION TO GET CAREGIVER STATS
-- ============================================

CREATE OR REPLACE FUNCTION get_caregiver_stats(
  caregiver_id UUID,
  household_id UUID
)
RETURNS TABLE(entry_count BIGINT, last_activity TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  total_count BIGINT := 0;
  latest_activity TIMESTAMPTZ;
  temp_count BIGINT;
  temp_date TIMESTAMPTZ;
BEGIN
  -- Verify the requesting user is in the same household
  IF NOT EXISTS (
    SELECT 1 FROM users u
    WHERE u.id = auth.uid()
    AND u.household_id = get_caregiver_stats.household_id
  ) THEN
    RAISE EXCEPTION 'Not authorized to view caregiver stats';
  END IF;

  -- Count feedings
  SELECT COUNT(*), MAX(created_at) INTO temp_count, temp_date
  FROM feedings f
  JOIN babies b ON f.baby_id = b.id
  WHERE f.logged_by = caregiver_id
  AND b.household_id = get_caregiver_stats.household_id;
  total_count := total_count + COALESCE(temp_count, 0);
  IF temp_date > latest_activity OR latest_activity IS NULL THEN
    latest_activity := temp_date;
  END IF;

  -- Count sleep sessions
  SELECT COUNT(*), MAX(created_at) INTO temp_count, temp_date
  FROM sleep_sessions s
  JOIN babies b ON s.baby_id = b.id
  WHERE s.logged_by = caregiver_id
  AND b.household_id = get_caregiver_stats.household_id;
  total_count := total_count + COALESCE(temp_count, 0);
  IF temp_date > latest_activity OR latest_activity IS NULL THEN
    latest_activity := temp_date;
  END IF;

  -- Count diapers
  SELECT COUNT(*), MAX(created_at) INTO temp_count, temp_date
  FROM diapers d
  JOIN babies b ON d.baby_id = b.id
  WHERE d.logged_by = caregiver_id
  AND b.household_id = get_caregiver_stats.household_id;
  total_count := total_count + COALESCE(temp_count, 0);
  IF temp_date > latest_activity OR latest_activity IS NULL THEN
    latest_activity := temp_date;
  END IF;

  -- Count pumping sessions
  SELECT COUNT(*), MAX(created_at) INTO temp_count, temp_date
  FROM pumping_sessions p
  JOIN babies b ON p.baby_id = b.id
  WHERE p.logged_by = caregiver_id
  AND b.household_id = get_caregiver_stats.household_id;
  total_count := total_count + COALESCE(temp_count, 0);
  IF temp_date > latest_activity OR latest_activity IS NULL THEN
    latest_activity := temp_date;
  END IF;

  -- Count growth measurements
  SELECT COUNT(*), MAX(created_at) INTO temp_count, temp_date
  FROM growth_measurements g
  JOIN babies b ON g.baby_id = b.id
  WHERE g.logged_by = caregiver_id
  AND b.household_id = get_caregiver_stats.household_id;
  total_count := total_count + COALESCE(temp_count, 0);
  IF temp_date > latest_activity OR latest_activity IS NULL THEN
    latest_activity := temp_date;
  END IF;

  -- Count tummy time sessions
  SELECT COUNT(*), MAX(created_at) INTO temp_count, temp_date
  FROM tummy_time_sessions t
  JOIN babies b ON t.baby_id = b.id
  WHERE t.logged_by = caregiver_id
  AND b.household_id = get_caregiver_stats.household_id;
  total_count := total_count + COALESCE(temp_count, 0);
  IF temp_date > latest_activity OR latest_activity IS NULL THEN
    latest_activity := temp_date;
  END IF;

  RETURN QUERY SELECT total_count AS entry_count, latest_activity AS last_activity;
END;
$$;

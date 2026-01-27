-- E2E Test Data Cleanup Script
-- Run with: npm run e2e:cleanup

-- Delete all E2E test data in correct order (respecting foreign keys)
-- E2E test data uses UUIDs starting with 00000000-0000-0000-

-- Delete active timers first (for babies in E2E households)
DELETE FROM active_timers WHERE baby_id IN (
  SELECT id FROM babies WHERE household_id::text LIKE '00000000-0000-0000-0000-%'
);

-- Delete activities (using the E2E baby IDs)
DELETE FROM feedings WHERE baby_id::text LIKE '00000000-0000-0000-0001-%';
DELETE FROM sleep_sessions WHERE baby_id::text LIKE '00000000-0000-0000-0001-%';
DELETE FROM diapers WHERE baby_id::text LIKE '00000000-0000-0000-0001-%';
DELETE FROM growth_measurements WHERE baby_id::text LIKE '00000000-0000-0000-0001-%';
DELETE FROM tummy_time_sessions WHERE baby_id::text LIKE '00000000-0000-0000-0001-%';
DELETE FROM pumping_sessions WHERE baby_id::text LIKE '00000000-0000-0000-0001-%';

-- Delete user settings for E2E babies
DELETE FROM user_settings WHERE baby_id::text LIKE '00000000-0000-0000-0001-%';

-- Delete babies
DELETE FROM babies WHERE id::text LIKE '00000000-0000-0000-0001-%';

-- Delete user-household links for E2E households
DELETE FROM users WHERE household_id::text LIKE '00000000-0000-0000-0000-%';

-- Delete households
DELETE FROM households WHERE id::text LIKE '00000000-0000-0000-0000-%';

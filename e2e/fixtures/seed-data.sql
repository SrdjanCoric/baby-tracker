-- E2E Test Data Seed Script
-- Run with: npm run e2e:seed
\set ON_ERROR_STOP on

BEGIN;

GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;
REVOKE EXECUTE ON FUNCTION public.cleanup_stale_timer_locks() FROM authenticated, anon;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'users'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.users;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'households'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.households;
  END IF;
END
$$;

-- Create test households with proper UUIDs
-- invite_code is VARCHAR(8), so use 8-char codes
INSERT INTO households (id, invite_code, created_at) VALUES
  ('00000000-0000-0000-0000-000000000001'::uuid, 'E2E1TEST', NOW()),
  ('00000000-0000-0000-0000-000000000002'::uuid, 'E2E2TEST', NOW()),
  ('00000000-0000-0000-0000-000000000003'::uuid, 'E2E3TEST', NOW())
ON CONFLICT (id) DO UPDATE
SET invite_code = EXCLUDED.invite_code;

CREATE TEMP TABLE e2e_generated_households ON COMMIT DROP AS
SELECT household_id AS id
FROM users
WHERE email IN (
  'e2e-owner@test.local',
  'e2e-member@test.local',
  'e2e-test@test.local'
)
  AND household_id NOT IN (
    '00000000-0000-0000-0000-000000000001'::uuid,
    '00000000-0000-0000-0000-000000000003'::uuid
  );

UPDATE users
SET household_id = '00000000-0000-0000-0000-000000000001'::uuid,
    display_name = CASE email
      WHEN 'e2e-owner@test.local' THEN 'E2E Owner'
      WHEN 'e2e-member@test.local' THEN 'E2E Member'
    END,
    is_owner = (email = 'e2e-owner@test.local')
WHERE email IN ('e2e-owner@test.local', 'e2e-member@test.local');

UPDATE users
SET household_id = '00000000-0000-0000-0000-000000000003'::uuid,
    display_name = 'E2E Test User',
    is_owner = true
WHERE email = 'e2e-test@test.local';

DELETE FROM households h
WHERE h.id IN (SELECT id FROM e2e_generated_households)
  AND NOT EXISTS (SELECT 1 FROM users u WHERE u.household_id = h.id)
  AND NOT EXISTS (SELECT 1 FROM babies b WHERE b.household_id = h.id);

-- Create test babies
INSERT INTO babies (id, name, birth_date, gender, household_id, created_at) VALUES
  ('00000000-0000-0000-0001-000000000001'::uuid, 'E2E Baby', '2024-06-15', 'female', '00000000-0000-0000-0000-000000000001'::uuid, NOW()),
  ('00000000-0000-0000-0001-000000000002'::uuid, 'E2E Baby Two', '2024-08-01', 'male', '00000000-0000-0000-0000-000000000001'::uuid, NOW()),
  ('00000000-0000-0000-0001-000000000003'::uuid, 'Member Baby', '2024-07-20', 'female', '00000000-0000-0000-0000-000000000002'::uuid, NOW())
ON CONFLICT (id) DO UPDATE
SET name = EXCLUDED.name,
    birth_date = EXCLUDED.birth_date,
    gender = EXCLUDED.gender,
    household_id = EXCLUDED.household_id,
    deleted = false;

INSERT INTO achievements (baby_id, achievement_id, detected_at)
SELECT baby_id, achievement_id, NOW()
FROM (
  VALUES
    ('00000000-0000-0000-0001-000000000001'::uuid),
    ('00000000-0000-0000-0001-000000000002'::uuid)
) AS fixture_babies(baby_id)
CROSS JOIN (
  VALUES
    ('sleep_6h'),
    ('sleep_8h'),
    ('sleep_10h'),
    ('tummy_5min'),
    ('tummy_10min'),
    ('tummy_15min'),
    ('tummy_20min'),
    ('first_solid')
) AS fixture_achievements(achievement_id)
ON CONFLICT (baby_id, achievement_id) DO NOTHING;

-- Pre-seed feedings for timeline tests
INSERT INTO feedings (id, baby_id, type, started_at, ended_at, duration_seconds, side, created_at) VALUES
  ('00000000-0000-0000-0002-000000000001'::uuid, '00000000-0000-0000-0001-000000000001'::uuid, 'breast', NOW() - INTERVAL '2 hours', NOW() - INTERVAL '2 hours' + INTERVAL '10 minutes', 600, 'left', NOW() - INTERVAL '2 hours'),
  ('00000000-0000-0000-0002-000000000002'::uuid, '00000000-0000-0000-0001-000000000001'::uuid, 'bottle', NOW() - INTERVAL '5 hours', NOW() - INTERVAL '5 hours' + INTERVAL '15 minutes', 900, NULL, NOW() - INTERVAL '5 hours'),
  ('00000000-0000-0000-0002-000000000003'::uuid, '00000000-0000-0000-0001-000000000001'::uuid, 'breast', NOW() - INTERVAL '8 hours', NOW() - INTERVAL '8 hours' + INTERVAL '12 minutes', 720, 'right', NOW() - INTERVAL '8 hours')
ON CONFLICT (id) DO NOTHING;

-- Pre-seed sleep sessions for timeline tests
INSERT INTO sleep_sessions (id, baby_id, type, started_at, ended_at, duration_seconds, created_at) VALUES
  ('00000000-0000-0000-0003-000000000001'::uuid, '00000000-0000-0000-0001-000000000001'::uuid, 'nap', NOW() - INTERVAL '3 hours', NOW() - INTERVAL '2 hours', 3600, NOW() - INTERVAL '3 hours'),
  ('00000000-0000-0000-0003-000000000002'::uuid, '00000000-0000-0000-0001-000000000001'::uuid, 'night', NOW() - INTERVAL '12 hours', NOW() - INTERVAL '4 hours', 28800, NOW() - INTERVAL '12 hours')
ON CONFLICT (id) DO NOTHING;

-- Pre-seed diapers for timeline tests (types: wet, dirty, mixed)
INSERT INTO diapers (id, baby_id, type, changed_at, created_at) VALUES
  ('00000000-0000-0000-0004-000000000001'::uuid, '00000000-0000-0000-0001-000000000001'::uuid, 'wet', NOW() - INTERVAL '1 hour', NOW() - INTERVAL '1 hour'),
  ('00000000-0000-0000-0004-000000000002'::uuid, '00000000-0000-0000-0001-000000000001'::uuid, 'dirty', NOW() - INTERVAL '4 hours', NOW() - INTERVAL '4 hours'),
  ('00000000-0000-0000-0004-000000000003'::uuid, '00000000-0000-0000-0001-000000000001'::uuid, 'mixed', NOW() - INTERVAL '7 hours', NOW() - INTERVAL '7 hours')
ON CONFLICT (id) DO NOTHING;

-- Pre-seed growth measurements
INSERT INTO growth_measurements (id, baby_id, weight_kg, height_cm, head_cm, measured_at, created_at) VALUES
  ('00000000-0000-0000-0005-000000000001'::uuid, '00000000-0000-0000-0001-000000000001'::uuid, 7.5, 68.0, 43.0, CURRENT_DATE - INTERVAL '7 days', NOW() - INTERVAL '7 days'),
  ('00000000-0000-0000-0005-000000000002'::uuid, '00000000-0000-0000-0001-000000000001'::uuid, 7.2, 66.5, 42.5, CURRENT_DATE - INTERVAL '30 days', NOW() - INTERVAL '30 days')
ON CONFLICT (id) DO NOTHING;

-- Pre-seed tummy time sessions
INSERT INTO tummy_time_sessions (id, baby_id, started_at, ended_at, duration_seconds, created_at) VALUES
  ('00000000-0000-0000-0006-000000000001'::uuid, '00000000-0000-0000-0001-000000000001'::uuid, NOW() - INTERVAL '6 hours', NOW() - INTERVAL '6 hours' + INTERVAL '5 minutes', 300, NOW() - INTERVAL '6 hours')
ON CONFLICT (id) DO NOTHING;

-- Pre-seed pumping sessions
INSERT INTO pumping_sessions (id, baby_id, started_at, ended_at, duration_seconds, amount_ml, side, created_at) VALUES
  ('00000000-0000-0000-0007-000000000001'::uuid, '00000000-0000-0000-0001-000000000001'::uuid, NOW() - INTERVAL '4 hours', NOW() - INTERVAL '4 hours' + INTERVAL '20 minutes', 1200, 120, 'both', NOW() - INTERVAL '4 hours')
ON CONFLICT (id) DO NOTHING;

COMMIT;

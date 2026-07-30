\set ON_ERROR_STOP on

DO $$
DECLARE
  v_owner_id UUID;
  v_caregiver_id UUID;
BEGIN
  SELECT id INTO STRICT v_owner_id
  FROM public.users
  WHERE email = 'e2e-owner@test.local';

  SELECT id INTO STRICT v_caregiver_id
  FROM public.users
  WHERE email = 'e2e-test@test.local';

  IF NOT EXISTS (
    SELECT 1
    FROM public.users
    WHERE id = v_caregiver_id
      AND household_id = '00000000-0000-0000-0000-000000000001'::uuid
      AND is_owner = false
  ) THEN
    RAISE EXCEPTION 'Joining caregiver does not have the expected target membership';
  END IF;

  IF (
    SELECT pg_catalog.count(*)
    FROM public.users
    WHERE household_id = '00000000-0000-0000-0000-000000000001'::uuid
  ) <> 3 OR EXISTS (
    SELECT 1
    FROM public.users
    WHERE household_id = '00000000-0000-0000-0000-000000000001'::uuid
      AND email NOT IN (
        'e2e-owner@test.local',
        'e2e-member@test.local',
        'e2e-test@test.local'
      )
  ) THEN
    RAISE EXCEPTION 'Target household membership has duplicate or unexpected effects';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.users
    WHERE id = v_owner_id
      AND household_id = '00000000-0000-0000-0000-000000000001'::uuid
      AND is_owner = true
  ) THEN
    RAISE EXCEPTION 'Target household owner changed unexpectedly';
  END IF;

  IF (
    SELECT pg_catalog.count(*)
    FROM public.caregiver_invitations
    WHERE invite_code = 'E2EJ2345'
      AND invited_email = 'e2e-test@test.local'
      AND household_id = '00000000-0000-0000-0000-000000000001'::uuid
      AND consumed_by = v_caregiver_id
      AND consumed_at IS NOT NULL
      AND revoked_at IS NULL
  ) <> 1 THEN
    RAISE EXCEPTION 'Invitation was not redeemed exactly once by the expected caregiver';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.join_attempt_logs
    WHERE user_id = v_caregiver_id
  ) THEN
    RAISE EXCEPTION 'Successful recovery left duplicate join attempts';
  END IF;

  IF (
    SELECT pg_catalog.count(*)
    FROM public.babies
    WHERE household_id = '00000000-0000-0000-0000-000000000001'::uuid
      AND deleted = false
      AND (id, name) IN (
        ('00000000-0000-0000-0001-000000000001'::uuid, 'E2E Baby'),
        ('00000000-0000-0000-0001-000000000002'::uuid, 'E2E Baby Two')
      )
  ) <> 2 THEN
    RAISE EXCEPTION 'Expected target household babies are unavailable';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM public.babies
    WHERE id = 'e2e00000-0000-4000-8000-000000000041'::uuid
  ) OR EXISTS (
    SELECT 1
    FROM public.households
    WHERE id = '00000000-0000-0000-0000-000000000003'::uuid
  ) THEN
    RAISE EXCEPTION 'Explicitly confirmed solo-household deletion did not complete';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM public.babies
    WHERE id = '00000000-0000-0000-0001-000000000003'::uuid
      AND household_id = '00000000-0000-0000-0000-000000000002'::uuid
      AND name = 'Member Baby'
      AND deleted = false
  ) OR NOT EXISTS (
    SELECT 1
    FROM public.households
    WHERE id = '00000000-0000-0000-0000-000000000002'::uuid
  ) OR NOT EXISTS (
    SELECT 1
    FROM public.users
    WHERE email = 'e2e-new-owner@test.local'
      AND household_id = '00000000-0000-0000-0000-000000000004'::uuid
      AND is_owner = true
  ) THEN
    RAISE EXCEPTION 'Unrelated household fixtures changed during caregiver recovery';
  END IF;

  IF (
    SELECT pg_catalog.count(*)
    FROM public.feedings
    WHERE deleted = false
      AND (id, type, duration_seconds, side) IN (
        ('00000000-0000-0000-0002-000000000001'::uuid, 'breast', 600, 'left'),
        ('00000000-0000-0000-0002-000000000003'::uuid, 'breast', 720, 'right')
      )
  ) <> 2 OR NOT EXISTS (
    SELECT 1
    FROM public.feedings
    WHERE id = '00000000-0000-0000-0002-000000000002'::uuid
      AND type = 'bottle'
      AND duration_seconds = 900
      AND side IS NULL
      AND deleted = false
  ) THEN
    RAISE EXCEPTION 'Feeding fixtures changed during caregiver recovery';
  END IF;

  IF (
    SELECT pg_catalog.count(*)
    FROM public.sleep_sessions
    WHERE deleted = false
      AND (id, type, duration_seconds) IN (
        ('00000000-0000-0000-0003-000000000001'::uuid, 'nap', 3600),
        ('00000000-0000-0000-0003-000000000002'::uuid, 'night', 28800)
      )
  ) <> 2 OR (
    SELECT pg_catalog.count(*)
    FROM public.diapers
    WHERE deleted = false
      AND (id, type) IN (
        ('00000000-0000-0000-0004-000000000001'::uuid, 'wet'),
        ('00000000-0000-0000-0004-000000000002'::uuid, 'dirty'),
        ('00000000-0000-0000-0004-000000000003'::uuid, 'mixed')
      )
  ) <> 3 THEN
    RAISE EXCEPTION 'Sleep or diaper fixtures changed during caregiver recovery';
  END IF;

  IF (
    SELECT pg_catalog.count(*)
    FROM public.growth_measurements
    WHERE deleted = false
      AND (id, weight_kg, height_cm, head_cm) IN (
        ('00000000-0000-0000-0005-000000000001'::uuid, 7.5, 68.0, 43.0),
        ('00000000-0000-0000-0005-000000000002'::uuid, 7.2, 66.5, 42.5)
      )
  ) <> 2 OR NOT EXISTS (
    SELECT 1
    FROM public.tummy_time_sessions
    WHERE id = '00000000-0000-0000-0006-000000000001'::uuid
      AND duration_seconds = 300
      AND deleted = false
  ) OR NOT EXISTS (
    SELECT 1
    FROM public.pumping_sessions
    WHERE id = '00000000-0000-0000-0007-000000000001'::uuid
      AND duration_seconds = 1200
      AND amount_ml = 120
      AND side = 'both'
      AND deleted = false
  ) THEN
    RAISE EXCEPTION 'Growth, tummy-time, or pumping fixtures changed during caregiver recovery';
  END IF;

  IF (
    SELECT pg_catalog.count(*)
    FROM public.achievements
    WHERE baby_id IN (
      '00000000-0000-0000-0001-000000000001'::uuid,
      '00000000-0000-0000-0001-000000000002'::uuid
    )
      AND achievement_id IN (
        'sleep_6h', 'sleep_8h', 'sleep_10h', 'tummy_5min',
        'tummy_10min', 'tummy_15min', 'tummy_20min', 'first_solid'
      )
  ) <> 16 THEN
    RAISE EXCEPTION 'Achievement fixtures changed during caregiver recovery';
  END IF;
END
$$;

SELECT 'Caregiver join network recovery verified' AS result;

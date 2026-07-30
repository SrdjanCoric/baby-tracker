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
  ) OR (
    SELECT pg_catalog.count(*)
    FROM public.feedings
    WHERE baby_id = '00000000-0000-0000-0001-000000000001'::uuid
      AND deleted = false
  ) <> 3 THEN
    RAISE EXCEPTION 'Unrelated fixture data changed during caregiver recovery';
  END IF;
END
$$;

SELECT 'Caregiver join network recovery verified' AS result;

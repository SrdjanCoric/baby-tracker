\set ON_ERROR_STOP on

GRANT SELECT ON TABLE public.users, public.households, public.babies TO authenticated;

DO $$
DECLARE
  v_owner_id UUID;
  v_owner_household_id UUID;
  v_invited_id UUID;
  v_source_household_id UUID;
BEGIN
  SELECT id, household_id
  INTO v_owner_id, v_owner_household_id
  FROM public.users
  WHERE email = 'e2e-owner@test.local';

  SELECT id, household_id
  INTO v_invited_id, v_source_household_id
  FROM public.users
  WHERE email = 'e2e-test@test.local';

  IF v_owner_id IS NULL OR v_invited_id IS NULL THEN
    RAISE EXCEPTION 'Run npm run e2e:create-users before preparing caregiver join';
  END IF;

  IF v_source_household_id = v_owner_household_id OR EXISTS (
    SELECT 1
    FROM public.users
    WHERE household_id = v_source_household_id
      AND id <> v_invited_id
  ) THEN
    INSERT INTO public.households (invite_code)
    VALUES ('E2ES2345')
    RETURNING id INTO v_source_household_id;
  END IF;

  DELETE FROM public.babies
  WHERE household_id IN (v_owner_household_id, v_source_household_id);

  UPDATE public.users
  SET household_id = v_owner_household_id,
      is_owner = true,
      display_name = 'E2E Owner'
  WHERE id = v_owner_id;

  UPDATE public.users
  SET household_id = v_source_household_id,
      is_owner = true,
      display_name = 'E2E Caregiver'
  WHERE id = v_invited_id;

  INSERT INTO public.babies (
    id,
    household_id,
    name,
    birth_date,
    gender
  ) VALUES (
    'e2e00000-0000-4000-8000-000000000038',
    v_owner_household_id,
    'Shared Baby',
    CURRENT_DATE - INTERVAL '100 days',
    'female'
  );

  DELETE FROM public.join_attempt_logs
  WHERE user_id = v_invited_id;

  DELETE FROM public.caregiver_invitations
  WHERE invited_email = 'e2e-test@test.local'
    OR invite_code = 'E2EJ2345';

  INSERT INTO public.caregiver_invitations (
    household_id,
    invited_email,
    invite_code,
    created_by,
    expires_at
  ) VALUES (
    v_owner_household_id,
    'e2e-test@test.local',
    'E2EJ2345',
    v_owner_id,
    pg_catalog.now() + INTERVAL '7 days'
  );
END
$$;

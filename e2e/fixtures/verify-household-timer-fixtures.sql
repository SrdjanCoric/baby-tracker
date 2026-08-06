\set ON_ERROR_STOP on

DO $$
DECLARE
  caregiver_count integer;
  household_caregiver_count integer;
  owner_count integer;
  baby_count integer;
  achievement_count integer;
BEGIN
  IF NOT has_table_privilege('authenticated', 'public.users', 'SELECT') THEN
    RAISE EXCEPTION 'authenticated role is missing local API table grants';
  END IF;

  IF has_table_privilege('authenticated', 'public.active_timers', 'INSERT') THEN
    RAISE EXCEPTION 'authenticated callers must acquire timer locks through the RPC';
  END IF;

  IF NOT has_function_privilege(
    'authenticated',
    'public.acquire_timer_lock(uuid, character varying, uuid, jsonb, timestamp with time zone)',
    'EXECUTE'
  ) OR NOT has_function_privilege(
    'authenticated',
    'public.release_timer_lock(uuid, character varying, uuid)',
    'EXECUTE'
  ) OR NOT has_function_privilege(
    'authenticated',
    'public.toggle_timer_pause(uuid, text, uuid, jsonb)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'authenticated role is missing local timer RPC grants';
  END IF;

  IF has_function_privilege(
    'anon',
    'public.acquire_timer_lock(uuid, character varying, uuid, jsonb, timestamp with time zone)',
    'EXECUTE'
  ) OR has_function_privilege(
    'anon',
    'public.release_timer_lock(uuid, character varying, uuid)',
    'EXECUTE'
  ) OR has_function_privilege(
    'anon',
    'public.toggle_timer_pause(uuid, text, uuid, jsonb)',
    'EXECUTE'
  ) OR has_function_privilege(
    'authenticated',
    'public.cleanup_stale_timer_locks()',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'local timer RPC grants exceed the caller permission contract';
  END IF;

  IF (
    SELECT count(*)
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename IN ('users', 'households', 'active_timers')
  ) <> 3 THEN
    RAISE EXCEPTION 'local Realtime publication is missing household timer tables';
  END IF;

  SELECT count(*) INTO caregiver_count
  FROM auth.users
  WHERE email IN ('e2e-owner@test.local', 'e2e-member@test.local');

  IF caregiver_count <> 2 THEN
    RAISE EXCEPTION 'expected 2 authenticated caregivers, found %', caregiver_count;
  END IF;

  SELECT count(*) INTO household_caregiver_count
  FROM public.users
  WHERE email IN ('e2e-owner@test.local', 'e2e-member@test.local')
    AND household_id = '00000000-0000-0000-0000-000000000001'::uuid;

  IF household_caregiver_count <> 2 THEN
    RAISE EXCEPTION 'expected both caregivers in the E2E household, found %', household_caregiver_count;
  END IF;

  SELECT count(*) INTO owner_count
  FROM public.users
  WHERE email IN ('e2e-owner@test.local', 'e2e-member@test.local')
    AND is_owner = true;

  IF owner_count <> 1 THEN
    RAISE EXCEPTION 'expected exactly one household owner, found %', owner_count;
  END IF;

  SELECT count(*) INTO baby_count
  FROM public.babies
  WHERE household_id = '00000000-0000-0000-0000-000000000001'::uuid
    AND id IN (
      '00000000-0000-0000-0001-000000000001'::uuid,
      '00000000-0000-0000-0001-000000000002'::uuid
    )
    AND deleted = false;

  IF baby_count <> 2 THEN
    RAISE EXCEPTION 'expected 2 active E2E babies, found %', baby_count;
  END IF;

  SELECT count(*) INTO achievement_count
  FROM public.achievements
  WHERE baby_id IN (
    '00000000-0000-0000-0001-000000000001'::uuid,
    '00000000-0000-0000-0001-000000000002'::uuid
  );

  IF achievement_count <> 16 THEN
    RAISE EXCEPTION 'expected all E2E achievement celebrations to be pre-seeded, found %', achievement_count;
  END IF;
END
$$;

SELECT 'household timer fixtures verified' AS result;

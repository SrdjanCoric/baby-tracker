\set ON_ERROR_STOP on
BEGIN;

GRANT SELECT ON public.users, public.babies TO authenticated;

DO $$
BEGIN
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
  ) THEN
    RAISE EXCEPTION 'anonymous callers must not execute timer-control RPCs';
  END IF;

  IF has_function_privilege(
    'authenticated',
    'public.cleanup_stale_timer_locks()',
    'EXECUTE'
  ) OR NOT has_function_privilege(
    'service_role',
    'public.cleanup_stale_timer_locks()',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'stale timer cleanup must be restricted to service_role';
  END IF;

  IF has_table_privilege('anon', 'public.active_timers', 'SELECT')
    OR has_table_privilege('anon', 'public.active_timers', 'INSERT')
    OR has_table_privilege('anon', 'public.active_timers', 'UPDATE')
    OR has_table_privilege('anon', 'public.active_timers', 'DELETE')
  THEN
    RAISE EXCEPTION 'anonymous callers must not access active timers';
  END IF;
END
$$;

DO $$
DECLARE
  v_household_id uuid;
BEGIN
  INSERT INTO auth.users (id, email)
  VALUES
    ('71111111-1111-1111-1111-111111111111', 'timer-owner@test.dev'),
    ('72222222-2222-2222-2222-222222222222', 'timer-member@test.dev'),
    ('73333333-3333-3333-3333-333333333333', 'timer-outsider@test.dev');

  SELECT users.household_id
  INTO v_household_id
  FROM public.users
  WHERE id = '71111111-1111-1111-1111-111111111111';

  UPDATE public.users
  SET household_id = v_household_id
  WHERE id = '72222222-2222-2222-2222-222222222222';

  INSERT INTO public.babies (id, household_id, name)
  VALUES ('7a000000-0000-0000-0000-000000000001', v_household_id, 'Timer Test Baby');
END
$$;

SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', '73333333-3333-3333-3333-333333333333', 'role', 'authenticated')::text,
  true
);
SET LOCAL ROLE authenticated;
DO $$
DECLARE
  denied BOOLEAN := false;
BEGIN
  BEGIN
    PERFORM *
    FROM public.acquire_timer_lock(
      '7a000000-0000-0000-0000-000000000001',
      'sleep',
      '71111111-1111-1111-1111-111111111111',
      '{}'::jsonb,
      pg_catalog.now()
    );
  EXCEPTION WHEN insufficient_privilege THEN
    denied := true;
  END;

  IF NOT denied THEN
    RAISE EXCEPTION 'an outsider acquired a timer by impersonating its household owner';
  END IF;

  denied := false;
  BEGIN
    PERFORM *
    FROM public.acquire_timer_lock(
      '7a000000-0000-0000-0000-000000000001',
      'sleep',
      '73333333-3333-3333-3333-333333333333',
      '{}'::jsonb,
      pg_catalog.now()
    );
  EXCEPTION WHEN insufficient_privilege THEN
    denied := true;
  END;

  IF NOT denied THEN
    RAISE EXCEPTION 'an outsider acquired a timer for another household''s baby';
  END IF;
END
$$;
RESET ROLE;

SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', '71111111-1111-1111-1111-111111111111', 'role', 'authenticated')::text,
  true
);
SET LOCAL ROLE authenticated;
DO $$
DECLARE
  acquired BOOLEAN;
BEGIN
  SELECT success
  INTO acquired
  FROM public.acquire_timer_lock(
    '7a000000-0000-0000-0000-000000000001',
    'sleep',
    '71111111-1111-1111-1111-111111111111',
    '{}'::jsonb,
    pg_catalog.now()
  );

  IF NOT acquired THEN
    RAISE EXCEPTION 'the timer owner could not acquire a timer';
  END IF;
END
$$;
RESET ROLE;

SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', '72222222-2222-2222-2222-222222222222', 'role', 'authenticated')::text,
  true
);
SET LOCAL ROLE authenticated;
DO $$
DECLARE
  denied BOOLEAN := false;
  visible_count INTEGER;
  updated_count INTEGER;
BEGIN
  BEGIN
    PERFORM public.release_timer_lock(
      '7a000000-0000-0000-0000-000000000001',
      'sleep',
      '71111111-1111-1111-1111-111111111111'
    );
  EXCEPTION WHEN insufficient_privilege THEN
    denied := true;
  END;

  IF NOT denied THEN
    RAISE EXCEPTION 'a household member released another caregiver''s timer';
  END IF;

  SELECT count(*)
  INTO visible_count
  FROM public.active_timers
  WHERE baby_id = '7a000000-0000-0000-0000-000000000001'
    AND activity_type = 'sleep';

  IF visible_count <> 1 THEN
    RAISE EXCEPTION 'a household member could not see timer exclusivity feedback';
  END IF;

  UPDATE public.active_timers
  SET timer_data = '{"isPaused": true}'::jsonb
  WHERE baby_id = '7a000000-0000-0000-0000-000000000001'
    AND activity_type = 'sleep';
  GET DIAGNOSTICS updated_count = ROW_COUNT;

  IF updated_count <> 0 THEN
    RAISE EXCEPTION 'a household member directly updated another caregiver''s timer';
  END IF;
END
$$;
RESET ROLE;

SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', '72222222-2222-2222-2222-222222222222', 'role', 'authenticated')::text,
  true
);
SET LOCAL ROLE authenticated;
DO $$
DECLARE
  denied BOOLEAN := false;
BEGIN
  BEGIN
    PERFORM public.toggle_timer_pause(
      '7a000000-0000-0000-0000-000000000001',
      'sleep',
      '71111111-1111-1111-1111-111111111111',
      '{"isPaused": true, "pausedAt": "2026-07-21T12:00:00.000Z"}'::jsonb
    );
  EXCEPTION WHEN insufficient_privilege THEN
    denied := true;
  END;

  IF NOT denied THEN
    RAISE EXCEPTION 'a household member paused another caregiver''s timer';
  END IF;
END
$$;
RESET ROLE;

SELECT set_config(
  'request.jwt.claims',
  json_build_object('sub', '71111111-1111-1111-1111-111111111111', 'role', 'authenticated')::text,
  true
);
SET LOCAL ROLE authenticated;
DO $$
DECLARE
  paused_data JSONB;
  resumed_data JSONB;
  released BOOLEAN;
  rejected_invalid_state BOOLEAN := false;
BEGIN
  BEGIN
    PERFORM public.toggle_timer_pause(
      '7a000000-0000-0000-0000-000000000001',
      'sleep',
      '71111111-1111-1111-1111-111111111111',
      '{"isPaused": "yes"}'::jsonb
    );
  EXCEPTION WHEN invalid_parameter_value THEN
    rejected_invalid_state := true;
  END;

  IF NOT rejected_invalid_state THEN
    RAISE EXCEPTION 'toggle accepted a malformed pause state';
  END IF;

  PERFORM public.toggle_timer_pause(
    '7a000000-0000-0000-0000-000000000001',
    'sleep',
    '71111111-1111-1111-1111-111111111111',
    '{"isPaused": true, "pausedAt": "2026-07-21T12:00:00.000Z", "accumulatedSeconds": 42}'::jsonb
  );

  SELECT timer_data
  INTO paused_data
  FROM public.active_timers
  WHERE baby_id = '7a000000-0000-0000-0000-000000000001'
    AND activity_type = 'sleep';

  IF paused_data -> 'isPaused' <> 'true'::jsonb OR NOT paused_data ? 'pausedAt' THEN
    RAISE EXCEPTION 'the timer owner could not pause the timer';
  END IF;

  PERFORM public.toggle_timer_pause(
    '7a000000-0000-0000-0000-000000000001',
    'sleep',
    '71111111-1111-1111-1111-111111111111',
    '{"isPaused": false, "effectiveStartTime": "2026-07-21T11:59:18.000Z"}'::jsonb
  );

  SELECT timer_data
  INTO resumed_data
  FROM public.active_timers
  WHERE baby_id = '7a000000-0000-0000-0000-000000000001'
    AND activity_type = 'sleep';

  IF resumed_data -> 'isPaused' <> 'false'::jsonb
    OR resumed_data ? 'pausedAt'
    OR resumed_data ->> 'effectiveStartTime' <> '2026-07-21T11:59:18.000Z'
  THEN
    RAISE EXCEPTION 'the timer owner could not resume with clean pause state: %', resumed_data;
  END IF;

  SELECT public.release_timer_lock(
    '7a000000-0000-0000-0000-000000000001',
    'sleep',
    '71111111-1111-1111-1111-111111111111'
  ) INTO released;

  IF NOT released THEN
    RAISE EXCEPTION 'the timer owner could not release the timer';
  END IF;
END
$$;
RESET ROLE;

ROLLBACK;

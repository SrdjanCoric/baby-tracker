\set ON_ERROR_STOP on
BEGIN;

GRANT SELECT ON public.users, public.babies TO authenticated;
GRANT INSERT ON public.active_timers TO authenticated;

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

-- Simulate a lock created by an older client before the bound trigger existed. The lock must remain
-- mutable through timer_data-only writes until service-role cleanup removes it.
SET LOCAL session_replication_role = replica;
INSERT INTO public.active_timers (
  baby_id,
  activity_type,
  started_by,
  started_at,
  timer_data
)
VALUES (
  '7a000000-0000-0000-0000-000000000001',
  'pumping',
  '71111111-1111-1111-1111-111111111111',
  pg_catalog.now() - INTERVAL '13 hours',
  '{}'::jsonb
);
INSERT INTO public.active_timers (
  baby_id,
  activity_type,
  started_by,
  started_at,
  timer_data
)
VALUES
  (
    '7a000000-0000-0000-0000-000000000001',
    'tummy_time',
    '71111111-1111-1111-1111-111111111111',
    pg_catalog.now() + INTERVAL '1 hour',
    '{}'::jsonb
  ),
  (
    '7a000000-0000-0000-0000-000000000001',
    'feeding',
    '71111111-1111-1111-1111-111111111111',
    pg_catalog.now() + INTERVAL '1 minute',
    '{}'::jsonb
  );
SET LOCAL session_replication_role = origin;

-- Re-run the migration against rows written before its guard existed. Invalid future locks must be
-- removed immediately, while small client-clock skew is retained and normalized to database time.
\ir ../../supabase/migrations/060_guard_active_timer_start_bounds.sql
DO $$
DECLARE
  far_future_count INTEGER;
  near_future_started_at TIMESTAMPTZ;
BEGIN
  SELECT count(*)
  INTO far_future_count
  FROM public.active_timers
  WHERE baby_id = '7a000000-0000-0000-0000-000000000001'
    AND activity_type = 'tummy_time';

  SELECT started_at
  INTO near_future_started_at
  FROM public.active_timers
  WHERE baby_id = '7a000000-0000-0000-0000-000000000001'
    AND activity_type = 'feeding';

  IF far_future_count <> 0 THEN
    RAISE EXCEPTION 'migration left a far-future timer lock in place';
  END IF;

  IF near_future_started_at IS NULL OR near_future_started_at > pg_catalog.now() THEN
    RAISE EXCEPTION 'migration did not normalize a near-future timer lock';
  END IF;
END
$$;

DELETE FROM public.active_timers
WHERE baby_id = '7a000000-0000-0000-0000-000000000001'
  AND activity_type = 'feeding';

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
  rejected_future_insert BOOLEAN := false;
  rejected_future_direct BOOLEAN := false;
  rejected_forward_update BOOLEAN := false;
  rejected_old_direct BOOLEAN := false;
  rejected_future_rpc BOOLEAN := false;
  rejected_old_rpc BOOLEAN := false;
  released BOOLEAN;
  skewed_started_at TIMESTAMPTZ;
  updated_count INTEGER;
  stale_timer_data JSONB;
BEGIN
  BEGIN
    INSERT INTO public.active_timers (
      baby_id,
      activity_type,
      started_by,
      started_at,
      timer_data
    )
    VALUES (
      '7a000000-0000-0000-0000-000000000001',
      'tummy_time',
      '71111111-1111-1111-1111-111111111111',
      pg_catalog.now() + INTERVAL '1 hour',
      '{}'::jsonb
    );
  EXCEPTION WHEN invalid_parameter_value THEN
    rejected_future_insert := true;
  END;

  IF NOT rejected_future_insert THEN
    RAISE EXCEPTION 'an authenticated direct insert accepted a future timer start';
  END IF;

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

  SELECT success
  INTO acquired
  FROM public.acquire_timer_lock(
    '7a000000-0000-0000-0000-000000000001',
    'feeding',
    '71111111-1111-1111-1111-111111111111',
    '{}'::jsonb,
    pg_catalog.now() + INTERVAL '1 minute'
  );

  SELECT started_at
  INTO skewed_started_at
  FROM public.active_timers
  WHERE baby_id = '7a000000-0000-0000-0000-000000000001'
    AND activity_type = 'feeding';

  IF NOT acquired OR skewed_started_at > pg_catalog.now() THEN
    RAISE EXCEPTION 'a slightly fast client clock did not acquire a server-normalized timer';
  END IF;

  SELECT public.release_timer_lock(
    '7a000000-0000-0000-0000-000000000001',
    'feeding',
    '71111111-1111-1111-1111-111111111111'
  ) INTO released;

  IF NOT released THEN
    RAISE EXCEPTION 'the owner could not release the server-normalized timer';
  END IF;

  BEGIN
    UPDATE public.active_timers
    SET started_at = pg_catalog.now() + INTERVAL '6 minutes'
    WHERE baby_id = '7a000000-0000-0000-0000-000000000001'
      AND activity_type = 'sleep';
  EXCEPTION WHEN invalid_parameter_value THEN
    rejected_future_direct := true;
  END;

  IF NOT rejected_future_direct THEN
    RAISE EXCEPTION 'a direct update accepted a future timer start';
  END IF;

  BEGIN
    UPDATE public.active_timers
    SET started_at = pg_catalog.now() - INTERVAL '12 hours 1 minute'
    WHERE baby_id = '7a000000-0000-0000-0000-000000000001'
      AND activity_type = 'sleep';
  EXCEPTION WHEN invalid_parameter_value THEN
    rejected_old_direct := true;
  END;

  IF NOT rejected_old_direct THEN
    RAISE EXCEPTION 'a direct update accepted a timer start beyond the cleanup horizon';
  END IF;

  UPDATE public.active_timers
  SET started_at = pg_catalog.now() - INTERVAL '1 hour'
  WHERE baby_id = '7a000000-0000-0000-0000-000000000001'
    AND activity_type = 'sleep';
  GET DIAGNOSTICS updated_count = ROW_COUNT;

  IF updated_count <> 1 THEN
    RAISE EXCEPTION 'a direct update rejected a timer start inside the valid window';
  END IF;

  BEGIN
    UPDATE public.active_timers
    SET started_at = pg_catalog.now() - INTERVAL '30 minutes'
    WHERE baby_id = '7a000000-0000-0000-0000-000000000001'
      AND activity_type = 'sleep';
  EXCEPTION WHEN invalid_parameter_value THEN
    rejected_forward_update := true;
  END;

  IF NOT rejected_forward_update THEN
    RAISE EXCEPTION 'a timer owner moved an existing lock start forward';
  END IF;

  BEGIN
    PERFORM *
    FROM public.acquire_timer_lock(
      '7a000000-0000-0000-0000-000000000001',
      'tummy_time',
      '71111111-1111-1111-1111-111111111111',
      '{}'::jsonb,
      pg_catalog.now() + INTERVAL '6 minutes'
    );
  EXCEPTION WHEN invalid_parameter_value THEN
    rejected_future_rpc := true;
  END;

  IF NOT rejected_future_rpc THEN
    RAISE EXCEPTION 'acquire_timer_lock accepted a future timer start';
  END IF;

  BEGIN
    PERFORM *
    FROM public.acquire_timer_lock(
      '7a000000-0000-0000-0000-000000000001',
      'tummy_time',
      '71111111-1111-1111-1111-111111111111',
      '{}'::jsonb,
      pg_catalog.now() - INTERVAL '12 hours 1 minute'
    );
  EXCEPTION WHEN invalid_parameter_value THEN
    rejected_old_rpc := true;
  END;

  IF NOT rejected_old_rpc THEN
    RAISE EXCEPTION 'acquire_timer_lock accepted a timer start beyond the cleanup horizon';
  END IF;

  SELECT success
  INTO acquired
  FROM public.acquire_timer_lock(
    '7a000000-0000-0000-0000-000000000001',
    'tummy_time',
    '71111111-1111-1111-1111-111111111111',
    '{}'::jsonb,
    pg_catalog.now() - INTERVAL '1 hour'
  );

  IF NOT acquired THEN
    RAISE EXCEPTION 'acquire_timer_lock rejected a timer start inside the valid window';
  END IF;

  SELECT public.release_timer_lock(
    '7a000000-0000-0000-0000-000000000001',
    'tummy_time',
    '71111111-1111-1111-1111-111111111111'
  ) INTO released;

  IF NOT released THEN
    RAISE EXCEPTION 'the owner could not release the valid explicitly dated timer';
  END IF;

  SELECT success
  INTO acquired
  FROM public.acquire_timer_lock(
    '7a000000-0000-0000-0000-000000000001',
    'feeding',
    '71111111-1111-1111-1111-111111111111',
    '{}'::jsonb
  );

  IF NOT acquired THEN
    RAISE EXCEPTION 'the legacy acquire_timer_lock call shape without p_started_at failed';
  END IF;

  SELECT public.release_timer_lock(
    '7a000000-0000-0000-0000-000000000001',
    'feeding',
    '71111111-1111-1111-1111-111111111111'
  ) INTO released;

  IF NOT released THEN
    RAISE EXCEPTION 'the owner could not release the legacy-call-shape timer';
  END IF;

  UPDATE public.active_timers
  SET timer_data = '{"isPaused": false, "legacy": true}'::jsonb
  WHERE baby_id = '7a000000-0000-0000-0000-000000000001'
    AND activity_type = 'pumping';
  GET DIAGNOSTICS updated_count = ROW_COUNT;

  SELECT timer_data
  INTO stale_timer_data
  FROM public.active_timers
  WHERE baby_id = '7a000000-0000-0000-0000-000000000001'
    AND activity_type = 'pumping';

  IF updated_count <> 1 OR stale_timer_data -> 'legacy' <> 'true'::jsonb THEN
    RAISE EXCEPTION 'a timer_data-only update rejected a grandfathered stale lock';
  END IF;

  PERFORM public.toggle_timer_pause(
    '7a000000-0000-0000-0000-000000000001',
    'pumping',
    '71111111-1111-1111-1111-111111111111',
    '{"isPaused": true, "pausedAt": "2026-07-21T12:00:00.000Z"}'::jsonb
  );
END
$$;
RESET ROLE;

-- Simulate unrelated stale database state present before this vector runs. Cleanup is global, so
-- its returned count must not be treated as the count of this file's own stale-lock fixture.
SET LOCAL session_replication_role = replica;
INSERT INTO public.active_timers (
  baby_id,
  activity_type,
  started_by,
  started_at,
  timer_data
)
VALUES (
  '7a000000-0000-0000-0000-000000000001',
  'tummy_time',
  '71111111-1111-1111-1111-111111111111',
  pg_catalog.now() - INTERVAL '14 hours',
  '{}'::jsonb
);
SET LOCAL session_replication_role = origin;

SET LOCAL ROLE service_role;
DO $$
DECLARE
  cleaned_count INTEGER;
BEGIN
  SELECT public.cleanup_stale_timer_locks() INTO cleaned_count;

  IF cleaned_count < 1 THEN
    RAISE EXCEPTION 'stale cleanup did not report removing the stale fixture';
  END IF;
END
$$;
RESET ROLE;

DO $$
DECLARE
  live_fixture_count INTEGER;
  stale_fixture_count INTEGER;
BEGIN
  SELECT count(*)
  INTO stale_fixture_count
  FROM public.active_timers
  WHERE baby_id = '7a000000-0000-0000-0000-000000000001'
    AND activity_type = 'pumping';

  SELECT count(*)
  INTO live_fixture_count
  FROM public.active_timers
  WHERE baby_id = '7a000000-0000-0000-0000-000000000001'
    AND activity_type = 'sleep';

  IF stale_fixture_count <> 0 OR live_fixture_count <> 1 THEN
    RAISE EXCEPTION 'stale cleanup did not remove the stale fixture while preserving the live fixture';
  END IF;
END
$$;

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

  UPDATE public.active_timers
  SET started_at = pg_catalog.now() - INTERVAL '30 minutes'
  WHERE baby_id = '7a000000-0000-0000-0000-000000000001'
    AND activity_type = 'sleep';
  GET DIAGNOSTICS updated_count = ROW_COUNT;

  IF updated_count <> 0 THEN
    RAISE EXCEPTION 'a household member directly changed another caregiver''s timer start';
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

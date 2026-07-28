\set ON_ERROR_STOP on
BEGIN;

DO $$
DECLARE
  uid uuid := '59111111-1111-4111-8111-111111111111';
  bid uuid := '59bbbbbb-0000-4000-8000-000000000001';
  legacy_id uuid := '59eeeeee-0000-4000-8000-000000000001';
  old_client_id uuid := '59eeeeee-0000-4000-8000-000000000002';
  confirmed_id uuid := '59eeeeee-0000-4000-8000-000000000003';
  hid uuid;
  row_state text;
  row_version smallint;
  preference_allowance integer;
  policy_count integer;
  rls_enabled boolean;
BEGIN
  INSERT INTO auth.users (id, email)
  VALUES (uid, 'morning-classification@test.dev');

  SELECT household_id INTO hid FROM public.users WHERE id = uid;
  INSERT INTO public.babies (id, household_id, name)
  VALUES (bid, hid, 'Morning Classification Baby');

  INSERT INTO public.sleep_sessions (
    id, baby_id, type, started_at, morning_classification_version
  ) VALUES (
    legacy_id, bid, 'night', '2026-07-24T21:00:00Z', NULL
  );

  SELECT morning_classification, morning_classification_version
  INTO row_state, row_version
  FROM public.sleep_sessions WHERE id = legacy_id;
  IF row_state IS NOT NULL OR row_version IS NOT NULL THEN
    RAISE EXCEPTION 'historical legacy representation must remain null/null';
  END IF;

  INSERT INTO public.sleep_sessions (id, baby_id, type, started_at)
  VALUES (old_client_id, bid, 'nap', '2026-07-25T08:30:00Z');

  SELECT morning_classification, morning_classification_version
  INTO row_state, row_version
  FROM public.sleep_sessions WHERE id = old_client_id;
  IF row_state IS NOT NULL OR row_version <> 1 THEN
    RAISE EXCEPTION 'future old-client insert must be distinguishable as null/version-1';
  END IF;

  PERFORM set_config('request.jwt.claims', json_build_object('sub', uid)::text, true);
  PERFORM public.merge_record(
    'sleep_sessions',
    jsonb_build_object(
      'id', confirmed_id,
      'baby_id', bid,
      'type', 'night',
      'started_at', '2026-07-25T08:30:00Z',
      'morning_classification', 'confirmed_night_continuation',
      'morning_classification_version', 1
    ),
    jsonb_build_object(
      'type', '2026-07-25T09:00:00.000Z-0000-new-client',
      'started_at', '2026-07-25T09:00:00.000Z-0000-new-client',
      'morning_classification', '2026-07-25T09:00:00.000Z-0000-new-client',
      'morning_classification_version', '2026-07-25T09:00:00.000Z-0000-new-client'
    )
  );
  PERFORM public.merge_record(
    'sleep_sessions',
    jsonb_build_object('id', confirmed_id, 'notes', 'legacy partial edit'),
    jsonb_build_object('notes', '2026-07-25T09:05:00.000Z-0000-old-client')
  );

  SELECT morning_classification, morning_classification_version
  INTO row_state, row_version
  FROM public.sleep_sessions WHERE id = confirmed_id;
  IF row_state <> 'confirmed_night_continuation' OR row_version <> 1 THEN
    RAISE EXCEPTION 'partial legacy update cleared confirmed classification';
  END IF;

  INSERT INTO public.wake_window_preferences (
    baby_id, enabled, nap_count, wake_window_slots, source
  ) VALUES (
    bid, false, 2, '[]'::jsonb, 'age_based'
  );
  SELECT nap_continuation_minutes INTO preference_allowance
  FROM public.wake_window_preferences WHERE baby_id = bid;
  IF preference_allowance <> 25 THEN
    RAISE EXCEPTION 'new preference default must be 25, got %', preference_allowance;
  END IF;

  SELECT relrowsecurity INTO rls_enabled
  FROM pg_class WHERE oid = 'public.sleep_sessions'::regclass;
  SELECT count(*) INTO policy_count
  FROM pg_policies
  WHERE schemaname = 'public' AND tablename = 'sleep_sessions';
  IF NOT rls_enabled OR policy_count <> 4 THEN
    RAISE EXCEPTION 'sleep-session RLS changed: enabled %, policies %', rls_enabled, policy_count;
  END IF;
END $$;

ROLLBACK;
\echo 'PASS: morning classification migration preserves legacy rows, mixed-version updates, defaults, and RLS'

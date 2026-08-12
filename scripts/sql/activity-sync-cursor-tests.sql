\set ON_ERROR_STOP on

BEGIN;

INSERT INTO auth.users (id, email)
VALUES ('86000000-0000-0000-0000-000000000001', 'cursor-tests@example.invalid');

DO $$
DECLARE
  household uuid;
BEGIN
  SELECT household_id INTO household
  FROM public.users
  WHERE id = '86000000-0000-0000-0000-000000000001';

  INSERT INTO public.babies (id, household_id, name)
  VALUES ('86000000-0000-0000-0000-000000000002', household, 'Cursor Baby');
END
$$;

INSERT INTO public.feedings (id, baby_id, type, started_at, updated_at)
VALUES ('86000000-0000-0000-0001-000000000001', '86000000-0000-0000-0000-000000000002', 'bottle', now(), '2000-01-01');
INSERT INTO public.sleep_sessions (id, baby_id, type, started_at, updated_at)
VALUES ('86000000-0000-0000-0002-000000000001', '86000000-0000-0000-0000-000000000002', 'nap', now(), '2000-01-01');
INSERT INTO public.diapers (id, baby_id, type, changed_at, updated_at)
VALUES ('86000000-0000-0000-0003-000000000001', '86000000-0000-0000-0000-000000000002', 'wet', now(), '2000-01-01');
INSERT INTO public.pumping_sessions (id, baby_id, started_at, updated_at)
VALUES ('86000000-0000-0000-0004-000000000001', '86000000-0000-0000-0000-000000000002', now(), '2000-01-01');
INSERT INTO public.growth_measurements (id, baby_id, measured_at, updated_at)
VALUES ('86000000-0000-0000-0005-000000000001', '86000000-0000-0000-0000-000000000002', current_date, '2000-01-01');
INSERT INTO public.tummy_time_sessions (id, baby_id, started_at, updated_at)
VALUES ('86000000-0000-0000-0006-000000000001', '86000000-0000-0000-0000-000000000002', now(), '2000-01-01');
INSERT INTO public.health_entries (id, baby_id, type, logged_at, updated_at)
VALUES ('86000000-0000-0000-0007-000000000001', '86000000-0000-0000-0000-000000000002', 'symptom', now(), '2000-01-01');
INSERT INTO public.milestone_responses (id, baby_id, milestone_id, state, updated_at)
VALUES ('86000000-0000-0000-0008-000000000001', '86000000-0000-0000-0000-000000000002', 'cursor-test', 'yes', '2000-01-01');

DO $$
DECLARE
  activity_table text;
  stamped_at timestamptz;
  nullable text;
BEGIN
  FOREACH activity_table IN ARRAY ARRAY[
    'feedings', 'sleep_sessions', 'diapers', 'pumping_sessions',
    'growth_measurements', 'tummy_time_sessions', 'health_entries',
    'milestone_responses'
  ] LOOP
    EXECUTE format(
      'SELECT updated_at FROM public.%I WHERE baby_id = %L',
      activity_table, '86000000-0000-0000-0000-000000000002'
    ) INTO stamped_at;
    IF stamped_at <= '2000-01-01'::timestamptz THEN
      RAISE EXCEPTION 'insert accepted caller timestamp for %: %', activity_table, stamped_at;
    END IF;
  END LOOP;

  SELECT is_nullable INTO nullable
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'feedings' AND column_name = 'updated_at';
  IF nullable IS DISTINCT FROM 'NO' THEN
    RAISE EXCEPTION 'feedings.updated_at remains nullable';
  END IF;
  SELECT is_nullable INTO nullable
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'sleep_sessions' AND column_name = 'updated_at';
  IF nullable IS DISTINCT FROM 'NO' THEN
    RAISE EXCEPTION 'sleep_sessions.updated_at remains nullable';
  END IF;
END
$$;
\echo 'PASS: inserts cannot forge or null activity updated_at cursors'

DO $$
DECLARE
  activity_table text;
  stamped_at timestamptz;
BEGIN
  FOREACH activity_table IN ARRAY ARRAY[
    'feedings', 'sleep_sessions', 'diapers', 'pumping_sessions',
    'growth_measurements', 'tummy_time_sessions', 'health_entries',
    'milestone_responses'
  ] LOOP
    EXECUTE format(
      'UPDATE public.%I SET updated_at = %L WHERE baby_id = %L RETURNING updated_at',
      activity_table, '1999-01-01', '86000000-0000-0000-0000-000000000002'
    ) INTO stamped_at;
    IF stamped_at <= '2000-01-01'::timestamptz THEN
      RAISE EXCEPTION 'direct update did not bump %.updated_at: %', activity_table, stamped_at;
    END IF;
  END LOOP;
END
$$;
\echo 'PASS: direct updates bump updated_at on all eight activity tables'

DO $$
DECLARE
  activity_table text;
  row_id uuid;
  field_name text;
  field_value text;
  merged jsonb;
BEGIN
  PERFORM set_config(
    'request.jwt.claims',
    json_build_object('sub', '86000000-0000-0000-0000-000000000001')::text,
    true
  );
  FOR activity_table, row_id, field_name, field_value IN VALUES
    ('feedings', '86000000-0000-0000-0001-000000000001'::uuid, 'notes', 'merged'),
    ('sleep_sessions', '86000000-0000-0000-0002-000000000001'::uuid, 'notes', 'merged'),
    ('diapers', '86000000-0000-0000-0003-000000000001'::uuid, 'notes', 'merged'),
    ('pumping_sessions', '86000000-0000-0000-0004-000000000001'::uuid, 'notes', 'merged'),
    ('growth_measurements', '86000000-0000-0000-0005-000000000001'::uuid, 'notes', 'merged'),
    ('tummy_time_sessions', '86000000-0000-0000-0006-000000000001'::uuid, 'notes', 'merged'),
    ('health_entries', '86000000-0000-0000-0007-000000000001'::uuid, 'notes', 'merged'),
    ('milestone_responses', '86000000-0000-0000-0008-000000000001'::uuid, 'state', 'not_sure')
  LOOP
    merged := public.merge_record(
      activity_table,
      jsonb_build_object(
        'id', row_id,
        'baby_id', '86000000-0000-0000-0000-000000000002',
        field_name, field_value,
        'updated_at', '1998-01-01T00:00:00Z'
      ),
      jsonb_build_object(field_name, '2026-08-12T12:00:00.000Z-0000-cursor-test')
    );
    IF (merged->>'updated_at')::timestamptz <= '2000-01-01'::timestamptz
      OR merged->>field_name IS DISTINCT FROM field_value
    THEN
      RAISE EXCEPTION 'merge_record did not bump/update %: %', activity_table, merged;
    END IF;
  END LOOP;
END
$$;
\echo 'PASS: merge_record bumps updated_at on all eight activity tables'

DO $$
DECLARE
  activity_table text;
  index_name text;
  plan json;
BEGIN
  PERFORM set_config('enable_seqscan', 'off', true);
  FOR activity_table, index_name IN VALUES
    ('feedings', 'idx_feedings_baby_updated_id'),
    ('sleep_sessions', 'idx_sleep_sessions_baby_updated_id'),
    ('diapers', 'idx_diapers_baby_updated_id'),
    ('pumping_sessions', 'idx_pumping_sessions_baby_updated_id'),
    ('growth_measurements', 'idx_growth_measurements_baby_updated_id'),
    ('tummy_time_sessions', 'idx_tummy_time_sessions_baby_updated_id'),
    ('health_entries', 'idx_health_entries_baby_updated_id'),
    ('milestone_responses', 'idx_milestone_responses_baby_updated_id')
  LOOP
    EXECUTE format(
      'EXPLAIN (FORMAT JSON) SELECT id FROM public.%I '
      'WHERE baby_id = %L AND (updated_at > %L OR (updated_at = %L AND id > %L)) '
      'ORDER BY updated_at, id LIMIT 1000',
      activity_table,
      '86000000-0000-0000-0000-000000000002',
      '2000-01-01',
      '2000-01-01',
      '00000000-0000-0000-0000-000000000000'
    ) INTO plan;
    IF plan::text NOT LIKE '%' || index_name || '%' THEN
      RAISE EXCEPTION 'cursor plan for % did not use %: %', activity_table, index_name, plan;
    END IF;
  END LOOP;
END
$$;
\echo 'PASS: cursor query plans use all eight composite indexes'

ROLLBACK;

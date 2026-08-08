\set ON_ERROR_STOP on
BEGIN;

DO $$
DECLARE
  v_spring_start timestamptz;
  v_spring_end timestamptz;
  v_fall_start timestamptz;
  v_fall_end timestamptz;
BEGIN
  v_spring_start := pg_catalog.date_trunc(
    'day',
    '2025-03-09T12:00:00Z'::timestamptz AT TIME ZONE 'America/New_York'
  ) AT TIME ZONE 'America/New_York';
  v_spring_end := (
    pg_catalog.date_trunc(
      'day',
      '2025-03-09T12:00:00Z'::timestamptz AT TIME ZONE 'America/New_York'
    ) + INTERVAL '1 day'
  ) AT TIME ZONE 'America/New_York';
  v_fall_start := pg_catalog.date_trunc(
    'day',
    '2025-11-02T12:00:00Z'::timestamptz AT TIME ZONE 'America/New_York'
  ) AT TIME ZONE 'America/New_York';
  v_fall_end := (
    pg_catalog.date_trunc(
      'day',
      '2025-11-02T12:00:00Z'::timestamptz AT TIME ZONE 'America/New_York'
    ) + INTERVAL '1 day'
  ) AT TIME ZONE 'America/New_York';

  IF v_spring_end - v_spring_start <> INTERVAL '23 hours'
    OR v_fall_end - v_fall_start <> INTERVAL '25 hours'
  THEN
    RAISE EXCEPTION 'presentation-timezone day bounds are not DST-safe';
  END IF;
END
$$;

\echo 'PASS: presentation-timezone day bounds preserve DST transitions'

DO $$
DECLARE
  v_function_oid oid;
  v_security_definer boolean;
  v_config text[];
  v_public_execute boolean;
  v_relation text;
BEGIN
  v_function_oid := pg_catalog.to_regprocedure(
    'public.get_baby_activity_snapshot(uuid,text)'
  );

  IF v_function_oid IS NULL THEN
    RAISE EXCEPTION 'get_baby_activity_snapshot(uuid,text) is missing';
  END IF;

  SELECT
    p.prosecdef,
    p.proconfig,
    EXISTS (
      SELECT 1
      FROM pg_catalog.aclexplode(
        COALESCE(p.proacl, pg_catalog.acldefault('f', p.proowner))
      ) AS privilege
      WHERE privilege.grantee = 0
        AND privilege.privilege_type = 'EXECUTE'
    )
  INTO v_security_definer, v_config, v_public_execute
  FROM pg_catalog.pg_proc AS p
  WHERE p.oid = v_function_oid;

  IF v_security_definer THEN
    RAISE EXCEPTION 'baby activity snapshot must be SECURITY INVOKER';
  END IF;

  IF NOT ('search_path=""' = ANY(COALESCE(v_config, ARRAY[]::text[]))) THEN
    RAISE EXCEPTION 'baby activity snapshot must use an empty search_path';
  END IF;

  IF pg_catalog.has_function_privilege(
    'anon',
    'public.get_baby_activity_snapshot(uuid,text)',
    'EXECUTE'
  ) OR v_public_execute THEN
    RAISE EXCEPTION 'anonymous callers must not execute the baby activity snapshot';
  END IF;

  IF NOT pg_catalog.has_function_privilege(
    'authenticated',
    'public.get_baby_activity_snapshot(uuid,text)',
    'EXECUTE'
  ) THEN
    RAISE EXCEPTION 'authenticated callers must execute the baby activity snapshot';
  END IF;

  FOREACH v_relation IN ARRAY ARRAY[
    'users',
    'babies',
    'activity_goals',
    'wake_window_preferences',
    'feedings',
    'sleep_sessions',
    'diapers',
    'pumping_sessions',
    'growth_measurements',
    'tummy_time_sessions'
  ] LOOP
    IF pg_catalog.has_table_privilege(
      'authenticated',
      'public.' || v_relation,
      'SELECT'
    ) THEN
      RAISE EXCEPTION 'snapshot relation % must not expose every column', v_relation;
    END IF;
  END LOOP;

  IF NOT pg_catalog.has_column_privilege(
    'authenticated', 'public.diapers', 'changed_at', 'SELECT'
  ) OR NOT pg_catalog.has_column_privilege(
    'authenticated', 'public.users', 'household_id', 'SELECT'
  ) OR NOT pg_catalog.has_column_privilege(
    'authenticated', 'public.users', 'display_name', 'SELECT'
  ) OR NOT pg_catalog.has_column_privilege(
    'authenticated', 'public.babies', 'household_id', 'SELECT'
  ) OR pg_catalog.has_column_privilege(
    'authenticated', 'public.diapers', 'notes', 'SELECT'
  ) THEN
    RAISE EXCEPTION 'snapshot invoker grants must expose summary columns without notes';
  END IF;
END
$$;

\echo 'PASS: baby activity snapshot uses the approved authenticated invoker contract'

INSERT INTO auth.users (id, email)
VALUES
  ('81111111-1111-1111-1111-111111111111', 'snapshot-owner@test.dev'),
  ('82222222-2222-2222-2222-222222222222', 'snapshot-member@test.dev'),
  ('83333333-3333-3333-3333-333333333333', 'snapshot-outsider@test.dev');

UPDATE public.users AS member
SET household_id = owner.household_id
FROM public.users AS owner
WHERE member.id = '82222222-2222-2222-2222-222222222222'
  AND owner.id = '81111111-1111-1111-1111-111111111111';

UPDATE public.users
SET display_name = CASE id
  WHEN '81111111-1111-1111-1111-111111111111' THEN 'Snapshot Owner'
  WHEN '82222222-2222-2222-2222-222222222222' THEN 'Snapshot Member'
  ELSE 'Snapshot Outsider'
END
WHERE id IN (
  '81111111-1111-1111-1111-111111111111',
  '82222222-2222-2222-2222-222222222222',
  '83333333-3333-3333-3333-333333333333'
);

INSERT INTO public.babies (id, household_id, name, deleted)
SELECT
  fixture.id,
  fixture.household_id,
  fixture.name,
  fixture.deleted
FROM (
  SELECT
    '8a000000-0000-0000-0000-000000000001'::uuid AS id,
    owner.household_id,
    'Snapshot Baby'::text AS name,
    false AS deleted
  FROM public.users AS owner
  WHERE owner.id = '81111111-1111-1111-1111-111111111111'
  UNION ALL
  SELECT
    '8a000000-0000-0000-0000-000000000002'::uuid,
    owner.household_id,
    'Deleted Snapshot Baby'::text,
    true
  FROM public.users AS owner
  WHERE owner.id = '81111111-1111-1111-1111-111111111111'
  UNION ALL
  SELECT
    '8a000000-0000-0000-0000-000000000003'::uuid,
    outsider.household_id,
    'Other Household Baby'::text,
    false
  FROM public.users AS outsider
  WHERE outsider.id = '83333333-3333-3333-3333-333333333333'
  UNION ALL
  SELECT
    '8a000000-0000-0000-0000-000000000004'::uuid,
    owner.household_id,
    'Sibling Snapshot Baby'::text,
    false
  FROM public.users AS owner
  WHERE owner.id = '81111111-1111-1111-1111-111111111111'
) AS fixture;

SELECT pg_catalog.set_config(
  'request.jwt.claims',
  pg_catalog.json_build_object(
    'sub', '81111111-1111-1111-1111-111111111111',
    'role', 'authenticated'
  )::text,
  true
);
SET LOCAL ROLE authenticated;
DO $$
DECLARE
  v_snapshot jsonb;
BEGIN
  v_snapshot := public.get_baby_activity_snapshot(
    '8a000000-0000-0000-0000-000000000001',
    'Europe/Belgrade'
  );

  IF v_snapshot IS NULL
    OR v_snapshot->>'schemaVersion' <> '1'
    OR v_snapshot->>'babyId' <> '8a000000-0000-0000-0000-000000000001'
    OR v_snapshot->>'babyName' <> 'Snapshot Baby'
    OR v_snapshot->>'timezone' <> 'Europe/Belgrade'
    OR v_snapshot->'activeTimers' <> '[]'::jsonb
    OR v_snapshot->'activeTimer' <> 'null'::jsonb
    OR v_snapshot->'activities' IS NULL
    OR v_snapshot->'localDay'->>'startedAt' IS NULL
    OR v_snapshot->'localDay'->>'endsAt' IS NULL
    OR v_snapshot->>'serverAsOf' IS NULL
    OR v_snapshot->>'updatedAt' <> v_snapshot->>'serverAsOf'
  THEN
    RAISE EXCEPTION 'authorized owner received an invalid base snapshot: %', v_snapshot;
  END IF;

  IF public.get_baby_activity_snapshot(
    '8a000000-0000-0000-0000-000000000002',
    'Europe/Belgrade'
  ) IS NOT NULL THEN
    RAISE EXCEPTION 'deleted baby leaked to its own household owner';
  END IF;
END
$$;
RESET ROLE;

SELECT pg_catalog.set_config(
  'request.jwt.claims',
  pg_catalog.json_build_object(
    'sub', '82222222-2222-2222-2222-222222222222',
    'role', 'authenticated'
  )::text,
  true
);
SET LOCAL ROLE authenticated;
DO $$
DECLARE
  v_snapshot jsonb;
BEGIN
  v_snapshot := public.get_baby_activity_snapshot(
    '8a000000-0000-0000-0000-000000000001',
    'Europe/Belgrade'
  );
  IF v_snapshot->>'babyId' <> '8a000000-0000-0000-0000-000000000001' THEN
    RAISE EXCEPTION 'same-household caregiver could not read the selected baby snapshot';
  END IF;
END
$$;
RESET ROLE;

SELECT pg_catalog.set_config(
  'request.jwt.claims',
  pg_catalog.json_build_object(
    'sub', '83333333-3333-3333-3333-333333333333',
    'role', 'authenticated'
  )::text,
  true
);
SET LOCAL ROLE authenticated;
DO $$
BEGIN
  IF public.get_baby_activity_snapshot(
    '8a000000-0000-0000-0000-000000000001',
    'Europe/Belgrade'
  ) IS NOT NULL OR public.get_baby_activity_snapshot(
    '8a000000-0000-0000-0000-000000000002',
    'Europe/Belgrade'
  ) IS NOT NULL OR public.get_baby_activity_snapshot(
    '8a000000-0000-0000-0000-000000000099',
    'Europe/Belgrade'
  ) IS NOT NULL OR public.get_baby_activity_snapshot(
    '8a000000-0000-0000-0000-000000000003',
    'Invalid/Timezone'
  ) IS NOT NULL THEN
    RAISE EXCEPTION 'snapshot denial or timezone validation leaked a baby response';
  END IF;
END
$$;
RESET ROLE;

SET LOCAL ROLE anon;
DO $$
DECLARE
  v_denied boolean := false;
BEGIN
  BEGIN
    PERFORM public.get_baby_activity_snapshot(
      '8a000000-0000-0000-0000-000000000001',
      'Europe/Belgrade'
    );
  EXCEPTION WHEN insufficient_privilege THEN
    v_denied := true;
  END;

  IF NOT v_denied THEN
    RAISE EXCEPTION 'anonymous caller executed the baby activity snapshot';
  END IF;
END
$$;
RESET ROLE;

\echo 'PASS: baby activity snapshot scopes one active baby to authenticated household members'

SELECT pg_catalog.set_config(
  'test.snapshot_timezone',
  zone.name,
  true
)
FROM pg_catalog.pg_timezone_names AS zone
WHERE EXTRACT(HOUR FROM pg_catalog.now() AT TIME ZONE zone.name) = 12
  AND zone.name NOT LIKE 'posix/%'
  AND zone.name NOT LIKE 'right/%'
ORDER BY zone.name
LIMIT 1;

UPDATE public.babies
SET birth_date = CASE id
  WHEN '8a000000-0000-0000-0000-000000000001' THEN CURRENT_DATE - 300
  ELSE CURRENT_DATE - 21
END
WHERE id IN (
  '8a000000-0000-0000-0000-000000000001',
  '8a000000-0000-0000-0000-000000000004'
);

INSERT INTO public.activity_goals (baby_id, goal_type, target_value, source)
VALUES
  ('8a000000-0000-0000-0000-000000000001', 'sleep', 780, 'custom'),
  ('8a000000-0000-0000-0000-000000000001', 'tummy_time', 3600, 'custom'),
  ('8a000000-0000-0000-0000-000000000004', 'sleep', 123, 'custom'),
  ('8a000000-0000-0000-0000-000000000004', 'tummy_time', 456, 'custom');

INSERT INTO public.wake_window_preferences (
  baby_id,
  enabled,
  nap_count,
  wake_window_slots,
  source,
  day_start_hour,
  day_end_hour,
  nap_continuation_minutes,
  timezone
)
VALUES (
  '8a000000-0000-0000-0000-000000000001',
  true,
  3,
  '[{"slotIndex":0,"label":"First","durationMinutes":90},{"slotIndex":1,"label":"Second","durationMinutes":120},{"slotIndex":2,"label":"Third","durationMinutes":150}]'::jsonb,
  'custom',
  6,
  19,
  25,
  pg_catalog.current_setting('test.snapshot_timezone')
), (
  '8a000000-0000-0000-0000-000000000004',
  true,
  1,
  '[{"slotIndex":0,"label":"Sibling First","durationMinutes":77},{"slotIndex":1,"label":"Sibling Second","durationMinutes":88},{"slotIndex":2,"label":"Sibling Third","durationMinutes":99}]'::jsonb,
  'custom',
  5,
  20,
  10,
  pg_catalog.current_setting('test.snapshot_timezone')
);

WITH clock AS (
  SELECT pg_catalog.date_trunc(
    'day',
    pg_catalog.now() AT TIME ZONE pg_catalog.current_setting('test.snapshot_timezone')
  ) AT TIME ZONE pg_catalog.current_setting('test.snapshot_timezone') AS day_start
)
INSERT INTO public.feedings (
  id, baby_id, logged_by, type, side, started_at, ended_at, duration_seconds, deleted
)
SELECT * FROM (
  SELECT '8f000000-0000-0000-0000-000000000001'::uuid, '8a000000-0000-0000-0000-000000000001'::uuid, '81111111-1111-1111-1111-111111111111'::uuid, 'breast'::varchar, 'left'::varchar, day_start + INTERVAL '7 hours', day_start + INTERVAL '7 hours 10 minutes', 600, false FROM clock
  UNION ALL
  SELECT '8f000000-0000-0000-0000-000000000002', '8a000000-0000-0000-0000-000000000001', '81111111-1111-1111-1111-111111111111', 'breast', 'right', day_start + INTERVAL '7 hours 30 minutes', day_start + INTERVAL '7 hours 40 minutes', 600, false FROM clock
  UNION ALL
  SELECT '8f000000-0000-0000-0000-000000000003', '8a000000-0000-0000-0000-000000000001', '82222222-2222-2222-2222-222222222222', 'bottle', NULL, day_start + INTERVAL '9 hours', day_start + INTERVAL '9 hours 10 minutes', 600, false FROM clock
  UNION ALL
  SELECT '8f000000-0000-0000-0000-000000000004', '8a000000-0000-0000-0000-000000000001', '81111111-1111-1111-1111-111111111111', 'solid', NULL, day_start + INTERVAL '11 hours', NULL, NULL, true FROM clock
  UNION ALL
  SELECT '8f000000-0000-0000-0000-000000000005', '8a000000-0000-0000-0000-000000000003', '83333333-3333-3333-3333-333333333333', 'solid', NULL, day_start + INTERVAL '11 hours 30 minutes', NULL, NULL, false FROM clock
  UNION ALL
  SELECT '8f000000-0000-0000-0000-000000000006', '8a000000-0000-0000-0000-000000000004', '81111111-1111-1111-1111-111111111111', 'solid', NULL, day_start + INTERVAL '11 hours 30 minutes', day_start + INTERVAL '11 hours 40 minutes', 600, false FROM clock
) AS rows;

WITH clock AS (
  SELECT pg_catalog.date_trunc(
    'day',
    pg_catalog.now() AT TIME ZONE pg_catalog.current_setting('test.snapshot_timezone')
  ) AT TIME ZONE pg_catalog.current_setting('test.snapshot_timezone') AS day_start
)
INSERT INTO public.sleep_sessions (
  id, baby_id, logged_by, type, started_at, ended_at, duration_seconds,
  morning_classification, morning_classification_version, deleted
)
SELECT * FROM (
  SELECT '81000000-0000-0000-0000-000000000001'::uuid, '8a000000-0000-0000-0000-000000000001'::uuid, '81111111-1111-1111-1111-111111111111'::uuid, 'night'::varchar, day_start + INTERVAL '30 minutes', day_start + INTERVAL '6 hours', 19800, 'automatic'::text, 1::smallint, false FROM clock
  UNION ALL
  SELECT '81000000-0000-0000-0000-000000000002', '8a000000-0000-0000-0000-000000000001', '81111111-1111-1111-1111-111111111111', 'nap', day_start + INTERVAL '8 hours', day_start + INTERVAL '8 hours 30 minutes', 1800, 'automatic', 1, false FROM clock
  UNION ALL
  SELECT '81000000-0000-0000-0000-000000000003', '8a000000-0000-0000-0000-000000000001', '82222222-2222-2222-2222-222222222222', 'nap', day_start + INTERVAL '8 hours 45 minutes', day_start + INTERVAL '9 hours', 900, 'automatic', 1, false FROM clock
  UNION ALL
  SELECT '81000000-0000-0000-0000-000000000004', '8a000000-0000-0000-0000-000000000001', '82222222-2222-2222-2222-222222222222', 'nap', day_start + INTERVAL '10 hours', day_start + INTERVAL '10 hours 30 minutes', 1800, 'unresolved', 1, false FROM clock
  UNION ALL
  SELECT '81000000-0000-0000-0000-000000000005', '8a000000-0000-0000-0000-000000000001', '81111111-1111-1111-1111-111111111111', 'night', day_start + INTERVAL '10 hours 45 minutes', day_start + INTERVAL '11 hours', 900, 'automatic', 1, true FROM clock
  UNION ALL
  SELECT '81000000-0000-0000-0000-000000000008', '8a000000-0000-0000-0000-000000000004', '81111111-1111-1111-1111-111111111111', 'night', day_start - INTERVAL '2 days' + INTERVAL '30 minutes', day_start - INTERVAL '2 days' + INTERVAL '6 hours', 19800, 'automatic', 1, false FROM clock
  UNION ALL
  SELECT '81000000-0000-0000-0000-000000000010', '8a000000-0000-0000-0000-000000000004', '81111111-1111-1111-1111-111111111111', 'nap', day_start - INTERVAL '1 day' + INTERVAL '8 hours', day_start - INTERVAL '1 day' + INTERVAL '8 hours 30 minutes', 1800, 'automatic', 1, false FROM clock
  UNION ALL
  SELECT '81000000-0000-0000-0000-000000000009', '8a000000-0000-0000-0000-000000000004', '81111111-1111-1111-1111-111111111111', 'nap', day_start + INTERVAL '11 hours 30 minutes', day_start + INTERVAL '11 hours 40 minutes', 600, 'automatic', 1, false FROM clock
) AS rows;

WITH clock AS (
  SELECT pg_catalog.date_trunc(
    'day',
    pg_catalog.now() AT TIME ZONE pg_catalog.current_setting('test.snapshot_timezone')
  ) AT TIME ZONE pg_catalog.current_setting('test.snapshot_timezone') AS day_start
)
INSERT INTO public.diapers (id, baby_id, logged_by, type, changed_at, deleted)
SELECT * FROM (
  SELECT '8d000000-0000-0000-0000-000000000001'::uuid, '8a000000-0000-0000-0000-000000000001'::uuid, '81111111-1111-1111-1111-111111111111'::uuid, 'wet'::varchar, day_start + INTERVAL '7 hours', false FROM clock
  UNION ALL SELECT '8d000000-0000-0000-0000-000000000002', '8a000000-0000-0000-0000-000000000001', '81111111-1111-1111-1111-111111111111', 'dirty', day_start + INTERVAL '8 hours', false FROM clock
  UNION ALL SELECT '8d000000-0000-0000-0000-000000000003', '8a000000-0000-0000-0000-000000000001', '82222222-2222-2222-2222-222222222222', 'mixed', day_start + INTERVAL '9 hours', false FROM clock
  UNION ALL SELECT '8d000000-0000-0000-0000-000000000004', '8a000000-0000-0000-0000-000000000001', '82222222-2222-2222-2222-222222222222', 'dry', day_start + INTERVAL '10 hours', false FROM clock
  UNION ALL SELECT '8d000000-0000-0000-0000-000000000005', '8a000000-0000-0000-0000-000000000001', '81111111-1111-1111-1111-111111111111', 'wet', day_start + INTERVAL '11 hours', true FROM clock
  UNION ALL SELECT '8d000000-0000-0000-0000-000000000006', '8a000000-0000-0000-0000-000000000004', '81111111-1111-1111-1111-111111111111', 'dry', day_start + INTERVAL '11 hours 30 minutes', false FROM clock
) AS rows;

WITH clock AS (
  SELECT pg_catalog.date_trunc('day', pg_catalog.now() AT TIME ZONE pg_catalog.current_setting('test.snapshot_timezone')) AT TIME ZONE pg_catalog.current_setting('test.snapshot_timezone') AS day_start
)
INSERT INTO public.pumping_sessions (id, baby_id, logged_by, started_at, ended_at, duration_seconds, amount_ml, side, deleted)
SELECT * FROM (
  SELECT '82000000-0000-0000-0000-000000000001'::uuid, '8a000000-0000-0000-0000-000000000001'::uuid, '81111111-1111-1111-1111-111111111111'::uuid, day_start + INTERVAL '7 hours', day_start + INTERVAL '7 hours 20 minutes', 1200, 50.50::numeric, 'left'::varchar, false FROM clock
  UNION ALL SELECT '82000000-0000-0000-0000-000000000002', '8a000000-0000-0000-0000-000000000001', '82222222-2222-2222-2222-222222222222', day_start + INTERVAL '9 hours', day_start + INTERVAL '9 hours 20 minutes', 1200, 70.25, 'both', false FROM clock
  UNION ALL SELECT '82000000-0000-0000-0000-000000000003', '8a000000-0000-0000-0000-000000000001', '81111111-1111-1111-1111-111111111111', day_start + INTERVAL '11 hours', day_start + INTERVAL '11 hours 5 minutes', 300, 999, 'right', true FROM clock
  UNION ALL SELECT '82000000-0000-0000-0000-000000000004', '8a000000-0000-0000-0000-000000000004', '81111111-1111-1111-1111-111111111111', day_start + INTERVAL '11 hours 30 minutes', day_start + INTERVAL '11 hours 40 minutes', 600, 321, 'right', false FROM clock
) AS rows;

WITH clock AS (
  SELECT pg_catalog.date_trunc('day', pg_catalog.now() AT TIME ZONE pg_catalog.current_setting('test.snapshot_timezone')) AT TIME ZONE pg_catalog.current_setting('test.snapshot_timezone') AS day_start
)
INSERT INTO public.growth_measurements (id, baby_id, logged_by, measured_at, weight_kg, height_cm, head_cm, deleted)
SELECT * FROM (
  SELECT '8e000000-0000-0000-0000-000000000001'::uuid, '8a000000-0000-0000-0000-000000000001'::uuid, '81111111-1111-1111-1111-111111111111'::uuid, day_start + INTERVAL '7 hours', 7.125::numeric, 68.5::numeric, 42.25::numeric, false FROM clock
  UNION ALL SELECT '8e000000-0000-0000-0000-000000000002', '8a000000-0000-0000-0000-000000000001', '81111111-1111-1111-1111-111111111111', day_start + INTERVAL '11 hours', 99, 99, 99, true FROM clock
  UNION ALL SELECT '8e000000-0000-0000-0000-000000000004', '8a000000-0000-0000-0000-000000000001', '81111111-1111-1111-1111-111111111111', day_start + INTERVAL '8 hours', 7.5, NULL, NULL, false FROM clock
  UNION ALL SELECT '8e000000-0000-0000-0000-000000000003', '8a000000-0000-0000-0000-000000000004', '81111111-1111-1111-1111-111111111111', day_start + INTERVAL '11 hours 30 minutes', 9.999, 99, 99, false FROM clock
) AS rows;

WITH clock AS (
  SELECT pg_catalog.date_trunc('day', pg_catalog.now() AT TIME ZONE pg_catalog.current_setting('test.snapshot_timezone')) AT TIME ZONE pg_catalog.current_setting('test.snapshot_timezone') AS day_start
)
INSERT INTO public.tummy_time_sessions (id, baby_id, logged_by, started_at, ended_at, duration_seconds, deleted)
SELECT * FROM (
  SELECT '8c000000-0000-0000-0000-000000000001'::uuid, '8a000000-0000-0000-0000-000000000001'::uuid, '81111111-1111-1111-1111-111111111111'::uuid, day_start + INTERVAL '7 hours', day_start + INTERVAL '7 hours 10 minutes', 600, false FROM clock
  UNION ALL SELECT '8c000000-0000-0000-0000-000000000002', '8a000000-0000-0000-0000-000000000001', '82222222-2222-2222-2222-222222222222', day_start + INTERVAL '9 hours', day_start + INTERVAL '9 hours 15 minutes', 900, false FROM clock
  UNION ALL SELECT '8c000000-0000-0000-0000-000000000003', '8a000000-0000-0000-0000-000000000001', '81111111-1111-1111-1111-111111111111', day_start + INTERVAL '11 hours', day_start + INTERVAL '11 hours 30 minutes', 1800, true FROM clock
  UNION ALL SELECT '8c000000-0000-0000-0000-000000000004', '8a000000-0000-0000-0000-000000000004', '81111111-1111-1111-1111-111111111111', day_start + INTERVAL '11 hours 30 minutes', day_start + INTERVAL '11 hours 40 minutes', 600, false FROM clock
) AS rows;

WITH clock AS (
  SELECT pg_catalog.date_trunc('day', pg_catalog.now() AT TIME ZONE pg_catalog.current_setting('test.snapshot_timezone')) AT TIME ZONE pg_catalog.current_setting('test.snapshot_timezone') AS day_start
)
INSERT INTO public.active_timers (baby_id, activity_type, started_by, started_at, timer_data)
SELECT * FROM (
  SELECT
    '8a000000-0000-0000-0000-000000000004'::uuid,
    'feeding'::varchar,
    '82222222-2222-2222-2222-222222222222'::uuid,
    day_start + INTERVAL '11 hours 45 minutes',
    '{"timerInstanceId":"sibling-timer","side":"right"}'::jsonb
  FROM clock
  UNION ALL
  SELECT
    '8a000000-0000-0000-0000-000000000004',
    'sleep',
    '82222222-2222-2222-2222-222222222222',
    day_start + INTERVAL '5 hours',
    '{"timerInstanceId":"sibling-sleep-timer","type":"nap","morningClassification":"unresolved"}'::jsonb
  FROM clock
  UNION ALL
  SELECT
    '8a000000-0000-0000-0000-000000000004',
    'pumping',
    '82222222-2222-2222-2222-222222222222',
    day_start + INTERVAL '11 hours 50 minutes',
    '{"timerInstanceId":"sibling-pumping-timer","side":"left"}'::jsonb
  FROM clock
  UNION ALL
  SELECT
    '8a000000-0000-0000-0000-000000000004',
    'tummy_time',
    '82222222-2222-2222-2222-222222222222',
    day_start + INTERVAL '11 hours 55 minutes',
    '{"timerInstanceId":"sibling-tummy-timer"}'::jsonb
  FROM clock
) AS rows;

SELECT pg_catalog.set_config(
  'request.jwt.claims',
  pg_catalog.json_build_object(
    'sub', '81111111-1111-1111-1111-111111111111',
    'role', 'authenticated'
  )::text,
  true
);
SET LOCAL ROLE authenticated;
DO $$
DECLARE
  v_snapshot jsonb;
  v_sibling_snapshot jsonb;
BEGIN
  v_snapshot := public.get_baby_activity_snapshot(
    '8a000000-0000-0000-0000-000000000001',
    pg_catalog.current_setting('test.snapshot_timezone')
  );

  IF v_snapshot->'activities'->'feeding'->>'todayCount' <> '2'
    OR v_snapshot->'activeTimers' <> '[]'::jsonb
    OR v_snapshot->'activities'->'feeding'->>'lastType' <> 'bottle'
    OR v_snapshot->'activities'->'feeding'->'lastSide' <> 'null'::jsonb
    OR v_snapshot->'activities'->'feeding'->>'lastTime' IS NULL
    OR v_snapshot->'activities'->'sleep'->>'todayMinutes' <> '405'
    OR v_snapshot->'activities'->'sleep'->>'goalMinutes' <> '780'
    OR v_snapshot->'activities'->'sleep'->>'lastDurationMinutes' <> '30'
    OR v_snapshot->'activities'->'sleep'->>'sleepType' <> 'nap'
    OR v_snapshot->'activities'->'sleep'->>'napCountToday' <> '2'
    OR v_snapshot->'activities'->'sleep'->>'wakeWindowMinutes' <> '150'
    OR v_snapshot->'activities'->'sleep'->>'wakeWindowSlotLabel' <> 'Third'
    OR v_snapshot->'activities'->'sleep'->>'wakeWindowRequiresNewbornOptIn' <> 'false'
    OR v_snapshot->'activities'->'sleep'->>'morningConfirmationPending' <> 'false'
    OR v_snapshot->'activities'->'sleep'->>'lastSleepEndedAt' IS NULL
    OR v_snapshot->'activities'->'diaper'->'todayCounts' <> '{"wet":1,"dirty":1,"mixed":1,"dry":1}'::jsonb
    OR v_snapshot->'activities'->'diaper'->>'lastType' <> 'dry'
    OR v_snapshot->'activities'->'pumping'->>'todayVolumeMl' <> '120.75'
    OR v_snapshot->'activities'->'pumping'->>'sessionCount' <> '2'
    OR v_snapshot->'activities'->'pumping'->>'lastSide' <> 'both'
    OR (v_snapshot->'activities'->'growth'->'lastMeasurement'->>'weightKg')::numeric <> 7.5
    OR v_snapshot->'activities'->'growth'->'lastMeasurement' ? 'heightCm'
    OR v_snapshot->'activities'->'growth'->'lastMeasurement' ? 'headCircumferenceCm'
    OR v_snapshot->'activities'->'tummyTime'->>'todayMinutes' <> '25'
    OR v_snapshot->'activities'->'tummyTime'->>'goalMinutes' <> '60'
    OR v_snapshot->'activities'->'tummyTime'->>'lastDurationMinutes' <> '15'
  THEN
    RAISE EXCEPTION 'snapshot fields diverged from shipped meanings or included tombstones: %', v_snapshot;
  END IF;

  v_sibling_snapshot := public.get_baby_activity_snapshot(
    '8a000000-0000-0000-0000-000000000004',
    pg_catalog.current_setting('test.snapshot_timezone')
  );
  IF v_sibling_snapshot->'activities'->'sleep'->>'napCountToday' IS DISTINCT FROM '0'
    OR v_sibling_snapshot->'activities'->'sleep'->>'wakeWindowMinutes' IS DISTINCT FROM '77'
    OR v_sibling_snapshot->'activities'->'sleep'->>'wakeWindowSlotLabel' IS DISTINCT FROM 'Sibling First'
    OR v_sibling_snapshot->'activities'->'sleep'->>'wakeWindowRequiresNewbornOptIn' IS DISTINCT FROM 'true'
    OR v_sibling_snapshot->'activities'->'sleep'->>'morningConfirmationPending' IS DISTINCT FROM 'true'
    OR pg_catalog.jsonb_array_length(v_sibling_snapshot->'activeTimers') <> 4
    OR v_sibling_snapshot->'activeTimers'->0->>'context' IS DISTINCT FROM 'Snapshot Member'
    OR v_sibling_snapshot->'activeTimers'->1->>'context' IS DISTINCT FROM 'Snapshot Member'
    OR v_sibling_snapshot->'activeTimers'->2->>'context' IS DISTINCT FROM 'Snapshot Member'
    OR v_sibling_snapshot->'activeTimers'->3->>'context' IS DISTINCT FROM 'Snapshot Member'
  THEN
    RAISE EXCEPTION 'historical night anchor changed the current nap count or wake slot: %', v_sibling_snapshot;
  END IF;
END
$$;
RESET ROLE;

\echo 'PASS: baby activity snapshot returns every Widget summary field with shipped meanings'

WITH clock AS (
  SELECT pg_catalog.date_trunc(
    'day',
    pg_catalog.now() AT TIME ZONE pg_catalog.current_setting('test.snapshot_timezone')
  ) AT TIME ZONE pg_catalog.current_setting('test.snapshot_timezone') AS day_start
)
INSERT INTO public.active_timers (
  baby_id, activity_type, started_by, started_at, timer_data
)
SELECT
  '8a000000-0000-0000-0000-000000000001',
  'sleep',
  '82222222-2222-2222-2222-222222222222',
  day_start + INTERVAL '11 hours',
  '{"timerInstanceId":"modern-sleep-timer","activityId":"81000000-0000-0000-0000-000000000006","type":"nap","isPaused":false}'::jsonb
FROM clock;

SELECT pg_catalog.set_config(
  'request.jwt.claims',
  pg_catalog.json_build_object(
    'sub', '81111111-1111-1111-1111-111111111111',
    'role', 'authenticated'
  )::text,
  true
);
SET LOCAL ROLE authenticated;
DO $$
DECLARE
  v_snapshot jsonb;
BEGIN
  v_snapshot := public.get_baby_activity_snapshot(
    '8a000000-0000-0000-0000-000000000001',
    pg_catalog.current_setting('test.snapshot_timezone')
  );
  IF pg_catalog.jsonb_array_length(v_snapshot->'activeTimers') <> 1
    OR v_snapshot->'activeTimer' <> v_snapshot->'activeTimers'->0
    OR v_snapshot->'activeTimer'->>'timerInstanceId' <> 'modern-sleep-timer'
    OR v_snapshot->'activeTimer'->>'context' IS DISTINCT FROM 'Snapshot Member'
    OR v_snapshot->'activeTimer'->>'isRemote' <> 'true'
    OR v_snapshot->'activities'->'sleep'->>'isActive' <> 'true'
    OR v_snapshot->'activities'->'sleep'->>'lastDurationMinutes' <> '30'
    OR v_snapshot->'activities'->'sleep'->>'napCountToday' <> '2'
  THEN
    RAISE EXCEPTION 'lock-only state was not a coherent pre-stop snapshot: %', v_snapshot;
  END IF;
END
$$;
RESET ROLE;

SELECT pg_catalog.set_config(
  'request.jwt.claims',
  pg_catalog.json_build_object(
    'sub', '82222222-2222-2222-2222-222222222222',
    'role', 'authenticated'
  )::text,
  true
);
SET LOCAL ROLE authenticated;
DO $$
DECLARE
  v_snapshot jsonb;
BEGIN
  v_snapshot := public.get_baby_activity_snapshot(
    '8a000000-0000-0000-0000-000000000001',
    pg_catalog.current_setting('test.snapshot_timezone')
  );
  IF v_snapshot->'activeTimer'->>'context' IS DISTINCT FROM 'nap'
    OR v_snapshot->'activeTimer'->>'isRemote' <> 'false'
  THEN
    RAISE EXCEPTION 'own timer context no longer carries sleep type: %', v_snapshot;
  END IF;
END
$$;
RESET ROLE;

SELECT pg_catalog.set_config(
  'request.jwt.claims',
  pg_catalog.json_build_object(
    'sub', '81111111-1111-1111-1111-111111111111',
    'role', 'authenticated'
  )::text,
  true
);

WITH clock AS (
  SELECT pg_catalog.date_trunc(
    'day',
    pg_catalog.now() AT TIME ZONE pg_catalog.current_setting('test.snapshot_timezone')
  ) AT TIME ZONE pg_catalog.current_setting('test.snapshot_timezone') AS day_start
)
INSERT INTO public.sleep_sessions (
  id, baby_id, logged_by, type, started_at, ended_at, duration_seconds,
  morning_classification, morning_classification_version
)
SELECT
  '81000000-0000-0000-0000-000000000006',
  '8a000000-0000-0000-0000-000000000001',
  '82222222-2222-2222-2222-222222222222',
  'nap',
  day_start + INTERVAL '11 hours',
  day_start + INTERVAL '11 hours 20 minutes',
  1200,
  'automatic',
  1
FROM clock;

SET LOCAL ROLE authenticated;
DO $$
DECLARE
  v_snapshot jsonb;
BEGIN
  v_snapshot := public.get_baby_activity_snapshot(
    '8a000000-0000-0000-0000-000000000001',
    pg_catalog.current_setting('test.snapshot_timezone')
  );
  IF pg_catalog.jsonb_array_length(v_snapshot->'activeTimers') <> 1
    OR v_snapshot->'activities'->'sleep'->>'lastDurationMinutes' <> '30'
    OR v_snapshot->'activities'->'sleep'->>'todayMinutes' <> '405'
    OR v_snapshot->'activities'->'sleep'->>'napCountToday' <> '2'
  THEN
    RAISE EXCEPTION 'matching completion plus lock leaked a partial post-stop summary: %', v_snapshot;
  END IF;
END
$$;
RESET ROLE;

DELETE FROM public.active_timers
WHERE baby_id = '8a000000-0000-0000-0000-000000000001'
  AND activity_type = 'sleep';

SET LOCAL ROLE authenticated;
DO $$
DECLARE
  v_snapshot jsonb;
BEGIN
  v_snapshot := public.get_baby_activity_snapshot(
    '8a000000-0000-0000-0000-000000000001',
    pg_catalog.current_setting('test.snapshot_timezone')
  );
  IF v_snapshot->'activeTimers' <> '[]'::jsonb
    OR v_snapshot->'activeTimer' <> 'null'::jsonb
    OR v_snapshot->'activities'->'sleep'->>'isActive' <> 'false'
    OR v_snapshot->'activities'->'sleep'->>'lastDurationMinutes' <> '20'
    OR v_snapshot->'activities'->'sleep'->>'todayMinutes' <> '425'
    OR v_snapshot->'activities'->'sleep'->>'napCountToday' <> '3'
  THEN
    RAISE EXCEPTION 'released modern completion did not appear as one coherent post-stop snapshot: %', v_snapshot;
  END IF;
END
$$;
RESET ROLE;

WITH clock AS (
  SELECT pg_catalog.date_trunc(
    'day',
    pg_catalog.now() AT TIME ZONE pg_catalog.current_setting('test.snapshot_timezone')
  ) AT TIME ZONE pg_catalog.current_setting('test.snapshot_timezone') AS day_start
)
INSERT INTO public.active_timers (
  baby_id, activity_type, started_by, started_at, timer_data
)
SELECT
  '8a000000-0000-0000-0000-000000000001',
  'sleep',
  '82222222-2222-2222-2222-222222222222',
  day_start + INTERVAL '11 hours 30 minutes',
  '{"sleepType":"nap"}'::jsonb
FROM clock;

WITH clock AS (
  SELECT pg_catalog.date_trunc(
    'day',
    pg_catalog.now() AT TIME ZONE pg_catalog.current_setting('test.snapshot_timezone')
  ) AT TIME ZONE pg_catalog.current_setting('test.snapshot_timezone') AS day_start
)
INSERT INTO public.sleep_sessions (
  id, baby_id, logged_by, type, started_at, ended_at, duration_seconds,
  morning_classification, morning_classification_version
)
SELECT
  '81000000-0000-0000-0000-000000000007',
  '8a000000-0000-0000-0000-000000000001',
  '82222222-2222-2222-2222-222222222222',
  'nap',
  day_start + INTERVAL '11 hours 30 minutes',
  day_start + INTERVAL '11 hours 40 minutes',
  600,
  'automatic',
  1
FROM clock;

SET LOCAL ROLE authenticated;
DO $$
DECLARE
  v_snapshot jsonb;
BEGIN
  v_snapshot := public.get_baby_activity_snapshot(
    '8a000000-0000-0000-0000-000000000001',
    pg_catalog.current_setting('test.snapshot_timezone')
  );
  IF pg_catalog.jsonb_array_length(v_snapshot->'activeTimers') <> 1
    OR v_snapshot->'activities'->'sleep'->>'lastDurationMinutes' <> '20'
    OR v_snapshot->'activities'->'sleep'->>'napCountToday' <> '3'
  THEN
    RAISE EXCEPTION 'legacy completion identity leaked through its matching lock: %', v_snapshot;
  END IF;
END
$$;
RESET ROLE;

DELETE FROM public.active_timers
WHERE baby_id = '8a000000-0000-0000-0000-000000000001'
  AND activity_type = 'sleep';

SET LOCAL ROLE authenticated;
DO $$
DECLARE
  v_snapshot jsonb;
BEGIN
  v_snapshot := public.get_baby_activity_snapshot(
    '8a000000-0000-0000-0000-000000000001',
    pg_catalog.current_setting('test.snapshot_timezone')
  );
  IF v_snapshot->'activeTimers' <> '[]'::jsonb
    OR v_snapshot->'activities'->'sleep'->>'lastDurationMinutes' <> '10'
    OR v_snapshot->'activities'->'sleep'->>'napCountToday' <> '3'
  THEN
    RAISE EXCEPTION 'released legacy completion did not enter the coherent summary: %', v_snapshot;
  END IF;
END
$$;
RESET ROLE;

\echo 'PASS: baby activity snapshot keeps lock-only, persisted-plus-lock, and released states coherent'
SET LOCAL ROLE authenticated;
SELECT pg_catalog.format(
  'MEASURE: baby activity snapshot payload_bytes=%s',
  pg_catalog.octet_length(
    public.get_baby_activity_snapshot(
      '8a000000-0000-0000-0000-000000000001',
      pg_catalog.current_setting('test.snapshot_timezone')
    )::text
  )
);
EXPLAIN (ANALYZE, BUFFERS)
SELECT public.get_baby_activity_snapshot(
  '8a000000-0000-0000-0000-000000000001',
  pg_catalog.current_setting('test.snapshot_timezone')
);
RESET ROLE;
ROLLBACK;

\set ON_ERROR_STOP on
BEGIN;

INSERT INTO auth.users (id, email)
VALUES ('92111111-1111-4111-8111-111111111111', 'wear-diaper-owner@test.dev');

INSERT INTO public.babies (id, household_id, name, deleted)
SELECT
  '92222222-2222-4222-8222-222222222222',
  household_id,
  'Wear Diaper Baby',
  false
FROM public.users
WHERE id = '92111111-1111-4111-8111-111111111111';

SELECT pg_catalog.set_config(
  'request.jwt.claims',
  pg_catalog.json_build_object(
    'sub', '92111111-1111-4111-8111-111111111111',
    'role', 'authenticated'
  )::text,
  true
);
SET LOCAL ROLE authenticated;

DO $$
DECLARE
  v_changed_at timestamptz := pg_catalog.clock_timestamp();
  v_changed_text text;
  v_wear_clock text;
  v_phone_clock text;
  v_wear_record jsonb;
  v_phone_record jsonb;
  v_wear_clocks jsonb;
  v_phone_clocks jsonb;
  v_wear_persisted jsonb;
  v_phone_persisted jsonb;
  v_normalized_wear jsonb;
  v_snapshot jsonb;
BEGIN
  v_changed_text := pg_catalog.to_char(v_changed_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  v_wear_clock := v_changed_text || '-0000-wear-sql-device';
  v_phone_clock := v_changed_text || '-0000-phone-sql-device';
  v_wear_record := pg_catalog.jsonb_build_object(
    'id', '92333333-3333-4333-8333-333333333333',
    'baby_id', '92222222-2222-4222-8222-222222222222',
    'type', 'dirty',
    'stool_color', 'green',
    'changed_at', v_changed_text,
    'logged_by', '92111111-1111-4111-8111-111111111111',
    'created_at', v_changed_text
  );
  v_phone_record := v_wear_record || pg_catalog.jsonb_build_object(
    'id', '92444444-4444-4444-8444-444444444444'
  );
  v_wear_clocks := pg_catalog.jsonb_build_object(
    'id', v_wear_clock,
    'baby_id', v_wear_clock,
    'type', v_wear_clock,
    'stool_color', v_wear_clock,
    'changed_at', v_wear_clock,
    'logged_by', v_wear_clock,
    'created_at', v_wear_clock
  );
  v_phone_clocks := pg_catalog.jsonb_build_object(
    'id', v_phone_clock,
    'baby_id', v_phone_clock,
    'type', v_phone_clock,
    'stool_color', v_phone_clock,
    'changed_at', v_phone_clock,
    'logged_by', v_phone_clock,
    'created_at', v_phone_clock
  );

  v_wear_persisted := public.merge_record(
    'diapers',
    v_wear_record,
    v_wear_clocks,
    'wear-diaper:92333333-3333-4333-8333-333333333333',
    '92111111-1111-4111-8111-111111111111'
  );
  v_phone_persisted := public.merge_record(
    'diapers',
    v_phone_record,
    v_phone_clocks,
    'phone-diaper:92444444-4444-4444-8444-444444444444',
    '92111111-1111-4111-8111-111111111111'
  );

  v_normalized_wear := pg_catalog.jsonb_build_object(
    'id', v_wear_persisted->'id',
    'baby_id', v_wear_persisted->'baby_id',
    'type', v_wear_persisted->'type',
    'stool_color', v_wear_persisted->'stool_color',
    'changed_at', pg_catalog.to_char((v_wear_persisted->>'changed_at')::timestamptz AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'logged_by', v_wear_persisted->'logged_by',
    'created_at', pg_catalog.to_char((v_wear_persisted->>'created_at')::timestamptz AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'field_clocks', v_wear_persisted->'field_clocks'
  );

  IF v_normalized_wear IS DISTINCT FROM
    v_wear_record || pg_catalog.jsonb_build_object('field_clocks', v_wear_clocks)
  THEN
    RAISE EXCEPTION 'Wear diaper row did not persist its submitted shape: %', v_normalized_wear;
  END IF;

  IF (
    SELECT pg_catalog.jsonb_agg(key ORDER BY key)
    FROM pg_catalog.jsonb_object_keys(v_wear_persisted) AS fields(key)
  ) IS DISTINCT FROM (
    SELECT pg_catalog.jsonb_agg(key ORDER BY key)
    FROM pg_catalog.jsonb_object_keys(v_phone_persisted) AS fields(key)
  ) THEN
    RAISE EXCEPTION 'Wear and phone diaper column sets differ: wear %, phone %',
      v_wear_persisted, v_phone_persisted;
  END IF;

  IF (
    SELECT pg_catalog.jsonb_agg(key ORDER BY key)
    FROM pg_catalog.jsonb_object_keys(v_wear_persisted->'field_clocks') AS fields(key)
  ) IS DISTINCT FROM (
    SELECT pg_catalog.jsonb_agg(key ORDER BY key)
    FROM pg_catalog.jsonb_object_keys(v_phone_persisted->'field_clocks') AS fields(key)
  ) THEN
    RAISE EXCEPTION 'Wear and phone diaper clock-key sets differ: wear %, phone %',
      v_wear_persisted->'field_clocks', v_phone_persisted->'field_clocks';
  END IF;

  v_snapshot := public.get_baby_activity_snapshot(
    '92222222-2222-4222-8222-222222222222',
    'UTC'
  );
  IF v_snapshot->'activities'->'diaper'->'todayCounts'->>'dirty' <> '2'
    OR v_snapshot->'activities'->'diaper'->>'lastType' <> 'dirty'
  THEN
    RAISE EXCEPTION 'Shared snapshot did not read back Wear diaper: %', v_snapshot;
  END IF;
END
$$;

\echo 'PASS: Wear and phone diaper merges persist the same shape and read through shared snapshot'
ROLLBACK;

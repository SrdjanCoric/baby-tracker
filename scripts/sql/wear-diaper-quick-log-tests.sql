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
  v_clock text;
  v_record jsonb;
  v_clocks jsonb;
  v_persisted jsonb;
  v_snapshot jsonb;
BEGIN
  v_changed_text := pg_catalog.to_char(v_changed_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"');
  v_clock := v_changed_text || '-0000-wear-sql-device';
  v_record := pg_catalog.jsonb_build_object(
    'id', '92333333-3333-4333-8333-333333333333',
    'baby_id', '92222222-2222-4222-8222-222222222222',
    'type', 'dirty',
    'stool_color', 'green',
    'changed_at', v_changed_text,
    'logged_by', '92111111-1111-4111-8111-111111111111',
    'created_at', v_changed_text
  );
  v_clocks := pg_catalog.jsonb_build_object(
    'id', v_clock,
    'baby_id', v_clock,
    'type', v_clock,
    'stool_color', v_clock,
    'changed_at', v_clock,
    'logged_by', v_clock,
    'created_at', v_clock
  );

  v_persisted := public.merge_record(
    'diapers',
    v_record,
    v_clocks,
    'wear-diaper:92333333-3333-4333-8333-333333333333',
    '92111111-1111-4111-8111-111111111111'
  );

  v_persisted := pg_catalog.jsonb_build_object(
    'id', v_persisted->'id',
    'baby_id', v_persisted->'baby_id',
    'type', v_persisted->'type',
    'stool_color', v_persisted->'stool_color',
    'changed_at', pg_catalog.to_char((v_persisted->>'changed_at')::timestamptz AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'logged_by', v_persisted->'logged_by',
    'created_at', pg_catalog.to_char((v_persisted->>'created_at')::timestamptz AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'),
    'field_clocks', v_persisted->'field_clocks'
  );

  IF v_persisted IS DISTINCT FROM v_record || pg_catalog.jsonb_build_object('field_clocks', v_clocks) THEN
    RAISE EXCEPTION 'Wear diaper row did not persist in phone shape: %', v_persisted;
  END IF;

  v_snapshot := public.get_baby_activity_snapshot(
    '92222222-2222-4222-8222-222222222222',
    'UTC'
  );
  IF v_snapshot->'activities'->'diaper'->'todayCounts'->>'dirty' <> '1'
    OR v_snapshot->'activities'->'diaper'->>'lastType' <> 'dirty'
  THEN
    RAISE EXCEPTION 'Shared snapshot did not read back Wear diaper: %', v_snapshot;
  END IF;
END
$$;

\echo 'PASS: Wear diaper merge persists phone shape and reads through shared snapshot'
ROLLBACK;

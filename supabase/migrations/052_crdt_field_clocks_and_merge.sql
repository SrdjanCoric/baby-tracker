-- CRDT server-side merge (task 0003)
--
-- The Postgres half of the hand-rolled LWW-Map CRDT: per-field last-write-wins registers
-- over the existing flat rows, plus a single atomic merge RPC that becomes the only sanctioned
-- write path for synced records. Twin of the client-side TypeScript merge in
-- src/services/sync/crdt.ts; both are driven by the shared src/services/sync/crdt-vectors.json.
--
-- In-scope tables (9): feedings, sleep_sessions, diapers, pumping_sessions, growth_measurements,
-- tummy_time_sessions, health_entries, milestone_responses (the milestones table), babies.

-- ============================================
-- 1. SCHEMA: field clocks + tombstones
-- ============================================
-- field_clocks maps each column name -> HLC string. deleted is an ordinary LWW field.
-- Empty/missing clock entries compare as epoch by design (legacy rows lose to clocked writes);
-- no backfill.

ALTER TABLE feedings              ADD COLUMN field_clocks JSONB NOT NULL DEFAULT '{}'::jsonb, ADD COLUMN deleted BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE sleep_sessions        ADD COLUMN field_clocks JSONB NOT NULL DEFAULT '{}'::jsonb, ADD COLUMN deleted BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE diapers               ADD COLUMN field_clocks JSONB NOT NULL DEFAULT '{}'::jsonb, ADD COLUMN deleted BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE pumping_sessions      ADD COLUMN field_clocks JSONB NOT NULL DEFAULT '{}'::jsonb, ADD COLUMN deleted BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE growth_measurements   ADD COLUMN field_clocks JSONB NOT NULL DEFAULT '{}'::jsonb, ADD COLUMN deleted BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE tummy_time_sessions   ADD COLUMN field_clocks JSONB NOT NULL DEFAULT '{}'::jsonb, ADD COLUMN deleted BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE health_entries        ADD COLUMN field_clocks JSONB NOT NULL DEFAULT '{}'::jsonb, ADD COLUMN deleted BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE milestone_responses   ADD COLUMN field_clocks JSONB NOT NULL DEFAULT '{}'::jsonb, ADD COLUMN deleted BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE babies                ADD COLUMN field_clocks JSONB NOT NULL DEFAULT '{}'::jsonb, ADD COLUMN deleted BOOLEAN NOT NULL DEFAULT FALSE;

-- Partial indexes matching each table's dominant query shape (live rows only).
CREATE INDEX idx_feedings_active            ON feedings(baby_id)            WHERE deleted = false;
CREATE INDEX idx_sleep_sessions_active      ON sleep_sessions(baby_id)      WHERE deleted = false;
CREATE INDEX idx_diapers_active             ON diapers(baby_id)             WHERE deleted = false;
CREATE INDEX idx_pumping_sessions_active    ON pumping_sessions(baby_id)    WHERE deleted = false;
CREATE INDEX idx_growth_measurements_active ON growth_measurements(baby_id) WHERE deleted = false;
CREATE INDEX idx_tummy_time_sessions_active ON tummy_time_sessions(baby_id) WHERE deleted = false;
CREATE INDEX idx_health_entries_active      ON health_entries(baby_id)      WHERE deleted = false;
CREATE INDEX idx_milestone_responses_active ON milestone_responses(baby_id) WHERE deleted = false;
CREATE INDEX idx_babies_active              ON babies(household_id)         WHERE deleted = false;

-- ============================================
-- 2. REALTIME: ensure field_clocks surfaces on all 9 tables
-- ============================================
-- REPLICA IDENTITY FULL makes UPDATE/DELETE payloads carry every column (incl. field_clocks).
-- The 7 base tables already have it (migration 017); the two later tables do not.
ALTER TABLE health_entries      REPLICA IDENTITY FULL;
ALTER TABLE milestone_responses REPLICA IDENTITY FULL;

-- Idempotently add every in-scope table to the realtime publication. On the hosted project the
-- 7 base tables were added via the dashboard (migration 017 left the ADD TABLE lines commented);
-- adding them here makes a fresh local/CI database emit the same events.
DO $$
DECLARE
  t text;
BEGIN
  FOREACH t IN ARRAY ARRAY[
    'feedings','sleep_sessions','diapers','pumping_sessions','growth_measurements',
    'tummy_time_sessions','health_entries','milestone_responses','babies'
  ] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE %I', t);
    END IF;
  END LOOP;
END $$;

-- ============================================
-- 3. crdt_canonical: order-independent value serialization (tie-break only)
-- ============================================
-- Twin of canonicalString() in crdt.ts. Object keys sorted ascending (C collation = code-point
-- order, matching JS String comparison); arrays in element order; scalars as their JSON text.
-- Used only to break exact clock ties so the merge is deterministic and commutative.
CREATE OR REPLACE FUNCTION crdt_canonical(v jsonb)
RETURNS text
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  t text;
  k text;
  parts text[] := ARRAY[]::text[];
  elem jsonb;
BEGIN
  IF v IS NULL THEN
    RETURN ' u'; -- matches canonicalString(undefined) in the TS twin
  END IF;
  t := jsonb_typeof(v);
  IF t = 'object' THEN
    FOR k IN SELECT key FROM jsonb_object_keys(v) t(key) ORDER BY key COLLATE "C" LOOP
      parts := parts || (to_jsonb(k)::text || ':' || crdt_canonical(v -> k));
    END LOOP;
    RETURN '{' || array_to_string(parts, ',') || '}';
  ELSIF t = 'array' THEN
    FOR elem IN SELECT value FROM jsonb_array_elements(v) LOOP
      parts := parts || crdt_canonical(elem);
    END LOOP;
    RETURN '[' || array_to_string(parts, ',') || ']';
  ELSE
    RETURN v::text; -- string / number / boolean / null → compact JSON scalar
  END IF;
END;
$$;

-- ============================================
-- 4. crdt_merge_fields: pure field-wise LWW merge (table-agnostic)
-- ============================================
-- Twin of merge() in crdt.ts. Inputs are two (fields, clocks) pairs; output is
-- {"fields": <merged>, "fieldClocks": <merged>}. Per field: the side whose clock string is
-- lexicographically greater wins; a missing clock compares as the empty sentinel (loses to any
-- real clock); a field present on only one side is kept; on an exact clock tie the greater
-- canonical value wins (a wins strict ties). The winner's clock is carried only when non-empty.
-- This is the byte-for-byte contract validated by scripts/run-sql-vectors.mjs.
CREATE OR REPLACE FUNCTION crdt_merge_fields(
  a_fields jsonb,
  a_clocks jsonb,
  b_fields jsonb,
  b_clocks jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  result_fields jsonb := '{}'::jsonb;
  result_clocks jsonb := '{}'::jsonb;
  field text;
  a_has boolean;
  b_has boolean;
  ca text;
  cb text;
  winner_fields jsonb;
  winner_clocks jsonb;
  winner_clock text;
BEGIN
  a_fields := COALESCE(a_fields, '{}'::jsonb);
  a_clocks := COALESCE(a_clocks, '{}'::jsonb);
  b_fields := COALESCE(b_fields, '{}'::jsonb);
  b_clocks := COALESCE(b_clocks, '{}'::jsonb);

  FOR field IN
    SELECT k FROM jsonb_object_keys(a_fields) t(k)
    UNION
    SELECT k FROM jsonb_object_keys(b_fields) t(k)
  LOOP
    a_has := a_fields ? field;
    b_has := b_fields ? field;

    IF a_has AND NOT b_has THEN
      winner_fields := a_fields; winner_clocks := a_clocks;
    ELSIF b_has AND NOT a_has THEN
      winner_fields := b_fields; winner_clocks := b_clocks;
    ELSE
      ca := COALESCE(a_clocks ->> field, '');
      cb := COALESCE(b_clocks ->> field, '');
      IF ca COLLATE "C" > cb COLLATE "C" THEN
        winner_fields := a_fields; winner_clocks := a_clocks;
      ELSIF ca COLLATE "C" < cb COLLATE "C" THEN
        winner_fields := b_fields; winner_clocks := b_clocks;
      ELSIF public.crdt_canonical(a_fields -> field) COLLATE "C" >= public.crdt_canonical(b_fields -> field) THEN
        winner_fields := a_fields; winner_clocks := a_clocks;
      ELSE
        winner_fields := b_fields; winner_clocks := b_clocks;
      END IF;
    END IF;

    result_fields := result_fields || jsonb_build_object(field, winner_fields -> field);
    winner_clock := winner_clocks ->> field;
    IF winner_clock IS NOT NULL AND winner_clock <> '' THEN
      result_clocks := result_clocks || jsonb_build_object(field, to_jsonb(winner_clock));
    END IF;
  END LOOP;

  RETURN jsonb_build_object('fields', result_fields, 'fieldClocks', result_clocks);
END;
$$;

-- ============================================
-- 5. merge_record: the only sanctioned write path for synced records
-- ============================================
-- SECURITY DEFINER (bypasses RLS), so it enforces household membership manually via auth.uid(),
-- the same join the RLS policies use. p_record is the full row as jsonb (snake_case columns,
-- including id and baby_id/household_id); p_field_clocks maps changed column names -> HLC string.
-- Locks the existing row, merges field-by-field against it, and upserts the winning row.
-- Concurrent calls on the same (table,id) serialize via an advisory xact lock, so no field is lost.
-- search_path pins pg_temp LAST and every guard/target relation is schema-qualified, so a caller
-- cannot shadow the authorization joins with a temp table of the same name.
CREATE OR REPLACE FUNCTION merge_record(
  p_table text,
  p_record jsonb,
  p_field_clocks jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_allowed CONSTANT text[] := ARRAY[
    'feedings','sleep_sessions','diapers','pumping_sessions','growth_measurements',
    'tummy_time_sessions','health_entries','milestone_responses','babies'
  ];
  v_uid uuid := auth.uid();
  v_id uuid;
  v_in_key uuid;
  v_ex_key uuid;
  v_found boolean;
  v_existing jsonb;
  v_existing_clocks jsonb;
  v_merged jsonb;
  v_full jsonb;
  v_cols text;
  v_set text;
  v_result jsonb;
BEGIN
  IF NOT (p_table = ANY (v_allowed)) THEN
    RAISE EXCEPTION 'merge_record: table % is not mergeable', p_table USING ERRCODE = '22023';
  END IF;

  v_id := (p_record ->> 'id')::uuid;
  IF v_id IS NULL THEN
    RAISE EXCEPTION 'merge_record: record.id is required' USING ERRCODE = '22023';
  END IF;

  -- Serialize concurrent merges of the same row (covers the insert/insert race too).
  PERFORM pg_advisory_xact_lock(hashtextextended(p_table || ':' || v_id::text, 0));

  EXECUTE format('SELECT to_jsonb(t.*) FROM public.%I t WHERE t.id = $1 FOR UPDATE', p_table)
    INTO v_existing USING v_id;
  v_found := v_existing IS NOT NULL;

  -- Access check. The caller must own every household this write touches: the incoming record's
  -- (when it carries the ownership key) AND the existing row's (when one exists). A partial delta
  -- may omit baby_id/household_id — then ownership is derived from the existing row, and the
  -- existing-row check also blocks the id-collision hijack (owned key + another household's id).
  -- Inserting (no existing row) requires the ownership key to be present.
  IF p_table = 'babies' THEN
    v_in_key := (p_record ->> 'household_id')::uuid;
    v_ex_key := (v_existing ->> 'household_id')::uuid;
    IF v_in_key IS NULL AND NOT v_found THEN
      RAISE EXCEPTION 'merge_record: household_id is required to insert' USING ERRCODE = '22023';
    END IF;
    IF v_in_key IS NOT NULL
       AND NOT EXISTS (SELECT 1 FROM public.users WHERE id = v_uid AND household_id = v_in_key) THEN
      RAISE EXCEPTION 'merge_record: access denied' USING ERRCODE = '42501';
    END IF;
    IF v_found
       AND NOT EXISTS (SELECT 1 FROM public.users WHERE id = v_uid AND household_id = v_ex_key) THEN
      RAISE EXCEPTION 'merge_record: access denied' USING ERRCODE = '42501';
    END IF;
  ELSE
    v_in_key := (p_record ->> 'baby_id')::uuid;
    v_ex_key := (v_existing ->> 'baby_id')::uuid;
    IF v_in_key IS NULL AND NOT v_found THEN
      RAISE EXCEPTION 'merge_record: baby_id is required to insert' USING ERRCODE = '22023';
    END IF;
    IF v_in_key IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.babies b JOIN public.users u ON b.household_id = u.household_id
      WHERE b.id = v_in_key AND u.id = v_uid
    ) THEN
      RAISE EXCEPTION 'merge_record: access denied' USING ERRCODE = '42501';
    END IF;
    IF v_found AND NOT EXISTS (
      SELECT 1 FROM public.babies b JOIN public.users u ON b.household_id = u.household_id
      WHERE b.id = v_ex_key AND u.id = v_uid
    ) THEN
      RAISE EXCEPTION 'merge_record: access denied' USING ERRCODE = '42501';
    END IF;
  END IF;

  IF v_found THEN
    v_existing_clocks := COALESCE(v_existing -> 'field_clocks', '{}'::jsonb);
    v_existing := v_existing - 'field_clocks';
  ELSE
    v_existing := '{}'::jsonb;
    v_existing_clocks := '{}'::jsonb;
  END IF;

  -- Merge existing (a) against incoming (b). The merge is commutative, so order is immaterial.
  v_merged := public.crdt_merge_fields(
    v_existing, v_existing_clocks,
    p_record - 'field_clocks', COALESCE(p_field_clocks, '{}'::jsonb)
  );

  -- Reassemble the row: default deleted=false, then merged data columns, then merged clocks.
  v_full := jsonb_build_object('deleted', false)
            || (v_merged -> 'fields')
            || jsonb_build_object('field_clocks', v_merged -> 'fieldClocks');

  -- updated_at is server bookkeeping, not a clocked field: bump it on every write (when present).
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = p_table AND column_name = 'updated_at'
  ) THEN
    v_full := v_full || jsonb_build_object('updated_at', to_jsonb(now()));
  END IF;

  -- Only write columns actually present in v_full, so columns the client omitted keep their
  -- DEFAULT (e.g. created_at DEFAULT now()) on insert instead of being clobbered to NULL.
  SELECT string_agg(quote_ident(column_name), ', ' ORDER BY ordinal_position)
  INTO v_cols
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = p_table AND v_full ? column_name;

  SELECT string_agg(quote_ident(column_name) || ' = EXCLUDED.' || quote_ident(column_name), ', ')
  INTO v_set
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = p_table
    AND v_full ? column_name AND column_name <> 'id';

  EXECUTE format(
    'INSERT INTO public.%1$I (%2$s) SELECT %2$s FROM jsonb_populate_record(NULL::public.%1$I, $1)
     ON CONFLICT (id) DO UPDATE SET %3$s
     RETURNING to_jsonb(%1$I.*)',
    p_table, v_cols, v_set
  )
  INTO v_result USING v_full;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION crdt_canonical(jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION crdt_merge_fields(jsonb, jsonb, jsonb, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION merge_record(text, jsonb, jsonb) TO authenticated;

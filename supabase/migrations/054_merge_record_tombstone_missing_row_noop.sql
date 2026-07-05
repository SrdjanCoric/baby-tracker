-- Task 0005 follow-up: a tombstone delete of a row the server never saw must be a no-op.
--
-- Deletes are now tombstone writes: merge_record is called with p_record = {id, deleted:true} and
-- no ownership key (baby_id / household_id). If that row does not exist server-side (e.g. a record
-- whose CREATE was quarantined, or a purely-local row), the insert-key guard raised
-- '<key> is required to insert', so the queued op retried until it was quarantined — a regression
-- from the old hard delete, which no-op'd a missing row.
--
-- Fix: when there is no existing row AND no ownership key AND the incoming write is a delete,
-- return NULL (nothing to insert, nothing to merge). A non-delete insert without the ownership key
-- still raises, since that genuinely cannot produce a valid row. Everything else is a byte-for-byte
-- copy of the migration 052 definition.

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
  v_is_delete boolean;
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

  v_is_delete := COALESCE((p_record ->> 'deleted')::boolean, false);

  -- Serialize concurrent merges of the same row (covers the insert/insert race too).
  PERFORM pg_advisory_xact_lock(hashtextextended(p_table || ':' || v_id::text, 0));

  EXECUTE format('SELECT to_jsonb(t.*) FROM public.%I t WHERE t.id = $1 FOR UPDATE', p_table)
    INTO v_existing USING v_id;
  v_found := v_existing IS NOT NULL;

  -- Access check. The caller must own every household this write touches: the incoming record's
  -- (when it carries the ownership key) AND the existing row's (when one exists). A partial delta
  -- may omit baby_id/household_id — then ownership is derived from the existing row, and the
  -- existing-row check also blocks the id-collision hijack (owned key + another household's id).
  -- Inserting (no existing row) requires the ownership key to be present — except a tombstone
  -- delete of a missing row, which is a no-op (there is nothing to delete).
  IF p_table = 'babies' THEN
    v_in_key := (p_record ->> 'household_id')::uuid;
    v_ex_key := (v_existing ->> 'household_id')::uuid;
    IF v_in_key IS NULL AND NOT v_found THEN
      IF v_is_delete THEN RETURN NULL; END IF;
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
      IF v_is_delete THEN RETURN NULL; END IF;
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

GRANT EXECUTE ON FUNCTION merge_record(text, jsonb, jsonb) TO authenticated;

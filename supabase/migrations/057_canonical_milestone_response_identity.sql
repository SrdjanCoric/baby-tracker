-- Milestone responses use (baby_id, milestone_id) as their logical identity. Older clients can
-- queue a recheck under a fresh UUID after hiding a tombstone, so resolve that UUID to the
-- canonical row before applying the ordinary per-field CRDT merge.

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
  v_input_id uuid;
  v_id uuid;
  v_in_key uuid;
  v_ex_key uuid;
  v_milestone_id text;
  v_found boolean;
  v_is_delete boolean;
  v_record jsonb := p_record;
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

  v_input_id := (v_record ->> 'id')::uuid;
  v_id := v_input_id;
  IF v_id IS NULL THEN
    RAISE EXCEPTION 'merge_record: record.id is required' USING ERRCODE = '22023';
  END IF;

  v_is_delete := COALESCE((v_record ->> 'deleted')::boolean, false);

  IF p_table = 'milestone_responses' THEN
    SELECT to_jsonb(response.*)
    INTO v_existing
    FROM public.milestone_responses response
    WHERE response.id = v_input_id;

    v_in_key := (v_record ->> 'baby_id')::uuid;
    v_milestone_id := v_record ->> 'milestone_id';
    IF v_existing IS NOT NULL THEN
      v_in_key := COALESCE(v_in_key, (v_existing ->> 'baby_id')::uuid);
      v_milestone_id := COALESCE(v_milestone_id, v_existing ->> 'milestone_id');
    END IF;

    PERFORM pg_advisory_xact_lock(hashtextextended(p_table || ':' || v_input_id::text, 0));
    IF v_in_key IS NOT NULL AND v_milestone_id IS NOT NULL THEN
      PERFORM pg_advisory_xact_lock(
        hashtextextended(p_table || ':' || v_in_key::text || ':' || v_milestone_id, 0)
      );
    END IF;

    SELECT to_jsonb(response.*)
    INTO v_existing
    FROM public.milestone_responses response
    WHERE response.id = v_input_id
    FOR UPDATE;

    IF v_existing IS NULL AND v_in_key IS NOT NULL AND v_milestone_id IS NOT NULL THEN
      SELECT to_jsonb(response.*)
      INTO v_existing
      FROM public.milestone_responses response
      WHERE response.baby_id = v_in_key
        AND response.milestone_id = v_milestone_id
      FOR UPDATE;
      IF v_existing IS NOT NULL THEN
        v_id := (v_existing ->> 'id')::uuid;
        v_record := jsonb_set(v_record, '{id}', to_jsonb(v_id));
      END IF;
    END IF;
  ELSE
    PERFORM pg_advisory_xact_lock(hashtextextended(p_table || ':' || v_id::text, 0));
    EXECUTE format('SELECT to_jsonb(t.*) FROM public.%I t WHERE t.id = $1 FOR UPDATE', p_table)
      INTO v_existing USING v_id;
  END IF;

  v_found := v_existing IS NOT NULL;

  IF p_table = 'babies' THEN
    v_in_key := (v_record ->> 'household_id')::uuid;
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
    v_in_key := (v_record ->> 'baby_id')::uuid;
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

  v_merged := public.crdt_merge_fields(
    v_existing, v_existing_clocks,
    v_record - 'field_clocks', COALESCE(p_field_clocks, '{}'::jsonb)
  );

  v_full := jsonb_build_object('deleted', false)
            || (v_merged -> 'fields')
            || jsonb_build_object('field_clocks', v_merged -> 'fieldClocks');

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = p_table AND column_name = 'updated_at'
  ) THEN
    v_full := v_full || jsonb_build_object('updated_at', to_jsonb(now()));
  END IF;

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

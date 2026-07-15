-- Durable queue replay must be harmless when the client crashes after the server commits but
-- before the local acknowledgement is persisted. The five-argument overload binds a queued
-- operation to its initiating user and records the result in the same transaction as merge_record.

CREATE TABLE sync_operation_acknowledgements (
  user_id uuid NOT NULL,
  operation_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, operation_id)
);

ALTER TABLE sync_operation_acknowledgements ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON TABLE sync_operation_acknowledgements FROM PUBLIC, anon, authenticated;

CREATE OR REPLACE FUNCTION merge_record(
  p_table text,
  p_record jsonb,
  p_field_clocks jsonb,
  p_operation_id text,
  p_expected_user_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_result jsonb;
  v_seen boolean;
BEGIN
  IF v_uid IS NULL OR v_uid IS DISTINCT FROM p_expected_user_id THEN
    RAISE EXCEPTION 'merge_record: authenticated user changed' USING ERRCODE = '42501';
  END IF;
  IF p_operation_id IS NULL OR length(p_operation_id) = 0 THEN
    RAISE EXCEPTION 'merge_record: operation id is required' USING ERRCODE = '22023';
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(v_uid::text || ':' || p_operation_id, 0)
  );

  SELECT true
  INTO v_seen
  FROM public.sync_operation_acknowledgements acknowledgement
  WHERE acknowledgement.user_id = v_uid
    AND acknowledgement.operation_id = p_operation_id;

  IF COALESCE(v_seen, false) THEN
    RETURN NULL;
  END IF;

  v_result := public.merge_record(p_table, p_record, p_field_clocks);

  INSERT INTO public.sync_operation_acknowledgements (user_id, operation_id)
  VALUES (v_uid, p_operation_id);

  RETURN v_result;
END;
$$;

REVOKE ALL ON FUNCTION merge_record(text, jsonb, jsonb, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION merge_record(text, jsonb, jsonb, text, uuid) TO authenticated;

-- Released app versions still call the three-argument overload. Do not revoke or otherwise alter
-- its existing privileges in this migration: applying 055 must preserve the complete legacy RPC
-- contract during a mixed-version mobile rollout. The legacy implementation retains its
-- household authorization checks from migration 054, but it does not provide operation
-- acknowledgement/idempotency; new clients use the five-argument overload above. A later,
-- separately deployed migration may retire or harden the legacy API after old versions are no
-- longer supported.
GRANT EXECUTE ON FUNCTION merge_record(text, jsonb, jsonb) TO authenticated;

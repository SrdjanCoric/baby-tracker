-- Use the immutable 061 body as the oracle, with the candidate restored before tests.
CREATE TEMP TABLE snapshot_candidate AS
SELECT pg_catalog.pg_get_functiondef(p.oid) AS ddl,
       p.prorettype, p.proargtypes, p.proargnames, p.provolatile, p.prosecdef,
       p.proconfig, p.proacl
FROM pg_catalog.pg_proc AS p
WHERE p.oid = 'public.get_baby_activity_snapshot(uuid,text)'::regprocedure;
CREATE TEMP TABLE snapshot_column_grants AS
SELECT c.oid AS relation, c.relacl, a.attnum, a.attacl
FROM pg_catalog.pg_class c JOIN pg_catalog.pg_attribute a ON a.attrelid=c.oid
WHERE c.oid IN ('public.users'::regclass,'public.babies'::regclass,
  'public.activity_goals'::regclass,'public.wake_window_preferences'::regclass,
  'public.feedings'::regclass,'public.sleep_sessions'::regclass,'public.diapers'::regclass,
  'public.pumping_sessions'::regclass,'public.growth_measurements'::regclass,
  'public.tummy_time_sessions'::regclass) AND a.attnum > 0;
\ir ../../supabase/migrations/061_get_baby_activity_snapshot.sql
DO $$
DECLARE reference_ddl text;
BEGIN
  IF EXISTS (
    SELECT prorettype, proargtypes, proargnames, provolatile, prosecdef, proconfig, proacl
    FROM snapshot_candidate
    EXCEPT
    SELECT prorettype, proargtypes, proargnames, provolatile, prosecdef, proconfig, proacl
    FROM pg_catalog.pg_proc
    WHERE oid = 'public.get_baby_activity_snapshot(uuid,text)'::regprocedure
  ) THEN
    RAISE EXCEPTION 'candidate changed the 061 function metadata or grants';
  END IF;
  IF EXISTS (
    SELECT relation, relacl, attnum, attacl FROM snapshot_column_grants
    EXCEPT
    SELECT c.oid, c.relacl, a.attnum, a.attacl
    FROM pg_catalog.pg_class c JOIN pg_catalog.pg_attribute a ON a.attrelid=c.oid
  ) THEN
    RAISE EXCEPTION 'candidate changed the 061 relation or column grants';
  END IF;
  SELECT pg_catalog.replace(pg_catalog.pg_get_functiondef(
    'public.get_baby_activity_snapshot(uuid,text)'::regprocedure),
    'public.get_baby_activity_snapshot', 'pg_temp.snapshot_061') INTO reference_ddl;
  EXECUTE reference_ddl;
  EXECUTE (SELECT ddl FROM snapshot_candidate);
END $$;

CREATE FUNCTION pg_temp.checked_snapshot(baby uuid, zone text) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE actual jsonb; expected jsonb;
BEGIN
  actual := public.get_baby_activity_snapshot(baby, zone);
  expected := pg_temp.snapshot_061(baby, zone);
  IF actual IS DISTINCT FROM expected THEN
    RAISE EXCEPTION 'snapshot differs from 061 for baby %, zone %: actual %, expected %',
      baby, zone, actual, expected;
  END IF;
  RETURN actual;
END $$;
REVOKE ALL ON FUNCTION pg_temp.checked_snapshot(uuid,text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION pg_temp.checked_snapshot(uuid,text) TO authenticated;

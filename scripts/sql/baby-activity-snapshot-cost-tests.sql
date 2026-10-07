\set ON_ERROR_STOP on
BEGIN;
\ir baby-activity-snapshot-oracle.sql
\ir baby-activity-snapshot-history-fixture.sql

CREATE FUNCTION pg_temp.snapshot_plan(expand_body boolean) RETURNS jsonb
LANGUAGE plpgsql SECURITY INVOKER AS $$
DECLARE query text; plan jsonb;
BEGIN
  IF expand_body THEN
    SELECT replace(replace(prosrc, 'p_baby_id', '$1'),
      'p_timezone', '$2') INTO query
    FROM pg_proc WHERE oid = 'public.get_baby_activity_snapshot(uuid,text)'::regprocedure;
    EXECUTE 'PREPARE snapshot_body(uuid,text) AS ' || query;
    PERFORM set_config('plan_cache_mode','force_generic_plan',true);
    query := 'EXECUTE snapshot_body(''87000000-0000-0000-0000-000000000002'',''UTC'')';
  ELSE
    query := 'SELECT public.get_baby_activity_snapshot(''87000000-0000-0000-0000-000000000002'',''UTC'')';
  END IF;
  EXECUTE 'EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ' || query INTO plan;
  IF expand_body THEN
    EXECUTE 'DEALLOCATE snapshot_body';
    PERFORM set_config('plan_cache_mode','auto',true);
  END IF;
  RETURN plan->0->'Plan';
END $$;

SELECT pg_temp.add_history(0,6);
ANALYZE public.feedings, public.sleep_sessions, public.diapers, public.pumping_sessions,
  public.growth_measurements, public.tummy_time_sessions;
CREATE TEMP TABLE snapshot_cost (history text, plan jsonb);
GRANT INSERT, SELECT ON snapshot_cost TO authenticated;
SET LOCAL ROLE authenticated;
SELECT pg_temp.checked_snapshot('87000000-0000-0000-0000-000000000002','UTC') IS NOT NULL AS week_equivalent;
SELECT pg_temp.snapshot_plan(false) IS NOT NULL AS warm;
INSERT INTO snapshot_cost VALUES ('week',pg_temp.snapshot_plan(false));
RESET ROLE;
SELECT pg_temp.add_history(7,729);
ANALYZE public.feedings, public.sleep_sessions, public.diapers, public.pumping_sessions,
  public.growth_measurements, public.tummy_time_sessions;
SET LOCAL ROLE authenticated;
DO $$
DECLARE zone text; node jsonb; relations text[] := ARRAY[]::text[];
BEGIN
  FOREACH zone IN ARRAY ARRAY['UTC','Europe/Belgrade','America/New_York'] LOOP
    PERFORM pg_temp.checked_snapshot('87000000-0000-0000-0000-000000000002', zone);
  END LOOP;
  FOR node IN
    WITH RECURSIVE nodes AS (
      SELECT pg_temp.snapshot_plan(true) AS value, ''::text AS trail
      UNION ALL
      SELECT child, trail || '/' || COALESCE(nodes.value->>'Subplan Name',nodes.value->>'Node Type')
      FROM nodes CROSS JOIN LATERAL jsonb_array_elements(nodes.value->'Plans') child
    ) SELECT value || jsonb_build_object('trail',trail) FROM nodes
    WHERE value->>'Relation Name' IN ('feedings','sleep_sessions','diapers',
      'pumping_sessions','growth_measurements','tummy_time_sessions')
  LOOP
    relations := array_append(relations,node->>'Relation Name');
    IF node->>'Node Type' NOT IN ('Index Scan','Index Only Scan','Bitmap Heap Scan') THEN
      RAISE EXCEPTION 'activity read does not use an index: % %, path %',
        node->>'Relation Name',node->>'Node Type',node->>'trail';
    END IF;
    IF COALESCE((node->>'Actual Rows')::numeric,0) + COALESCE((node->>'Rows Removed by Filter')::numeric,0) > 56 THEN
      -- One fixture week has at most 56 rows of a type; a snapshot must not visit older history.
      RAISE EXCEPTION 'activity read visited more than a fixture week: % rows=%, filtered=%',node->>'Relation Name',node->>'Actual Rows',node->>'Rows Removed by Filter' || ' alias=' || (node->>'Alias') || ' cond=' || COALESCE(node->>'Index Cond','none') || ' trail=' || (node->>'trail');
    END IF;
  END LOOP;
  IF NOT ARRAY['feedings','sleep_sessions','diapers','pumping_sessions',
    'growth_measurements','tummy_time_sessions'] <@ relations THEN
    RAISE EXCEPTION 'plan did not exercise every activity table: %',relations;
  END IF;
END $$;
SELECT pg_temp.snapshot_plan(false) IS NOT NULL AS warm;
INSERT INTO snapshot_cost VALUES ('two years',pg_temp.snapshot_plan(false));

SELECT history, (plan->>'Shared Hit Blocks')::integer + (plan->>'Shared Read Blocks')::integer AS buffers
FROM snapshot_cost;
DO $$
DECLARE week_buffers bigint; history_buffers bigint;
BEGIN
  IF (SELECT count(*) FROM pg_index i JOIN pg_class c ON c.oid=i.indexrelid
      WHERE c.relname IN ('idx_snapshot_feedings','idx_snapshot_sleep_started',
        'idx_snapshot_sleep_ended','idx_snapshot_diapers','idx_snapshot_pumping',
        'idx_snapshot_growth','idx_snapshot_tummy') AND i.indisvalid AND i.indisready) <> 7 THEN
    RAISE EXCEPTION 'all seven snapshot indexes must be ready and valid';
  END IF;
  SELECT (plan->>'Shared Hit Blocks')::bigint + (plan->>'Shared Read Blocks')::bigint
  INTO week_buffers FROM snapshot_cost WHERE history='week';
  SELECT (plan->>'Shared Hit Blocks')::bigint + (plan->>'Shared Read Blocks')::bigint
  INTO history_buffers FROM snapshot_cost WHERE history='two years';
  IF history_buffers > 2 * week_buffers THEN
    RAISE EXCEPTION 'two-year snapshot exceeds twice the week cost: % versus % buffers',
      history_buffers, week_buffers;
  END IF;
END $$;
RESET ROLE;
\echo 'PASS: snapshot activity reads are indexed and two years cost at most twice one week'

ROLLBACK;

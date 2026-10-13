\set ON_ERROR_STOP on
BEGIN;
INSERT INTO auth.users(id,email) VALUES('b4111111-1111-1111-1111-111111111111','pause-columns@test.dev');
INSERT INTO public.babies(id,household_id,name)
SELECT 'b4bbbbbb-0000-0000-0000-000000000001',household_id,'Pause columns'
FROM public.users WHERE id='b4111111-1111-1111-1111-111111111111';
SELECT set_config('request.jwt.claims','{"sub":"b4111111-1111-1111-1111-111111111111"}',true);
DO $$
DECLARE
 tbl text;
 rec jsonb;
 rec_id uuid;
 saved jsonb;
 negative_rejected boolean;
BEGIN
 FOREACH tbl IN ARRAY ARRAY['feedings','pumping_sessions','tummy_time_sessions'] LOOP
  IF NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name=tbl
    AND column_name='paused_seconds' AND is_nullable='YES' AND column_default IS NULL) THEN
   RAISE EXCEPTION 'nullable/no-default compatibility broken for %',tbl;
  END IF;
  rec_id:=md5('pause-columns-' || tbl)::uuid;
  rec:=jsonb_build_object('id',rec_id,'baby_id','b4bbbbbb-0000-0000-0000-000000000001',
    'started_at','2026-07-15T08:00:00Z','ended_at','2026-07-15T08:08:00Z','duration_seconds',480);
  IF tbl='feedings' THEN rec:=rec || '{"type":"breast"}'; END IF;
  saved:=public.merge_record(tbl,rec,'{}');
  IF saved->>'paused_seconds' IS NOT NULL OR (saved->>'duration_seconds')::integer <> 480 THEN
   RAISE EXCEPTION 'legacy insert changed for %',tbl;
  END IF;
  rec:=rec || '{"paused_seconds":180,"duration_seconds":300}';
  saved:=public.merge_record(tbl,rec,'{"paused_seconds":{"ts":1,"deviceId":"owner"},"duration_seconds":{"ts":1,"deviceId":"owner"}}');
  IF (saved->>'paused_seconds')::integer <> 180 OR (saved->>'duration_seconds')::integer <> 300 THEN
   RAISE EXCEPTION 'pause metadata lost for %',tbl;
  END IF;
  saved:=public.merge_record(tbl,rec - 'paused_seconds' - 'duration_seconds' || '{"notes":"legacy edit"}',
    '{"notes":{"ts":2,"deviceId":"old-client"}}');
  IF (saved->>'paused_seconds')::integer <> 180 OR (saved->>'duration_seconds')::integer <> 300 THEN
   RAISE EXCEPTION 'legacy three-argument edit lost pauses for %',tbl;
  END IF;
  saved:=public.merge_record(tbl,rec - 'paused_seconds' - 'duration_seconds' || '{"notes":"queued legacy edit"}',
    '{"notes":{"ts":3,"deviceId":"old-client"}}','pause-columns-' || tbl,'b4111111-1111-1111-1111-111111111111');
  IF (saved->>'paused_seconds')::integer <> 180 OR (saved->>'duration_seconds')::integer <> 300 THEN
   RAISE EXCEPTION 'legacy five-argument edit lost pauses for %',tbl;
  END IF;
  negative_rejected:=false;
  BEGIN
   PERFORM public.merge_record(tbl,rec || '{"paused_seconds":-1}',
    '{"paused_seconds":{"ts":4,"deviceId":"buggy-client"}}');
  EXCEPTION WHEN check_violation THEN negative_rejected:=true;
  END;
  IF NOT negative_rejected THEN RAISE EXCEPTION 'negative pause accepted for %',tbl; END IF;
 END LOOP;
END $$;
ROLLBACK;

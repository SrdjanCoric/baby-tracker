\set ON_ERROR_STOP on
BEGIN;
INSERT INTO auth.users(id,email) VALUES('b5111111-1111-1111-1111-111111111111','pumping-sides@test.dev');
INSERT INTO public.babies(id,household_id,name)
SELECT 'b5bbbbbb-0000-0000-0000-000000000001',household_id,'Pumping sides'
FROM public.users WHERE id='b5111111-1111-1111-1111-111111111111';
SELECT set_config('request.jwt.claims','{"sub":"b5111111-1111-1111-1111-111111111111"}',true);
DO $$
DECLARE
 col text;
 rec jsonb;
 saved jsonb;
 negative_rejected boolean;
BEGIN
 FOREACH col IN ARRAY ARRAY['left_duration_seconds','right_duration_seconds'] LOOP
  IF NOT EXISTS(SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='pumping_sessions'
    AND column_name=col AND data_type='integer' AND is_nullable='YES' AND column_default IS NULL) THEN
   RAISE EXCEPTION 'pumping_sessions.% must be a nullable integer without a default',col;
  END IF;
 END LOOP;
 rec:=jsonb_build_object('id',md5('pumping-sides')::uuid,'baby_id','b5bbbbbb-0000-0000-0000-000000000001',
   'side','both','started_at','2026-10-13T08:00:00Z','ended_at','2026-10-13T08:20:00Z','duration_seconds',1200);
 saved:=public.merge_record('pumping_sessions',rec,'{}');
 IF saved->>'left_duration_seconds' IS NOT NULL OR saved->>'right_duration_seconds' IS NOT NULL THEN
  RAISE EXCEPTION 'an entry without sides must keep them absent: %',saved;
 END IF;
 saved:=public.merge_record('pumping_sessions',rec || '{"left_duration_seconds":720,"right_duration_seconds":480}',
   '{"left_duration_seconds":{"ts":1,"deviceId":"owner"},"right_duration_seconds":{"ts":1,"deviceId":"owner"}}');
 IF (saved->>'left_duration_seconds')::integer <> 720 OR (saved->>'right_duration_seconds')::integer <> 480 THEN
  RAISE EXCEPTION 'pumping sides lost: %',saved;
 END IF;
 saved:=public.merge_record('pumping_sessions',rec || '{"notes":"legacy edit"}','{"notes":{"ts":2,"deviceId":"old-client"}}');
 IF (saved->>'left_duration_seconds')::integer <> 720 OR (saved->>'right_duration_seconds')::integer <> 480 THEN
  RAISE EXCEPTION 'an edit from an older client lost pumping sides: %',saved;
 END IF;
 negative_rejected:=false;
 BEGIN
  PERFORM public.merge_record('pumping_sessions',rec || '{"left_duration_seconds":-1}',
   '{"left_duration_seconds":{"ts":3,"deviceId":"buggy-client"}}');
 EXCEPTION WHEN check_violation THEN negative_rejected:=true;
 END;
 IF NOT negative_rejected THEN RAISE EXCEPTION 'negative pumping side seconds accepted'; END IF;
END $$;
DO $$
DECLARE
 side_value text;
 data jsonb;
BEGIN
 FOREACH side_value IN ARRAY ARRAY['left','right','both'] LOOP
  DELETE FROM public.active_timers WHERE baby_id='b5bbbbbb-0000-0000-0000-000000000001';
  INSERT INTO public.active_timers (baby_id,activity_type,started_by,started_at,timer_data)
  VALUES ('b5bbbbbb-0000-0000-0000-000000000001','pumping','b5111111-1111-1111-1111-111111111111',now()-interval '8 minutes',
   jsonb_build_object('isPaused',false,'side',side_value,'currentSideStartedAt',now()-interval '4 minutes',
    'leftAccumulatedSeconds',30,'rightAccumulatedSeconds',60,'totalPausedMs',0));
  SELECT timer_data INTO data FROM public.active_timers
  WHERE baby_id='b5bbbbbb-0000-0000-0000-000000000001' AND activity_type='pumping';
  -- A widget sends the client's last copy; the server, not the client, banks the side.
  PERFORM public.toggle_timer_pause('b5bbbbbb-0000-0000-0000-000000000001','pumping','b5111111-1111-1111-1111-111111111111',
   data || jsonb_build_object('isPaused',true,'leftAccumulatedSeconds',999,'rightAccumulatedSeconds',999));
  -- now() is transaction-stable; advance elapsed time by shifting the saved boundary.
  UPDATE public.active_timers SET timer_data=jsonb_set(timer_data,'{pausedAt}',to_jsonb((timer_data->>'pausedAt')::timestamptz-interval '60 seconds'))
   WHERE baby_id='b5bbbbbb-0000-0000-0000-000000000001' AND activity_type='pumping';
  SELECT timer_data INTO data FROM public.active_timers
  WHERE baby_id='b5bbbbbb-0000-0000-0000-000000000001' AND activity_type='pumping';
  IF (data->>'leftAccumulatedSeconds')::integer <> (30 + CASE WHEN side_value IN ('left','both') THEN 240 ELSE 0 END)
   OR (data->>'rightAccumulatedSeconds')::integer <> (60 + CASE WHEN side_value IN ('right','both') THEN 240 ELSE 0 END) THEN
   RAISE EXCEPTION 'a widget pause did not bank the % side: %',side_value,data;
  END IF;
  PERFORM public.toggle_timer_pause('b5bbbbbb-0000-0000-0000-000000000001','pumping','b5111111-1111-1111-1111-111111111111',
   data || '{"isPaused":true}');
  IF (SELECT timer_data FROM public.active_timers
      WHERE baby_id='b5bbbbbb-0000-0000-0000-000000000001' AND activity_type='pumping') IS DISTINCT FROM data THEN
   RAISE EXCEPTION 'a duplicate pause changed the % side totals',side_value;
  END IF;
  PERFORM public.toggle_timer_pause('b5bbbbbb-0000-0000-0000-000000000001','pumping','b5111111-1111-1111-1111-111111111111',
   data || '{"isPaused":false,"leftAccumulatedSeconds":0,"rightAccumulatedSeconds":0}');
  SELECT timer_data INTO data FROM public.active_timers
  WHERE baby_id='b5bbbbbb-0000-0000-0000-000000000001' AND activity_type='pumping';
  IF (data->>'leftAccumulatedSeconds')::integer <> (30 + CASE WHEN side_value IN ('left','both') THEN 240 ELSE 0 END)
   OR (data->>'rightAccumulatedSeconds')::integer <> (60 + CASE WHEN side_value IN ('right','both') THEN 240 ELSE 0 END)
   OR (data->>'currentSideStartedAt')::timestamptz <> now()
   OR (data->>'totalPausedMs')::numeric <> 60000 THEN
   RAISE EXCEPTION 'a widget resume added the pause to the % side: %',side_value,data;
  END IF;
 END LOOP;
END $$;
DO $$
DECLARE
 data jsonb;
BEGIN
 -- A timer started on a release without per-side seconds stays untracked.
 DELETE FROM public.active_timers WHERE baby_id='b5bbbbbb-0000-0000-0000-000000000001';
 INSERT INTO public.active_timers (baby_id,activity_type,started_by,started_at,timer_data)
 VALUES ('b5bbbbbb-0000-0000-0000-000000000001','pumping','b5111111-1111-1111-1111-111111111111',now()-interval '8 minutes',
  '{"isPaused":false,"side":"right","totalPausedMs":0}');
 SELECT timer_data INTO data FROM public.active_timers
 WHERE baby_id='b5bbbbbb-0000-0000-0000-000000000001' AND activity_type='pumping';
 PERFORM public.toggle_timer_pause('b5bbbbbb-0000-0000-0000-000000000001','pumping','b5111111-1111-1111-1111-111111111111',
  data || '{"isPaused":true}');
 UPDATE public.active_timers SET timer_data=jsonb_set(timer_data,'{pausedAt}',to_jsonb((timer_data->>'pausedAt')::timestamptz-interval '60 seconds'))
  WHERE baby_id='b5bbbbbb-0000-0000-0000-000000000001' AND activity_type='pumping';
 SELECT timer_data INTO data FROM public.active_timers
 WHERE baby_id='b5bbbbbb-0000-0000-0000-000000000001' AND activity_type='pumping';
 PERFORM public.toggle_timer_pause('b5bbbbbb-0000-0000-0000-000000000001','pumping','b5111111-1111-1111-1111-111111111111',
  data || '{"isPaused":false}');
 SELECT timer_data INTO data FROM public.active_timers
 WHERE baby_id='b5bbbbbb-0000-0000-0000-000000000001' AND activity_type='pumping';
 IF data ? 'leftAccumulatedSeconds' OR data ? 'rightAccumulatedSeconds' OR data ? 'currentSideStartedAt'
  OR (data->>'totalPausedMs')::numeric <> 60000 THEN
  RAISE EXCEPTION 'a widget pause invented sides for a legacy pumping timer: %',data;
 END IF;
END $$;
ROLLBACK;

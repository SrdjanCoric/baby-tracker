\set ON_ERROR_STOP on
BEGIN;
INSERT INTO auth.users (id,email) VALUES ('b3111111-1111-1111-1111-111111111111','pause-review@test.dev');
INSERT INTO public.babies (id,household_id,name)
SELECT 'b3bbbbbb-0000-0000-0000-000000000001',household_id,'Pause baby'
FROM public.users WHERE id='b3111111-1111-1111-1111-111111111111';
SELECT set_config('request.jwt.claims','{"sub":"b3111111-1111-1111-1111-111111111111"}',true);
INSERT INTO public.active_timers (baby_id,activity_type,started_by,started_at,timer_data)
VALUES ('b3bbbbbb-0000-0000-0000-000000000001','feeding','b3111111-1111-1111-1111-111111111111',now()-interval '8 minutes',
 '{"isPaused":true,"pausedAt":"2026-07-15T08:01:00.000Z"}');
SET LOCAL ROLE authenticated;
DO $$
DECLARE snapshot jsonb;
BEGIN
 snapshot := public.get_baby_activity_snapshot('b3bbbbbb-0000-0000-0000-000000000001','UTC');
 IF snapshot->'activeTimer' ? 'pausedAt' OR snapshot->'activeTimer'->>'isPaused' <> 'true' THEN
  RAISE EXCEPTION 'widget snapshot must retain paused state without the unused timestamp';
 END IF;
END $$;
RESET ROLE;
DELETE FROM public.active_timers WHERE baby_id='b3bbbbbb-0000-0000-0000-000000000001';
DO $$
DECLARE
 activity text;
 data jsonb;
BEGIN
 FOREACH activity IN ARRAY ARRAY['feeding','pumping','tummy_time','sleep'] LOOP
  INSERT INTO public.active_timers (baby_id,activity_type,started_by,started_at,timer_data)
  VALUES ('b3bbbbbb-0000-0000-0000-000000000001',activity,'b3111111-1111-1111-1111-111111111111',now()-interval '8 minutes',
    jsonb_build_object('isPaused',true,'pausedAt',now()-interval '3 minutes','totalPausedMs',60000));
  PERFORM public.toggle_timer_pause('b3bbbbbb-0000-0000-0000-000000000001',activity,'b3111111-1111-1111-1111-111111111111','{"isPaused":false}');
  SELECT timer_data INTO data FROM public.active_timers
  WHERE baby_id='b3bbbbbb-0000-0000-0000-000000000001' AND activity_type=activity;
  IF (activity <> 'sleep' AND (data->>'lastResumedAt')::timestamptz IS DISTINCT FROM now())
    OR (activity = 'sleep' AND data ? 'lastResumedAt')
    OR data ? 'pausedAt' OR data->>'isPaused' <> 'false'
    OR (data->>'totalPausedMs')::numeric <> (CASE WHEN activity='sleep' THEN 60000 ELSE 240000 END) THEN
   RAISE EXCEPTION 'resume pause accounting wrong for %: %',activity,data;
  END IF;
  PERFORM public.toggle_timer_pause('b3bbbbbb-0000-0000-0000-000000000001',activity,'b3111111-1111-1111-1111-111111111111','{"isPaused":false}');
  IF (SELECT timer_data FROM public.active_timers WHERE baby_id='b3bbbbbb-0000-0000-0000-000000000001' AND activity_type=activity) <> data THEN
   RAISE EXCEPTION 'duplicate resume added pause for %',activity;
  END IF;
  UPDATE public.active_timers SET timer_data=jsonb_build_object('isPaused',true,'pausedAt',now()+interval '1 minute','totalPausedMs',60000)
  WHERE baby_id='b3bbbbbb-0000-0000-0000-000000000001' AND activity_type=activity;
  PERFORM public.toggle_timer_pause('b3bbbbbb-0000-0000-0000-000000000001',activity,'b3111111-1111-1111-1111-111111111111','{"isPaused":false}');
  IF (SELECT (timer_data->>'totalPausedMs')::numeric FROM public.active_timers WHERE baby_id='b3bbbbbb-0000-0000-0000-000000000001' AND activity_type=activity) <> 60000 THEN
   RAISE EXCEPTION 'negative pause added for %',activity;
  END IF;
 END LOOP;
END $$;
DO $$
DECLARE activity text; data jsonb;
BEGIN
 FOREACH activity IN ARRAY ARRAY['feeding','pumping','tummy_time','sleep'] LOOP
  UPDATE public.active_timers SET timer_data=jsonb_build_object('isPaused',false,'totalPausedMs',0)
   WHERE baby_id='b3bbbbbb-0000-0000-0000-000000000001' AND activity_type=activity;
  PERFORM public.toggle_timer_pause('b3bbbbbb-0000-0000-0000-000000000001',activity,'b3111111-1111-1111-1111-111111111111',
   jsonb_build_object('isPaused',true,'pausedAt',now()+interval '90 seconds'));
  SELECT timer_data INTO data FROM public.active_timers WHERE baby_id='b3bbbbbb-0000-0000-0000-000000000001' AND activity_type=activity;
  IF (data->>'pausedAt')::timestamptz IS DISTINCT FROM (CASE WHEN activity='sleep' THEN now()+interval '90 seconds' ELSE now() END) THEN
   RAISE EXCEPTION 'pause accepted skewed client clock for %: %',activity,data;
  END IF;
  -- now() is transaction-stable; advance elapsed time by shifting the saved boundary.
  UPDATE public.active_timers SET timer_data=jsonb_set(timer_data,'{pausedAt}',to_jsonb((timer_data->>'pausedAt')::timestamptz-interval '60 seconds'))
   WHERE baby_id='b3bbbbbb-0000-0000-0000-000000000001' AND activity_type=activity;
  PERFORM public.toggle_timer_pause('b3bbbbbb-0000-0000-0000-000000000001',activity,'b3111111-1111-1111-1111-111111111111','{"isPaused":false}');
  SELECT timer_data INTO data FROM public.active_timers WHERE baby_id='b3bbbbbb-0000-0000-0000-000000000001' AND activity_type=activity;
  IF (data->>'totalPausedMs')::numeric <> (CASE WHEN activity='sleep' THEN 0 ELSE 60000 END) THEN
   RAISE EXCEPTION 'server clock pause accounting wrong for %: %',activity,data;
  END IF;
 END LOOP;
END $$;
DO $$
DECLARE activity text; data jsonb;
BEGIN
 FOREACH activity IN ARRAY ARRAY['feeding','pumping','tummy_time','sleep'] LOOP
  UPDATE public.active_timers SET timer_data=jsonb_build_object('isPaused',true,'pausedAt',now()-interval '5 minutes','totalPausedMs',0,'accumulatedSeconds',300)
   WHERE baby_id='b3bbbbbb-0000-0000-0000-000000000001' AND activity_type=activity;
  PERFORM public.toggle_timer_pause('b3bbbbbb-0000-0000-0000-000000000001',activity,'b3111111-1111-1111-1111-111111111111',
   jsonb_build_object('isPaused',true,'pausedAt',now()-interval '2 minutes','accumulatedSeconds',480));
  IF activity <> 'sleep' AND (SELECT timer_data->>'accumulatedSeconds' FROM public.active_timers WHERE baby_id='b3bbbbbb-0000-0000-0000-000000000001' AND activity_type=activity) IS DISTINCT FROM '300' THEN
   RAISE EXCEPTION 'duplicate pause changed frozen display for %',activity;
  END IF;
  PERFORM public.toggle_timer_pause('b3bbbbbb-0000-0000-0000-000000000001',activity,'b3111111-1111-1111-1111-111111111111','{"isPaused":false}');
  SELECT timer_data INTO data FROM public.active_timers WHERE baby_id='b3bbbbbb-0000-0000-0000-000000000001' AND activity_type=activity;
  IF (data->>'totalPausedMs')::numeric <> (CASE WHEN activity='sleep' THEN 0 ELSE 300000 END) THEN
   RAISE EXCEPTION 'duplicate pause shortened pause for %: %',activity,data;
  END IF;
 END LOOP;
END $$;
DO $$
DECLARE data jsonb;
BEGIN
 UPDATE public.active_timers SET timer_data=jsonb_build_object('isPaused',false,'side','left','currentSideStartedAt',now()-interval '4 minutes',
  'leftAccumulatedSeconds',30,'rightAccumulatedSeconds',0,'totalPausedMs',0)
 WHERE baby_id='b3bbbbbb-0000-0000-0000-000000000001' AND activity_type='feeding';
 SELECT timer_data INTO data FROM public.active_timers
 WHERE baby_id='b3bbbbbb-0000-0000-0000-000000000001' AND activity_type='feeding';
 PERFORM public.toggle_timer_pause('b3bbbbbb-0000-0000-0000-000000000001','feeding','b3111111-1111-1111-1111-111111111111',
  data || jsonb_build_object('isPaused',true,'pausedAt',now()-interval '3 minutes'));
 PERFORM public.toggle_timer_pause('b3bbbbbb-0000-0000-0000-000000000001','feeding','b3111111-1111-1111-1111-111111111111',data || '{"isPaused":false}');
 SELECT timer_data INTO data FROM public.active_timers
 WHERE baby_id='b3bbbbbb-0000-0000-0000-000000000001' AND activity_type='feeding';
 IF (data->>'leftAccumulatedSeconds')::integer <> 270 OR (data->>'totalPausedMs')::numeric <> 0
  OR (data->>'currentSideStartedAt')::timestamptz <> now() THEN
  RAISE EXCEPTION 'widget nursing pause was added to the side: %',data;
 END IF;
END $$;
ROLLBACK;

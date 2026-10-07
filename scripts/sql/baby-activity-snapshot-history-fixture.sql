INSERT INTO auth.users (id,email)
VALUES ('87000000-0000-0000-0000-000000000001','snapshot-cost@example.invalid');
INSERT INTO public.babies (id,household_id,name,birth_date)
SELECT '87000000-0000-0000-0000-000000000002', household_id, 'Cost Baby', '2026-10-01'
FROM public.users WHERE id = '87000000-0000-0000-0000-000000000001';
SELECT set_config('request.jwt.claims', '{"sub":"87000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
SELECT set_config('widget.snapshot_now','2026-10-07T12:00:00Z',true);

-- These reminder-cache fields are not read by 061. Avoid thousands of unvacuumable
-- baby row versions while comparing history sizes inside one rollback-only transaction.
ALTER TABLE public.feedings DISABLE TRIGGER on_feeding_insert_update_last_fed;
ALTER TABLE public.sleep_sessions DISABLE TRIGGER on_sleep_update_last_ended;

CREATE FUNCTION pg_temp.add_history(first_day integer, last_day integer) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.feedings (baby_id,logged_by,type,started_at,ended_at)
  SELECT '87000000-0000-0000-0000-000000000002', '87000000-0000-0000-0000-000000000001',
    'breast', '2026-10-07'::timestamptz - d * interval '1 day' + h * interval '1 hour',
    '2026-10-07'::timestamptz - d * interval '1 day' + h * interval '1 hour' + interval '20 minutes'
  FROM generate_series(first_day,last_day) d CROSS JOIN generate_series(0,21,3) h;
  INSERT INTO public.sleep_sessions (baby_id,logged_by,type,started_at,ended_at,duration_seconds)
  SELECT '87000000-0000-0000-0000-000000000002', '87000000-0000-0000-0000-000000000001',
    CASE WHEN h = 0 THEN 'night' ELSE 'nap' END,
    '2026-10-07'::timestamptz - d * interval '1 day' + h * interval '1 hour',
    '2026-10-07'::timestamptz - d * interval '1 day' + h * interval '1 hour' + interval '1 hour', 3600
  FROM generate_series(first_day,last_day) d CROSS JOIN generate_series(0,18,6) h;
  INSERT INTO public.diapers (baby_id,type,changed_at)
  SELECT '87000000-0000-0000-0000-000000000002', 'wet',
    '2026-10-07'::timestamptz - d * interval '1 day' + h * interval '1 hour'
  FROM generate_series(first_day,last_day) d CROSS JOIN generate_series(0,21,3) h;
  INSERT INTO public.pumping_sessions (baby_id,logged_by,started_at,amount_ml)
  SELECT '87000000-0000-0000-0000-000000000002', '87000000-0000-0000-0000-000000000001',
    '2026-10-07'::timestamptz - d * interval '1 day' + h * interval '1 hour', 50
  FROM generate_series(first_day,last_day) d CROSS JOIN generate_series(0,16,8) h;
  INSERT INTO public.growth_measurements (baby_id,measured_at,weight_kg)
  SELECT '87000000-0000-0000-0000-000000000002', '2026-10-07'::date - d, 5
  FROM generate_series(first_day,last_day) d;
  INSERT INTO public.tummy_time_sessions (baby_id,logged_by,started_at,duration_seconds)
  SELECT '87000000-0000-0000-0000-000000000002', '87000000-0000-0000-0000-000000000001',
    '2026-10-07'::timestamptz - d * interval '1 day' + h * interval '1 hour', 600
  FROM generate_series(first_day,last_day) d CROSS JOIN generate_series(0,16,8) h;
END $$;

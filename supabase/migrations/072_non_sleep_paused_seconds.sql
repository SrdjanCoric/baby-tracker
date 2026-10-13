ALTER TABLE public.feedings ADD COLUMN IF NOT EXISTS paused_seconds integer CHECK (paused_seconds IS NULL OR paused_seconds >= 0);
ALTER TABLE public.pumping_sessions ADD COLUMN IF NOT EXISTS paused_seconds integer CHECK (paused_seconds IS NULL OR paused_seconds >= 0);
ALTER TABLE public.tummy_time_sessions ADD COLUMN IF NOT EXISTS paused_seconds integer CHECK (paused_seconds IS NULL OR paused_seconds >= 0);

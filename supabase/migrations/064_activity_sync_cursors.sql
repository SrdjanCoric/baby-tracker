-- Support incremental activity catch-up with a stable composite cursor.

ALTER TABLE public.diapers
  ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE public.pumping_sessions
  ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE public.growth_measurements
  ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE public.tummy_time_sessions
  ADD COLUMN updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

UPDATE public.feedings
SET updated_at = COALESCE(updated_at, created_at, clock_timestamp())
WHERE updated_at IS NULL;
UPDATE public.sleep_sessions
SET updated_at = COALESCE(updated_at, created_at, clock_timestamp())
WHERE updated_at IS NULL;
ALTER TABLE public.feedings ALTER COLUMN updated_at SET NOT NULL;
ALTER TABLE public.sleep_sessions ALTER COLUMN updated_at SET NOT NULL;

CREATE OR REPLACE FUNCTION public.enforce_activity_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = pg_catalog, public
AS $$
BEGIN
  NEW.updated_at := pg_catalog.clock_timestamp();
  RETURN NEW;
END;
$$;

DO $$
DECLARE
  activity_table text;
BEGIN
  FOREACH activity_table IN ARRAY ARRAY[
    'feedings',
    'sleep_sessions',
    'diapers',
    'pumping_sessions',
    'growth_measurements',
    'tummy_time_sessions',
    'health_entries',
    'milestone_responses'
  ]
  LOOP
    EXECUTE format(
      'CREATE TRIGGER enforce_activity_updated_at BEFORE INSERT OR UPDATE ON public.%I '
      'FOR EACH ROW EXECUTE FUNCTION public.enforce_activity_updated_at()',
      activity_table
    );
  END LOOP;
END;
$$;

CREATE INDEX idx_feedings_baby_updated_id
  ON public.feedings (baby_id, updated_at, id);
CREATE INDEX idx_sleep_sessions_baby_updated_id
  ON public.sleep_sessions (baby_id, updated_at, id);
CREATE INDEX idx_diapers_baby_updated_id
  ON public.diapers (baby_id, updated_at, id);
CREATE INDEX idx_pumping_sessions_baby_updated_id
  ON public.pumping_sessions (baby_id, updated_at, id);
CREATE INDEX idx_growth_measurements_baby_updated_id
  ON public.growth_measurements (baby_id, updated_at, id);
CREATE INDEX idx_tummy_time_sessions_baby_updated_id
  ON public.tummy_time_sessions (baby_id, updated_at, id);
CREATE INDEX idx_health_entries_baby_updated_id
  ON public.health_entries (baby_id, updated_at, id);
CREATE INDEX idx_milestone_responses_baby_updated_id
  ON public.milestone_responses (baby_id, updated_at, id);

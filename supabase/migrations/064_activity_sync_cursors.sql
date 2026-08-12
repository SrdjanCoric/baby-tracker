-- Support incremental activity catch-up with a stable composite cursor.
--
-- Every statement is idempotent and convergent. A fresh local reset reaches the same end
-- state as the hosted database, where `diapers`, `pumping_sessions`, `growth_measurements`,
-- and `tummy_time_sessions` already carried a nullable `updated_at` added outside the
-- migration chain. Re-running this file is safe from any starting point.

-- 1. Columns. Absent on a fresh database, already present (nullable) on the hosted one.
ALTER TABLE public.diapers
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE public.pumping_sessions
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE public.growth_measurements
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();
ALTER TABLE public.tummy_time_sessions
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

-- 2. Backfill, then enforce NOT NULL on all eight. This runs before the trigger exists so
--    the COALESCE values survive; a column added nullable elsewhere is corrected here.
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
      'UPDATE public.%I SET updated_at = COALESCE(updated_at, created_at, clock_timestamp()) '
      'WHERE updated_at IS NULL',
      activity_table
    );
    EXECUTE format(
      'ALTER TABLE public.%I ALTER COLUMN updated_at SET NOT NULL',
      activity_table
    );
  END LOOP;
END;
$$;

-- 3. Server-authored timestamps. A caller-supplied updated_at is always overwritten, so a
--    crafted insert cannot forge or null a cursor value.
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
      'DROP TRIGGER IF EXISTS enforce_activity_updated_at ON public.%I',
      activity_table
    );
    EXECUTE format(
      'CREATE TRIGGER enforce_activity_updated_at BEFORE INSERT OR UPDATE ON public.%I '
      'FOR EACH ROW EXECUTE FUNCTION public.enforce_activity_updated_at()',
      activity_table
    );
  END LOOP;
END;
$$;

-- 4. Composite cursor indexes.
CREATE INDEX IF NOT EXISTS idx_feedings_baby_updated_id
  ON public.feedings (baby_id, updated_at, id);
CREATE INDEX IF NOT EXISTS idx_sleep_sessions_baby_updated_id
  ON public.sleep_sessions (baby_id, updated_at, id);
CREATE INDEX IF NOT EXISTS idx_diapers_baby_updated_id
  ON public.diapers (baby_id, updated_at, id);
CREATE INDEX IF NOT EXISTS idx_pumping_sessions_baby_updated_id
  ON public.pumping_sessions (baby_id, updated_at, id);
CREATE INDEX IF NOT EXISTS idx_growth_measurements_baby_updated_id
  ON public.growth_measurements (baby_id, updated_at, id);
CREATE INDEX IF NOT EXISTS idx_tummy_time_sessions_baby_updated_id
  ON public.tummy_time_sessions (baby_id, updated_at, id);
CREATE INDEX IF NOT EXISTS idx_health_entries_baby_updated_id
  ON public.health_entries (baby_id, updated_at, id);
CREATE INDEX IF NOT EXISTS idx_milestone_responses_baby_updated_id
  ON public.milestone_responses (baby_id, updated_at, id);

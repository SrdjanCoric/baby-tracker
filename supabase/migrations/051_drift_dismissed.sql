ALTER TABLE wake_window_preferences ADD COLUMN IF NOT EXISTS drift_dismissed jsonb DEFAULT null;
